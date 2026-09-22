import { SegmentedBar } from "@/components/SegmentedBar";
import { StatusChip } from "@/components/StatusChip";

interface MachineData {
  id: number;
  name: string;
  totalProd: number;
  totalMeta: number;
  pct: number;
  days: number;
}

interface MobileDetailCardsProps {
  machines: MachineData[];
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Versão mobile da MachineTable: lista densa com divisórias, não cards soltos. */
const MobileDetailCards = ({ machines, totalProd, totalMeta, pctGeral }: MobileDetailCardsProps) => {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total no período</p>
          <p className="text-kpi font-semibold tabular-nums">{fmt(totalProd)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">meta {totalMeta > 0 ? fmt(totalMeta) : "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-base font-medium tabular-nums">{pctGeral}%</span>
          <StatusChip pct={totalMeta > 0 ? pctGeral : null} />
        </div>
      </div>

      <ul className="divide-y">
        {machines.map(m => (
          <li key={m.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="line-clamp-1 flex-1 text-sm font-medium">{m.name}</h4>
              <StatusChip pct={m.totalMeta > 0 ? m.pct : null} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <SegmentedBar pct={m.pct} className="flex-1" />
              <span className="w-10 text-right text-sm tabular-nums">{m.pct}%</span>
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>Produção <span className="text-foreground">{fmt(m.totalProd)}</span></span>
              <span>Meta <span className="text-foreground">{m.totalMeta > 0 ? fmt(m.totalMeta) : "—"}</span></span>
              <span>{m.days} dias</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MobileDetailCards;
