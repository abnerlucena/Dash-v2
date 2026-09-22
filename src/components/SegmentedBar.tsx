import { getAttainmentStatus, STATUS_BG_CLASS } from "@/lib/status";
import { cn } from "@/lib/utils";

interface SegmentedBarProps {
  pct: number;
  segments?: number;
  className?: string;
}

/**
 * Barra segmentada de atingimento (referência: "Win probability").
 * Os segmentos preenchidos usam a cor do status; o % sempre aparece ao lado.
 */
export function SegmentedBar({ pct, segments = 10, className }: SegmentedBarProps) {
  const filled = Math.max(0, Math.min(segments, Math.round((pct / 100) * segments)));
  const color = STATUS_BG_CLASS[getAttainmentStatus(pct)];
  return (
    <div className={cn("flex gap-0.5", className)} role="img" aria-label={`${pct}% da meta`}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-[1px]", i < filled ? color : "bg-muted")} />
      ))}
    </div>
  );
}
