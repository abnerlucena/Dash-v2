import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SegmentedBar } from "@/components/SegmentedBar";
import { StatusChip } from "@/components/StatusChip";
import { cn } from "@/lib/utils";

interface MachineData {
  id: number;
  name: string;
  totalProd: number;
  totalMeta: number;
  pct: number;
  days: number;
}

interface MachineCardMobileProps {
  machine: MachineData;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Linha expansível da visão "Detalhado" no celular (dentro de uma lista com divisórias). */
const MachineCardMobile = ({ machine }: MachineCardMobileProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = machine.totalMeta > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast active:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="line-clamp-1 text-sm font-medium">{machine.name}</h3>
            <StatusChip pct={hasMeta ? machine.pct : null} emptyLabel={machine.days === 0 ? "Sem apontamento" : undefined} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <SegmentedBar pct={machine.pct} className="flex-1" />
            <span className="w-10 text-right text-sm tabular-nums">{machine.pct}%</span>
          </div>
        </div>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-muted-foreground transition-transform duration-base ease-out", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <dl className="mx-4 mb-3 grid grid-cols-3 gap-2 rounded-md bg-surface-2 p-3 text-center tabular-nums">
          <div>
            <dt className="text-xs text-muted-foreground">Produção</dt>
            <dd className="text-sm font-medium">{fmt(machine.totalProd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Meta</dt>
            <dd className="text-sm font-medium">{hasMeta ? fmt(machine.totalMeta) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dias</dt>
            <dd className="text-sm font-medium">{machine.days}</dd>
          </div>
        </dl>
      )}
    </div>
  );
};

export default MachineCardMobile;
