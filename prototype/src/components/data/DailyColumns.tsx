import { useState, type KeyboardEvent } from "react";
import type { plantSeries } from "@/data/machines";
import { cn, formatCompact, formatLongDate, formatNumber, readToken } from "@/lib/utils";
import { ChartTooltip, niceScale, tickIndices, topRoundedRect, useElementSize, type LegendItem } from "./Chart";

type Point = ReturnType<typeof plantSeries>[number];

export const DAILY_LEGEND: LegendItem[] = [
  { label: "Acima da meta diária", shape: "rect", colorClass: "bg-chart-brand" },
  { label: "Abaixo da meta diária", shape: "rect", colorClass: "bg-chart-neutral" },
  { label: "Meta diária", shape: "dashed", colorClass: "border-chart-target" },
];

/**
 * Colunas da produção diária (dias úteis). Cada faixa de dia inteira é a
 * área de hover; dias futuros ficam vazios. Setas ← → percorrem os dias.
 */
export function DailyColumns({ series, label }: { series: Point[]; label: string }) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const pad = {
    top: readToken("--ds-space-200"),
    right: readToken("--ds-space-100"),
    bottom: readToken("--ds-space-400"),
    left: readToken("--dash-size-chart-axis"),
  };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = Math.max(0, height - pad.top - pad.bottom);
  const slot = plotW / series.length;
  const barW = Math.min(readToken("--dash-size-bar-max"), slot - readToken("--ds-space-050"));
  const radius = readToken("--ds-radius-small");

  const dailyTarget = series[0]?.dailyTarget ?? 0;
  const scale = niceScale(Math.max(dailyTarget, ...series.map((p) => p.value ?? 0)));
  const y = (v: number) => pad.top + plotH - (v / scale.max) * plotH;
  const cx = (i: number) => pad.left + slot * i + slot / 2;

  const elapsed = series.filter((p) => p.value != null);
  const above = elapsed.filter((p) => p.value! >= dailyTarget).length;
  const lastElapsed = series.reduce((idx, p, i) => (p.value != null ? i : idx), 0);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(series.length - 1, Math.max(0, (a ?? lastElapsed) + dir)));
    } else if (e.key === "Escape") setActive(null);
  };

  const labeled = tickIndices(series.length, slot, readToken("--dash-chart-label-gap") / 2);
  const current = active != null ? series[active] : null;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${label}: ${above} de ${elapsed.length} dias acima da meta diária de ${formatNumber(dailyTarget)}. Use as setas para percorrer os dias.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="relative h-chart w-full rounded-medium focus-visible:outline-offset-inset"
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden onPointerLeave={() => setActive(null)} className="block">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-current text-chart-gridline" />
              <text
                x={pad.left - readToken("--ds-space-100")}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-current font-body-small tabular-nums text-subtlest"
              >
                {formatCompact(t)}
              </text>
            </g>
          ))}

          {series.map((p, i) => {
            const isActive = active === i;
            return (
              <g key={i} onPointerEnter={() => setActive(i)}>
                {/* área de hover = a faixa inteira do dia */}
                <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} className="fill-transparent" />
                {p.value != null && p.value > 0 && (
                  <path
                    d={topRoundedRect(cx(i) - barW / 2, y(p.value), barW, y(0) - y(p.value), radius)}
                    className={cn(
                      "fill-current transition-opacity duration-hover ease-out",
                      p.value >= dailyTarget ? "text-chart-brand" : "text-chart-neutral",
                      active != null && !isActive && "opacity-disabled",
                    )}
                  />
                )}
                {labeled.has(i) && (
                  <text
                    x={cx(i)}
                    y={height - readToken("--ds-space-100")}
                    textAnchor="middle"
                    className={cn(
                      "fill-current font-body-small tabular-nums",
                      p.value == null ? "text-disabled" : "text-subtlest",
                    )}
                  >
                    {p.date.getDate()}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(dailyTarget)}
            y2={y(dailyTarget)}
            strokeWidth={readToken("--dash-chart-line")}
            className="pointer-events-none stroke-current text-chart-target"
            style={{ strokeDasharray: "var(--dash-chart-dash)" }}
          />
        </svg>
      )}

      {current && (
        <ChartTooltip
          x={cx(active!)}
          y={pad.top + plotH / 2}
          containerWidth={width}
          title={<span className="first-letter:uppercase">{formatLongDate(current.date)}</span>}
          rows={
            current.value == null
              ? [{ key: "none", value: "—", label: "dia ainda não chegou" }]
              : [
                  { key: "value", value: formatNumber(current.value), label: "produzidas" },
                  {
                    key: "pct",
                    value: `${Math.round((current.value / dailyTarget) * 100)}%`,
                    label: `da meta diária (${formatNumber(dailyTarget)})`,
                  },
                ]
          }
        />
      )}
    </div>
  );
}
