import { X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface ChartFullscreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  option?: EChartsOption;
}

const ChartFullscreen = ({ open, onClose, title, option }: ChartFullscreenProps) => {
  if (!open || !option) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 p-4">
        <ReactEChartsCore option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />
      </div>
    </div>
  );
};

export default ChartFullscreen;
