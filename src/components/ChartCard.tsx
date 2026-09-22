import ReactEChartsCore from "echarts-for-react";
import { Maximize2 } from "lucide-react";
import type { EChartsOption } from "echarts";
import { Button } from "@/components/ui/button";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  option: EChartsOption;
  height?: number;
  onExpand?: () => void;
  /** Conteúdo extra no canto direito do header (ex: toggle de modo). Renderiza ANTES do botão Expandir. */
  headerExtra?: React.ReactNode;
  /** Número de destaque abaixo do subtítulo (padrão "título · subtítulo · número"). */
  highlight?: React.ReactNode;
}

const ChartCard = ({ title, subtitle, icon, option, height = 300, onExpand, headerExtra, highlight }: ChartCardProps) => {
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-label={title}>
      <header className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {highlight && <div className="mt-3">{highlight}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerExtra}
          {onExpand && (
            <Button variant="ghost" size="sm" onClick={onExpand} aria-label={`Expandir ${title}`}>
              <Maximize2 aria-hidden="true" />
              <span className="hidden sm:inline">Expandir</span>
            </Button>
          )}
        </div>
      </header>
      <div className="p-2 pt-3">
        <ReactEChartsCore option={option} style={{ height }} notMerge lazyUpdate />
      </div>
    </section>
  );
};

export default ChartCard;
