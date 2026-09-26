import { CircleCheck, Pause, Play, Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { isReadyToClose, type WorkOrder } from "@/data/machines";
import { formatNumber, type Notify } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextField";
import { useOps } from "./OpsStore";

const PAUSE_OPTIONS = ["Falta de material", "Máquina em manutenção", "Aguardando liberação da qualidade", "Outro motivo"];

export interface OpAction {
  id: "release" | "pause" | "resume" | "close";
  label: string;
  icon: typeof Play;
  /** a ação que o sistema sugere agora (vira o botão principal) */
  isPrimary: boolean;
  run: () => void;
}

/**
 * Ações de etapa de uma OP, usadas na tabela de OPs e no cabeçalho da conversa.
 * Pausar pede o motivo (vira mensagem na conversa); concluir abaixo da
 * quantidade pede confirmação; o resto é direto, com "Desfazer".
 */
export function useOpActions(notify: Notify) {
  const { setStage } = useOps();
  const [pausing, setPausing] = useState<WorkOrder | null>(null);
  const [reason, setReason] = useState(PAUSE_OPTIONS[0]);
  const [other, setOther] = useState("");
  const [closing, setClosing] = useState<WorkOrder | null>(null);

  const undoTo = (op: WorkOrder) => ({ label: "Desfazer", onClick: () => setStage(op.id, op.stage, op.pauseReason ?? undefined) });

  const close = (op: WorkOrder) => {
    setStage(op.id, "done");
    notify(`${op.id} concluída`, "A conversa da OP foi encerrada.", "success", undoTo(op));
  };

  const actionsFor = (op: WorkOrder): OpAction[] => {
    switch (op.stage) {
      case "waiting":
        return [
          {
            id: "release",
            label: "Liberar para produção",
            icon: Send,
            isPrimary: true,
            run: () => {
              setStage(op.id, "running");
              notify(`${op.id} liberada`, "A OP já aparece para apontamento na máquina.", "success", undoTo(op));
            },
          },
        ];
      case "running":
        return [
          { id: "close", label: "Concluir OP", icon: CircleCheck, isPrimary: isReadyToClose(op), run: () => (isReadyToClose(op) ? close(op) : setClosing(op)) },
          {
            id: "pause",
            label: "Pausar",
            icon: Pause,
            isPrimary: false,
            run: () => {
              setReason(PAUSE_OPTIONS[0]);
              setOther("");
              setPausing(op);
            },
          },
        ];
      case "paused":
        return [
          {
            id: "resume",
            label: "Retomar produção",
            icon: Play,
            isPrimary: true,
            run: () => {
              setStage(op.id, "running");
              notify(`${op.id} retomada`, undefined, "success", undoTo(op));
            },
          },
          { id: "close", label: "Concluir OP", icon: CircleCheck, isPrimary: false, run: () => setClosing(op) },
        ];
      case "done":
        return [];
    }
  };

  const finalReason = reason === "Outro motivo" ? other.trim() : reason;

  const dialogs: ReactNode = (
    <>
      <Modal
        open={!!pausing}
        onOpenChange={(o) => !o && setPausing(null)}
        title={pausing ? `Pausar ${pausing.id}?` : ""}
        primary={{
          label: "Pausar OP",
          onClick: () => {
            if (!pausing || !finalReason) return;
            setStage(pausing.id, "paused", finalReason);
            notify(`${pausing.id} pausada`, finalReason, "success", undoTo(pausing));
            setPausing(null);
          },
        }}
      >
        <fieldset className="flex flex-col gap-100">
          <legend className="pb-100 text-subtle">O motivo vai para a conversa da OP, para todos os turnos verem.</legend>
          {PAUSE_OPTIONS.map((o) => (
            <label key={o} className="flex min-h-control items-center gap-100 text-default">
              <input type="radio" name="pause-reason" value={o} checked={reason === o} onChange={() => setReason(o)} className="size-checkbox [accent-color:var(--ds-background-brand-bold)]" />
              {o}
            </label>
          ))}
        </fieldset>
        {reason === "Outro motivo" && (
          <TextArea
            label="Motivo"
            className="mt-150"
            autoFocus
            maxLength={200}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            error={other.trim() ? null : "Descreva o motivo da pausa"}
          />
        )}
      </Modal>

      <Modal
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title={closing ? `Concluir ${closing.id}?` : ""}
        primary={{
          label: "Concluir mesmo assim",
          onClick: () => {
            if (closing) close(closing);
            setClosing(null);
          },
        }}
      >
        {closing && (
          <p className="text-default">
            A OP tem <strong className="tabular-nums">{formatNumber(closing.produced)}</strong> de{" "}
            <strong className="tabular-nums">{formatNumber(closing.planned)}</strong> peças apontadas (
            {Math.round((closing.produced / closing.planned) * 100)}%). Ao concluir, a conversa é encerrada e a OP sai da
            lista de apontamento.
          </p>
        )}
      </Modal>
    </>
  );

  return { actionsFor, dialogs };
}

/** Botões das ações (a sugerida em destaque) */
export function OpActionButtons({ actions, compact }: { actions: OpAction[]; compact?: boolean }) {
  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.id}
          appearance={a.isPrimary ? "primary" : "default"}
          spacing={compact ? "compact" : "default"}
          iconBefore={a.icon}
          onClick={a.run}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}
