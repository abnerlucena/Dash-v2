import { SHIFTS, SHIFT_META, type Shift } from "@/data/machines";
import { cn, formatNumber } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LegendItem } from "./Chart";

/** Cor fixa por turno (paleta categórica validada) — a cor segue a entidade, nunca a posição */
export const SHIFT_FILL: Record<Shift, string> = {
  1: "bg-chart-categorical-1",
  2: "bg-chart-categorical-2",
  3: "bg-chart-categorical-3",
};

export const SHIFT_LEGEND: LegendItem[] = SHIFTS.map((s) => ({
  label: `${SHIFT_META[s].label} · ${SHIFT_META[s].hours}`,
  shape: "rect",
  colorClass: SHIFT_FILL[s],
}));

interface StackedBarProps {
  values: Record<Shift, number>;
  label: string;
  /** Turno em foco (filtro): os outros ficam esmaecidos */
  highlight?: Shift | null;
}

/**
 * Barra 100% empilhada por turno. Segmentos separados por 2px de superfície;
 * cada segmento tem tooltip com valor e participação.
 */
export function StackedBar({ values, label, highlight }: StackedBarProps) {
  const total = SHIFTS.reduce((s, k) => s + values[k], 0);
  const parts = SHIFTS.filter((s) => values[s] > 0);
  const share = (s: Shift) => (total ? Math.round((values[s] / total) * 100) : 0);

  return (
    <span
      role="img"
      aria-label={`${label}: ${SHIFTS.map((s) => `${SHIFT_META[s].label} ${share(s)}%`).join(", ")}`}
      className="flex h-150 w-stacked-bar gap-025"
    >
      {parts.map((s, i) => (
        <Tooltip
          key={s}
          content={
            <span className="flex flex-col">
              <span className="font-semibold tabular-nums">
                {formatNumber(values[s])} · {share(s)}%
              </span>
              <span>{SHIFT_META[s].label}</span>
            </span>
          }
        >
          <span
            aria-hidden
            className={cn(
              "h-full transition-opacity duration-hover ease-out",
              SHIFT_FILL[s],
              i === 0 && "rounded-l-small",
              i === parts.length - 1 && "rounded-r-small",
              highlight && highlight !== s && "opacity-disabled",
            )}
            style={{ flexGrow: values[s], flexBasis: 0 }}
          />
        </Tooltip>
      ))}
    </span>
  );
}
