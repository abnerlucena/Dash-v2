import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { plantSeries } from "@/data/machines";
import { cn, formatCompact, formatLongDate, formatNumber, formatShortDate, readToken } from "@/lib/utils";
import { ChartTooltip, niceScale, tickIndices, useElementSize, type LegendItem } from "./Chart";

type Point = ReturnType<typeof plantSeries>[number];

export const BURNUP_LEGEND: LegendItem[] = [
  { label: "Realizado acumulado", shape: "line", colorClass: "bg-chart-brand" },
  { label: "Meta acumulada", shape: "dashed", colorClass: "border-chart-target" },
];

/**
 * Linha do acumulado do mês contra a meta acumulada (burn-up).
 * Crosshair encaixa no dia útil mais próximo; setas ← → percorrem os dias.
 */
export function BurnupChart({ series, label }: { series: Point[]; label: string }) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const pad = {
    top: readToken("--ds-space-300"),
    right: readToken("--ds-space-300"),
    bottom: readToken("--ds-space-400"),
    left: readToken("--dash-size-chart-axis"),
  };
  const lineWidth = readToken("--dash-chart-line");
  const marker = readToken("--dash-chart-marker");
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = Math.max(0, height - pad.top - pad.bottom);

  const lastActual = series.reduce((idx, p, i) => (p.cumulative != null ? i : idx), -1);
  const maxValue = Math.max(series[series.length - 1].targetCumulative, series[lastActual]?.cumulative ?? 0);
  const scale = niceScale(maxValue);
  const x = (i: number) => pad.left + (series.length > 1 ? (i / (series.length - 1)) * plotW : 0);
  const y = (v: number) => pad.top + plotH - (v / scale.max) * plotH;

  const actual = series.slice(0, lastActual + 1);
  const linePath = actual.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.cumulative!)}`).join("");
  const areaPath = actual.length
    ? `${linePath}L${x(actual.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
    : "";
  const targetPath = series.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.targetCumulative)}`).join("");

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - pad.left) / (plotW || 1);
    setActive(Math.min(series.length - 1, Math.max(0, Math.round(rel * (series.length - 1)))));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(series.length - 1, Math.max(0, (a ?? lastActual) + dir)));
    } else if (e.key === "Escape") setActive(null);
  };

  const labeled = tickIndices(series.length, plotW / Math.max(1, series.length - 1), readToken("--dash-chart-label-gap"));
  const current = active != null ? series[active] : null;
  const end = series[lastActual];
  const targetEnd = series[series.length - 1];
  const summary = end
    ? `${label}. Até ${formatShortDate(end.date)}: ${formatNumber(end.cumulative!)} realizados contra ${formatNumber(end.targetCumulative)} previstos; meta do mês ${formatNumber(targetEnd.targetCumulative)}.`
    : label;

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${summary} Use as setas para percorrer os dias.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="relative h-chart-large w-full rounded-medium focus-visible:outline-offset-inset"
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          aria-hidden
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          className="block touch-none"
        >
          {/* Grade e eixo Y: linhas finas, sólidas, recessivas */}
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
          {/* Eixo X: densidade de rótulos conforme a largura */}
          {series.map((p, i) =>
            labeled.has(i) ? (
              <text
                key={i}
                x={x(i)}
                y={height - readToken("--ds-space-100")}
                textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
                className="fill-current font-body-small text-subtlest"
              >
                {formatShortDate(p.date)}
              </text>
            ) : null,
          )}

          <path d={areaPath} className="fill-current text-chart-brand opacity-chart-area" />
          <path
            d={targetPath}
            fill="none"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-current text-chart-target"
            style={{ strokeDasharray: "var(--dash-chart-dash)" }}
          />
          <path
            d={linePath}
            fill="none"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-current text-chart-brand"
          />

          {/* Rótulos diretos nas pontas (seletivos: só o fim de cada série) */}
          {end && (
            <>
              <circle
                cx={x(lastActual)}
                cy={y(end.cumulative!)}
                r={marker}
                strokeWidth={lineWidth}
                className="fill-current stroke-surface-raised text-chart-brand"
              />
              <text
                x={x(lastActual)}
                y={y(end.cumulative!) - readToken("--ds-space-150")}
                textAnchor="middle"
                className="fill-current font-body-small font-semibold tabular-nums text-default"
              >
                {formatNumber(end.cumulative!)}
              </text>
            </>
          )}
          <text
            x={x(series.length - 1)}
            y={y(targetEnd.targetCumulative) - readToken("--ds-space-100")}
            textAnchor="end"
            className="fill-current font-body-small tabular-nums text-subtle"
          >
            Meta {formatNumber(targetEnd.targetCumulative)}
          </text>

          {/* Crosshair */}
          {current && (
            <g className="pointer-events-none">
              <line
                x1={x(active!)}
                x2={x(active!)}
                y1={pad.top}
                y2={pad.top + plotH}
                className="stroke-current text-chart-target"
              />
              <circle
                cx={x(active!)}
                cy={y(current.targetCumulative)}
                r={marker}
                strokeWidth={lineWidth}
                className="fill-current stroke-surface-raised text-chart-target"
              />
              {current.cumulative != null && (
                <circle
                  cx={x(active!)}
                  cy={y(current.cumulative)}
                  r={marker}
                  strokeWidth={lineWidth}
                  className="fill-current stroke-surface-raised text-chart-brand"
                />
              )}
            </g>
          )}
        </svg>
      )}

      {current && (
        <ChartTooltip
          x={x(active!)}
          y={pad.top + plotH / 2}
          containerWidth={width}
          title={<span className="first-letter:uppercase">{formatLongDate(current.date)}</span>}
          rows={[
            {
              key: "actual",
              value: current.cumulative != null ? formatNumber(current.cumulative) : "—",
              label: current.cumulative != null ? "realizado" : "dia ainda não chegou",
              swatch: BURNUP_LEGEND[0],
            },
            { key: "target", value: formatNumber(current.targetCumulative), label: "meta", swatch: BURNUP_LEGEND[1] },
            ...(current.cumulative != null
              ? [
                  {
                    key: "pct",
                    value: `${Math.round((current.cumulative / current.targetCumulative) * 100)}%`,
                    label: "da meta até o dia",
                  },
                ]
              : []),
          ]}
        />
      )}
      <span className={cn("sr-only")} aria-live="polite">
        {current &&
          `${formatLongDate(current.date)}: ${current.cumulative != null ? formatNumber(current.cumulative) : "sem dado"} realizado, ${formatNumber(current.targetCumulative)} meta`}
      </span>
    </div>
  );
}
