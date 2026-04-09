import ReactEChartsCore from "echarts-for-react";
import { Maximize2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EChartsOption } from "echarts";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  option: EChartsOption;
  height?: number;
  onExpand?: () => void;
}

const ChartCard = ({ title, subtitle, icon, option, height = 300, onExpand }: ChartCardProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ borderRadius: 12 }}>
      <div className="flex items-start justify-between p-4 pb-0">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {onExpand && (
          <button onClick={onExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Maximize2 size={12} />
            Expandir
          </button>
        )}
      </div>
      <div className="p-3">
        <ReactEChartsCore option={option} style={{ height }} notMerge lazyUpdate />
      </div>
    </div>
  );
};

export default ChartCard;
