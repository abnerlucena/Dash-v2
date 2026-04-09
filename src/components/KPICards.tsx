import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

interface KPICardsProps {
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
  recordCount: number;
  machineCount?: number;
  consecutiveDays?: number;
  appointmentRate?: number;
  tendency?: number | null;
  loading?: boolean;
}

const KPICards = ({ totalProd, totalMeta, pctGeral, recordCount, machineCount = 6, consecutiveDays = 2, appointmentRate = 50, tendency = 26, loading }: KPICardsProps) => {
  const isMobile = useIsMobile();

  const kpis = [
    { label: "Produção Total", value: totalProd.toLocaleString("pt-BR"), sub: "peças", color: "#0066B3" },
    { label: "Meta Total", value: totalMeta > 0 ? totalMeta.toLocaleString("pt-BR") : "—", sub: "peças", color: "#003366" },
    { label: "OEE Global", value: `${pctGeral}%`, sub: "eficiência ponderada", color: "#0095A8" },
    { label: "Tendência", value: tendency !== null ? `${tendency! > 0 ? '+' : ''}${tendency}%` : "—", sub: "vs mês anterior", color: "#22C55E", showArrow: tendency !== null && tendency! > 0 },
    { label: "Tx. Apontamento", value: `${appointmentRate}%`, sub: "disciplina operac.", color: "#F59E0B" },
    { label: "Dias Consecutivos", value: String(consecutiveDays), sub: pctGeral >= 90 ? "acima de 90%" : "abaixo de 90%", color: "#EF4444" },
    { label: "Registros", value: recordCount.toLocaleString("pt-BR"), sub: "lançamentos", color: "#0066B3" },
    { label: "Máquinas Ativas", value: String(machineCount), sub: `de ${machineCount}`, color: "#22C55E" },
  ];

  if (loading) {
    return (
      <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4 lg:grid-cols-8'} gap-3`}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4 lg:grid-cols-8'} gap-3`}>
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-card rounded-xl py-3 px-4 border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
          style={{ borderRadius: 12 }}
        >
          {/* Colored left border */}
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: kpi.color }} />
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
            {kpi.label}
          </span>
          <p className="text-2xl font-extrabold leading-tight flex items-center gap-1" style={{ color: kpi.color }}>
            {kpi.value}
            {kpi.showArrow && <span className="text-sm">▲</span>}
          </p>
          <span className="text-[10px] text-muted-foreground">{kpi.sub}</span>
        </div>
      ))}
    </div>
  );
};

export default KPICards;
