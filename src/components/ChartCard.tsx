import ReactEChartsCore from "echarts-for-react";
import { Maximize2 } from "lucide-react";
import type { EChartsOption } from "echarts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  option: EChartsOption;
  height?: number;
  onExpand?: () => void;
  /** Conteúdo extra no canto direito do header (ex: toggle de modo). Renderiza ANTES do botão Expandir. */
  headerExtra?: React.ReactNode;
}

const ChartCard = ({ title, subtitle, icon, option, height = 300, onExpand, headerExtra }: ChartCardProps) => {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ borderRadius: 12 }}>
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          {onExpand && (
            <button onClick={onExpand}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Maximize2 size={12} />
              Expandir
            </button>
          )}
        </div>
      </div>
      <div className="p-3">
        <ReactEChartsCore option={option} style={{ height }} notMerge lazyUpdate />
      </div>
    </div>
  );
};

export default ChartCard;
