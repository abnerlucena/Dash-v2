import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_UNREAD,
  MANAGER,
  NOW,
  OP_STAGE_META,
  WORK_ORDERS,
  isReadyToClose,
  machineById,
  type OpMessage,
  type OpStage,
  type WorkOrder,
} from "@/data/machines";
import { formatNumber } from "@/lib/utils";

/*
 * Estado das OPs compartilhado pelas abas OPs e Feedbacks (e pelo contador
 * do menu). Cada OP tem uma conversa; mudanças de etapa viram mensagens de
 * sistema, e a conversa se encerra quando a OP é concluída.
 */

export interface NewOp {
  number: string;
  machineId: string;
  product: string;
  planned: number;
}

interface OpsState {
  ops: WorkOrder[];
  opById: (id: string) => WorkOrder | undefined;
  unread: Set<string>;
  unreadIn: (op: WorkOrder) => number;
  markRead: (opId: string) => void;
  markAllRead: () => void;
  markUnread: (opId: string) => void;
  send: (opId: string, text: string) => void;
  /** muda a etapa; `reason` obrigatório para pausar */
  setStage: (opId: string, stage: OpStage, reason?: string) => void;
  create: (op: NewOp) => string;
}

const Ctx = createContext<OpsState | null>(null);

let seq = 0;
/** Relógio do protótipo: minutos depois de "agora" (28/03, 7h), avançando a cada ação */
const tick = () => new Date(NOW.getTime() + ++seq * 60000);

const system = (opId: string, text: string): OpMessage => ({
  id: `${opId}-s${Date.now()}-${seq}`,
  opId,
  at: tick(),
  author: MANAGER,
  role: "system",
  text,
});

export function OpsProvider({ children }: { children: ReactNode }) {
  const [ops, setOps] = useState<WorkOrder[]>(WORK_ORDERS);
  const [unread, setUnread] = useState<Set<string>>(() => new Set(INITIAL_UNREAD));

  const update = useCallback((opId: string, fn: (op: WorkOrder) => WorkOrder) => {
    setOps((list) => list.map((op) => (op.id === opId ? fn(op) : op)));
  }, []);

  const value = useMemo<OpsState>(() => {
    const opById = (id: string) => ops.find((op) => op.id === id);
    return {
      ops,
      opById,
      unread,
      unreadIn: (op) => op.messages.reduce((n, m) => n + (unread.has(m.id) ? 1 : 0), 0),
      markRead: (opId) => {
        const op = opById(opId);
        if (!op || !op.messages.some((m) => unread.has(m.id))) return;
        setUnread((prev) => {
          const next = new Set(prev);
          op.messages.forEach((m) => next.delete(m.id));
          return next;
        });
      },
      markAllRead: () => setUnread(new Set()),
      markUnread: (opId) => {
        const op = opById(opId);
        const last = op && [...op.messages].reverse().find((m) => m.role !== "system" && m.author !== MANAGER);
        if (last) setUnread((prev) => new Set(prev).add(last.id));
      },
      send: (opId, text) =>
        update(opId, (op) => ({
          ...op,
          messages: [...op.messages, { id: `${opId}-u${++seq}`, opId, at: tick(), author: MANAGER, role: "manager", text }],
        })),
      setStage: (opId, stage, reason) =>
        update(opId, (op) => {
          const text =
            stage === "running"
              ? op.stage === "waiting"
                ? `OP liberada para produção por ${MANAGER}.`
                : `Produção retomada por ${MANAGER}.`
              : stage === "paused"
                ? `Pausada por ${MANAGER}: ${reason}.`
                : stage === "done"
                  ? `OP concluída por ${MANAGER} · ${formatNumber(op.produced)} de ${formatNumber(op.planned)} peças.`
                  : `OP voltou para ${OP_STAGE_META[stage].label.toLowerCase()}.`;
          const at = tick();
          return {
            ...op,
            stage,
            pauseReason: stage === "paused" ? (reason ?? null) : null,
            closedAt: stage === "done" ? at : null,
            messages: [...op.messages, { ...system(opId, text), at }],
          };
        }),
      create: ({ number, machineId, product, planned }) => {
        const id = `OP ${number}`;
        const at = tick();
        setOps((list) => [
          {
            id,
            machineId,
            product,
            planned,
            produced: 0,
            stage: "waiting",
            releasedAt: at,
            closedAt: null,
            pauseReason: null,
            entryIds: [],
            messages: [
              {
                ...system(id, `OP cadastrada no sistema para ${machineById(machineId).name}. Aguardando liberação para a produção.`),
                at,
              },
            ],
          },
          ...list,
        ]);
        return id;
      },
    };
  }, [ops, unread, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOps() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOps fora do OpsProvider");
  return ctx;
}

/** Etapa exibida: "Pronta para concluir" é uma OP em produção que já atingiu a quantidade */
export function stageView(op: WorkOrder) {
  if (isReadyToClose(op)) return { label: "Pronta para concluir", appearance: "discovery" as const, key: "ready" as const };
  return { ...OP_STAGE_META[op.stage], key: op.stage };
}

/** Última atividade da conversa (para ordenar a caixa de entrada) */
export const lastActivity = (op: WorkOrder) => op.messages[op.messages.length - 1]?.at ?? op.releasedAt;

/** Número sem o prefixo, para URLs e colunas estreitas */
export const opNumber = (id: string) => id.replace("OP ", "");

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "hoje, 14:22" · "ontem, 09:10" · "25 mar, 16:40" (relativo ao "agora" do protótipo) */
export function formatWhen(d: Date) {
  const yesterday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1);
  const prefix = sameDay(d, NOW) || d > NOW ? "hoje" : sameDay(d, yesterday) ? "ontem" : day.format(d).replace(".", "");
  return `${prefix}, ${time.format(d)}`;
}
