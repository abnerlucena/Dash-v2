import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/StatusChip";
import { cn } from "@/lib/utils";

interface KPICardsProps {
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
  recordCount: number;
  activeMachineCount?: number;
  totalMachineCount?: number;
  consecutiveDays?: number;
  appointmentRate?: number;
  tendency?: number | null;
  loading?: boolean;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Variação vs período anterior: seta + sinal + texto (nunca só cor). */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">mín. 30 dias p/ comparar</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const color = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", color)}>
        <Icon size={12} aria-hidden="true" />
        {value > 0 ? "+" : ""}{value}%
      </span>
      <span className="text-muted-foreground">vs período anterior</span>
    </span>
  );
}

interface KPI {
  label: string;
  value: string;
  foot: React.ReactNode;
}

function KPIStrip({ items, size }: { items: KPI[]; size: "primary" | "secondary" }) {
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-lg border bg-card">
      {items.map((kpi, i) => (
        <div
          key={kpi.label}
          className={cn(
            "min-w-0 border-border",
            size === "primary" ? "px-4 py-3.5" : "px-4 py-2.5",
            // divisórias de 1px entre células (2 colunas no mobile, 4 no desktop)
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <dt className={cn(size === "primary" ? "text-sm text-foreground" : "text-xs text-muted-foreground")}>{kpi.label}</dt>
          <dd className={cn("tabular-nums", size === "primary" ? "mt-1.5 text-kpi font-semibold" : "mt-0.5 text-base font-medium")}>
            {kpi.value}
          </dd>
          <dd className="mt-1 truncate text-xs text-muted-foreground">{kpi.foot}</dd>
        </div>
      ))}
    </dl>
  );
}

const KPICards = ({
  totalProd, totalMeta, pctGeral, recordCount,
  activeMachineCount = 0, totalMachineCount = 0,
  consecutiveDays = 0, appointmentRate = 0,
  tendency = null, loading,
}: KPICardsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border bg-border" aria-busy="true" aria-label="Carregando indicadores">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card px-4 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2.5 h-7 w-28" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  const primary: KPI[] = [
    { label: "Produção", value: fmt(totalProd), foot: <Delta value={tendency} /> },
    {
      label: "Atingimento da meta",
      value: totalMeta > 0 ? `${pctGeral}%` : "—",
      foot: totalMeta > 0
        ? <span className="inline-flex items-center gap-1.5"><StatusChip pct={pctGeral} /> meta {fmt(totalMeta)}</span>
        : "sem meta no período",
    },
    {
      label: "Taxa de apontamento",
      value: `${appointmentRate}%`,
      foot: recordCount > 0
        ? <span className="inline-flex items-center gap-1.5"><StatusChip pct={appointmentRate} /> turnos apontados</span>
        : "sem apontamentos no período",
    },
    {
      label: "Máquinas ativas",
      value: totalMachineCount > 0 ? `${activeMachineCount} de ${totalMachineCount}` : String(activeMachineCount),
      foot: `${fmt(recordCount)} registros no filtro`,
    },
  ];

  const secondary: KPI[] = [
    { label: "Meta total", value: totalMeta > 0 ? fmt(totalMeta) : "—", foot: "peças esperadas" },
    { label: "Dias consecutivos", value: String(consecutiveDays), foot: "dias seguidos ≥ 90% da meta" },
    { label: "Registros", value: fmt(recordCount), foot: "lançamentos no filtro" },
    {
      label: "Tendência",
      value: tendency !== null ? `${tendency > 0 ? "+" : ""}${tendency}%` : "—",
      foot: tendency !== null ? "produção vs período anterior" : "mín. 30 dias p/ calcular",
    },
  ];

  return (
    <div className="space-y-2">
      <KPIStrip items={primary} size="primary" />
      <KPIStrip items={secondary} size="secondary" />
    </div>
  );
};

export default KPICards;
