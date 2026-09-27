import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  INITIAL_UNREAD,
  MANAGER,
  NOW,
  OP_STAGE_META,
  WORK_ORDERS,
  machineById,
  type OpMessage,
  type WorkOrder,
} from "@/data/machines";
import { formatNumber } from "@/lib/utils";
import { Ctx, type OpsState } from "./OpsStore";

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
      create: ({ number, machineId, material, product, planned }) => {
        const id = `OP ${number}`;
        const at = tick();
        setOps((list) => [
          {
            id,
            machineId,
            material,
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
