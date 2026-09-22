import { useEffect } from "react";
import { X } from "lucide-react";
import ReactEChartsCore from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Button } from "@/components/ui/button";

interface ChartFullscreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  option?: EChartsOption;
}

const ChartFullscreen = ({ open, onClose, title, option }: ChartFullscreenProps) => {
  // Esc fecha (teclado)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !option) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" autoFocus>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="flex-1 p-4">
        <ReactEChartsCore option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
      </div>
    </div>
  );
};

export default ChartFullscreen;
