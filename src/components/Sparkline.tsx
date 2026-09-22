import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Valores em ordem cronológica (ex: % da meta por dia). */
  values: number[];
  /** Valor que representa a barra cheia (ex: 100 = meta). */
  max?: number;
  className?: string;
  label?: string;
}

/** Sparkline em barras (referência: coluna "Activity Trend"). Última barra em destaque. */
export function Sparkline({ values, max, className, label }: SparklineProps) {
  if (values.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const top = max ?? Math.max(...values, 1);
  return (
    <div
      className={cn("flex h-4 items-end gap-px", className)}
      role="img"
      aria-label={label ?? `Tendência: ${values.map(v => Math.round(v)).join(", ")}`}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px] bg-brand-text", i === values.length - 1 ? "opacity-100" : "opacity-50")}
          style={{ height: `${Math.max(12, Math.min(100, (v / top) * 100))}%` }}
        />
      ))}
    </div>
  );
}
