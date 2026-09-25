import { useMemo } from "react";
import { STATUS_META, type Machine, type plantSeries } from "@/data/machines";
import { formatCompact, formatLongDate, formatNumber, formatShortDate, readToken } from "@/lib/utils";
import { axisStyle, baseOption, EChart, tooltipBase, tooltipHtml, useChartTheme } from "./EChart";

type Point = ReturnType<typeof plantSeries>[number];
type AxisParam = { dataIndex: number };

/** Mesmo recuo dos gráficos próprios (calha do eixo Y à esquerda). */
function grid(top: string, right: string) {
  return {
    top: readToken(top),
    right: readToken(right),
    bottom: readToken("--ds-space-400"),
    left: readToken("--dash-size-chart-axis"),
  };
}

/* ---------- Acumulado vs meta (burn-up) ---------- */
export function EBurnupChart({ series, label }: { series: Point[]; label: string }) {
  const t = useChartTheme();
  const option = useMemo(
    () => ({
      ...baseOption(t),
      grid: grid("--ds-space-300", "--ds-space-300"),
      xAxis: { type: "category", boundaryGap: false, data: series.map((p) => formatShortDate(p.date)), ...axisStyle(t), splitLine: { show: false } },
      yAxis: { type: "value", splitNumber: 4, ...axisStyle(t), axisLine: { show: false }, axisLabel: { color: t.textSubtlest, formatter: formatCompact } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.target, width: 1 } },
        formatter: (params: AxisParam[]) => {
          const p = series[params[0].dataIndex];
          return tooltipHtml(formatLongDate(p.date), [
            ...(p.cumulative != null ? [{ value: formatNumber(p.cumulative), label: "Realizado acumulado", swatch: t.brand }] : []),
            { value: formatNumber(p.targetCumulative), label: "Meta acumulada", swatch: t.target, dashed: true },
            ...(p.cumulative != null
              ? [{ value: `${Math.round((p.cumulative / p.targetCumulative) * 100)}%`, label: "da meta acumulada" }]
              : [{ value: "—", label: "dia ainda não apontado" }]),
          ]);
        },
      },
      series: [
        {
          name: "Realizado acumulado",
          type: "line",
          data: series.map((p) => p.cumulative),
          symbol: "circle",
          symbolSize: t.marker * 2,
          showSymbol: false,
          lineStyle: { width: t.line, color: t.brand },
          itemStyle: { color: t.brand },
          areaStyle: { color: t.brand, opacity: t.areaOpacity },
        },
        {
          name: "Meta acumulada",
          type: "line",
          data: series.map((p) => p.targetCumulative),
          symbol: "none",
          lineStyle: { width: t.line, color: t.target, type: t.dash },
        },
      ],
    }),
    [series, t],
  );
  return <EChart option={option} label={label} className="h-chart-large" />;
}

/* ---------- Produção diária em colunas ---------- */
export function EDailyColumns({ series, label }: { series: Point[]; label: string }) {
  const t = useChartTheme();
  const option = useMemo(() => {
    const target = series[0]?.dailyTarget ?? 0;
    return {
      ...baseOption(t),
      grid: grid("--ds-space-200", "--ds-space-100"),
      xAxis: { type: "category", data: series.map((p) => formatShortDate(p.date)), ...axisStyle(t), splitLine: { show: false } },
      yAxis: { type: "value", splitNumber: 4, ...axisStyle(t), axisLine: { show: false }, axisLabel: { color: t.textSubtlest, formatter: formatCompact } },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: t.gridline } },
        formatter: (params: AxisParam[]) => {
          const p = series[params[0].dataIndex];
          if (p.value == null) return tooltipHtml(formatLongDate(p.date), [{ value: "—", label: "dia ainda não apontado" }]);
          return tooltipHtml(formatLongDate(p.date), [
            { value: formatNumber(p.value), label: "Produção", swatch: p.value >= target ? t.brand : t.neutral },
            { value: formatNumber(target), label: "Meta diária", swatch: t.target, dashed: true },
            { value: `${Math.round((p.value / target) * 100)}%`, label: "da meta diária" },
          ]);
        },
      },
      series: [
        {
          name: "Produção",
          type: "bar",
          barMaxWidth: readToken("--dash-size-bar-max"),
          data: series.map((p) => ({
            value: p.value,
            itemStyle: { color: (p.value ?? 0) >= target ? t.brand : t.neutral, borderRadius: [t.radius, t.radius, 0, 0] },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: t.target, width: t.line, type: t.dash },
            data: [{ yAxis: target }],
          },
        },
      ],
    };
  }, [series, t]);
  return <EChart option={option} label={label} className="h-chart" />;
}

/* ---------- Atingimento por máquina (barras horizontais) ---------- */
const SCALE_MAX = 120;

export function EAttainmentBars({
  machines,
  activeId,
  onSelect,
}: {
  machines: Machine[];
  activeId?: string | null;
  onSelect: (m: Machine) => void;
}) {
  const t = useChartTheme();
  const sorted = useMemo(() => [...machines].sort((a, b) => b.percent - a.percent), [machines]);
  const option = useMemo(
    () => ({
      ...baseOption(t),
      grid: { top: readToken("--ds-space-300"), right: readToken("--ds-space-200"), bottom: 0, left: 0, containLabel: true },
      xAxis: { type: "value", max: SCALE_MAX, show: false },
      // Nome à esquerda e "77% · Atenção" numa coluna à direita (não cruza a linha da meta)
      yAxis: [
        {
          type: "category",
          inverse: true,
          data: sorted.map((m) => m.name),
          axisLine: { show: false },
          axisTick: { show: false },
          // nomes longos cortam com "…" (o nome inteiro fica no tooltip)
          axisLabel: { color: t.text, fontSize: t.fontSize + 2, width: readToken("--dash-size-bar-label-wide") / 2, overflow: "truncate" },
        },
        {
          type: "category",
          inverse: true,
          position: "right",
          data: sorted.map((m) => `${m.percent}% · ${STATUS_META[m.status].label}`),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: t.text },
        },
      ],
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: ({ dataIndex }: AxisParam) => {
          const m = sorted[dataIndex];
          return tooltipHtml(m.name, [
            { value: `${m.percent}%`, label: `da meta · ${STATUS_META[m.status].label}`, swatch: t.status[m.status] },
            { value: formatNumber(m.produced), label: `de ${formatNumber(m.target)}` },
          ]);
        },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: readToken("--dash-size-bar-max"),
          data: sorted.map((m) => ({
            value: Math.min(m.percent, SCALE_MAX),
            itemStyle: {
              color: t.status[m.status],
              borderRadius: [0, t.radius, t.radius, 0],
              borderWidth: activeId === m.id ? t.line : 0,
              borderColor: t.text,
            },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.target, width: 1, type: t.dash },
            label: { formatter: "Meta", position: "start", color: t.textSubtlest },
            data: [{ xAxis: 100 }],
          },
        },
      ],
    }),
    [sorted, activeId, t],
  );
  const height = sorted.length * readToken("--dash-size-row") + readToken("--ds-space-400");
  return (
    <EChart
      option={option}
      label="Atingimento da meta por máquina"
      onClick={({ dataIndex }) => onSelect(sorted[dataIndex])}
      style={{ height }}
    />
  );
}
