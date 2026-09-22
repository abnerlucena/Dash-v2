import type { EChartsOption } from "echarts";
import { type ChartTheme, statusColor } from "./chart-theme";

// Todas as cores vêm do tema (tokens CSS resolvidos) — ver lib/chart-theme.ts.
// Azuis WEG para séries/categorias; verde/amarelo/vermelho só para status.

interface BarData { name: string; meta: number; producao: number; }
interface AreaData { date: string; producao: number; meta: number; }
interface PieData { name: string; value: number; }
interface HBarData { name: string; pct: number; }
interface RetrabalhoData { name: string; normal: number; retrabalho: number; pctRetrabalho: number; }

const kFormat = (v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v));

/** Base comum: fonte, tooltip, eixos e animação curta (desligada em reduced motion). */
export function chartBase(t: ChartTheme) {
  return {
    animation: !t.reducedMotion,
    animationDuration: 250,
    animationEasing: "cubicOut" as const,
    textStyle: { fontFamily: t.fontFamily, color: t.muted },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      borderRadius: 6,
      padding: [6, 10],
      textStyle: { color: t.text, fontSize: 12, fontFamily: t.fontFamily },
      extraCssText: "box-shadow: var(--shadow-popover);",
      confine: true,
    },
  };
}

export function axisStyle(t: ChartTheme, fs: number) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { fontSize: fs, color: t.muted },
    splitLine: { lineStyle: { color: t.grid } },
  };
}

export function legendStyle(t: ChartTheme, fs: number) {
  return { icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { fontSize: fs, color: t.muted } };
}

export function getBarChartOption(data: BarData[], mobile: boolean, t: ChartTheme): EChartsOption {
  const fs = mobile ? 11 : 12;
  const base = chartBase(t);
  const ax = axisStyle(t, fs);
  // Meta em tom neutro claro (referência); Produção em azul WEG (o que importa).
  const metaColor = t.series[3];
  const prodColor = t.series[0];

  if (mobile) {
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { ...legendStyle(t, fs), data: ["Meta", "Produção"], top: 0, right: 0 },
      grid: { top: 30, right: 10, bottom: 8, left: 8, containLabel: true },
      yAxis: { type: "category", data: data.slice().reverse().map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, width: 100, overflow: "truncate" } },
      xAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFormat } },
      series: [
        { name: "Meta", type: "bar", data: data.slice().reverse().map(d => d.meta), itemStyle: { color: metaColor, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 12 },
        { name: "Produção", type: "bar", data: data.slice().reverse().map(d => d.producao), itemStyle: { color: prodColor, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 12 },
      ],
    };
  }

  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } } },
    legend: { ...legendStyle(t, fs), data: ["Meta", "Produção"], top: 0, right: 0 },
    grid: { top: 32, right: 8, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: data.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, interval: 0, width: 96, overflow: "break" } },
    yAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFormat } },
    series: [
      { name: "Meta", type: "bar", data: data.map(d => d.meta), itemStyle: { color: metaColor, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 },
      { name: "Produção", type: "bar", data: data.map(d => d.producao), itemStyle: { color: prodColor, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 },
    ],
  };
}

export function getAreaChartOption(data: AreaData[], mobile: boolean, t: ChartTheme): EChartsOption {
  const fs = mobile ? 11 : 12;
  const base = chartBase(t);
  const ax = axisStyle(t, fs);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "axis" },
    legend: { ...legendStyle(t, fs), data: ["Produção Real", "Meta Global", "Meta Diária"], top: 0 },
    grid: { top: 36, right: 12, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: data.map(d => d.date), ...ax },
    yAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFormat } },
    series: [
      {
        name: "Produção Real", type: "line", data: data.map(d => d.producao),
        smooth: true, symbol: "none",
        lineStyle: { color: t.series[0], width: 2 }, itemStyle: { color: t.series[0] },
        areaStyle: { color: t.series[0], opacity: 0.12 },
      },
      {
        // Calculated meta: sum of all machine metas × turnos ativos
        name: "Meta Global", type: "line", data: data.map(d => Math.round(d.meta)),
        smooth: false, lineStyle: { color: t.reference, width: 1, type: "dashed" },
        itemStyle: { color: t.reference }, symbol: "none",
      },
      {
        // Fixed daily reference line
        name: "Meta Diária", type: "line", data: data.map(() => 60000),
        lineStyle: { color: t.series[2], width: 1, type: "dotted" },
        itemStyle: { color: t.series[2] }, symbol: "none",
      },
    ],
  };
}

export function getPieChartOption(data: PieData[], mobile: boolean, t: ChartTheme): EChartsOption {
  // Turnos são categorias, não status: só azuis WEG + neutro.
  const colors = [t.series[0], t.series[1], t.series[2], t.series[3]];
  const base = chartBase(t);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "item", formatter: "{b}: {c} pç ({d}%)" },
    legend: { ...legendStyle(t, mobile ? 11 : 12), bottom: 0 },
    series: [{
      type: "pie",
      radius: mobile ? ["40%", "64%"] : ["48%", "70%"],
      center: ["50%", "45%"],
      data: data.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } })),
      padAngle: 2,
      itemStyle: { borderRadius: 3 },
      // Rótulos só para fatias com valor (evita "TURNO 3: 0%" sobreposto)
      label: {
        show: !mobile, fontSize: 12, color: t.muted,
        formatter: (p: { value?: unknown; name: string; percent?: number }) =>
          Number(p.value) > 0 ? `${p.name}\n${Math.round(p.percent ?? 0)}%` : "",
      },
      labelLine: { lineStyle: { color: t.border } },
    }],
  };
}

// Stacked horizontal bar — retrabalho vs produção normal por máquina.
// Espera-se que `data` venha pré-ordenado (% retrabalho descendente);
// o gráfico inverte para que o maior fique no TOPO do eixo Y.
export function getRetrabalhoOption(data: RetrabalhoData[], mobile: boolean, t: ChartTheme): EChartsOption {
  const fs = mobile ? 11 : 12;
  const base = chartBase(t);
  const ax = axisStyle(t, fs);
  // ECharts renderiza eixo Y de baixo pra cima; reverter pra colocar % maior no topo
  const reversed = data.slice().reverse();
  return {
    ...base,
    tooltip: {
      ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } },
      formatter: (params: unknown) => {
        const idx = (params as Array<{ dataIndex: number }>)[0].dataIndex;
        const d = reversed[idx];
        const total = d.normal + d.retrabalho;
        return `<strong>${d.name}</strong><br/>` +
               `Normal: <strong>${d.normal.toLocaleString("pt-BR")}</strong> pç<br/>` +
               `Retrabalho: <strong>${d.retrabalho.toLocaleString("pt-BR")}</strong> pç<br/>` +
               `Total: <strong>${total.toLocaleString("pt-BR")}</strong> pç (<strong>${d.pctRetrabalho}%</strong> retrabalho)`;
      },
    },
    legend: { ...legendStyle(t, fs), data: ["Produção Normal", "Retrabalho"], top: 0 },
    grid: { top: 30, right: mobile ? 50 : 70, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFormat } },
    yAxis: { type: "category", data: reversed.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, width: mobile ? 80 : 140, overflow: "truncate" } },
    series: [
      {
        name: "Produção Normal", type: "bar", stack: "total",
        data: reversed.map(d => d.normal),
        itemStyle: { color: t.series[0] },
        barMaxWidth: mobile ? 14 : 20,
      },
      {
        name: "Retrabalho", type: "bar", stack: "total",
        data: reversed.map(d => d.retrabalho),
        itemStyle: { color: t.attention, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: mobile ? 14 : 20,
        label: {
          show: true, position: "right", fontSize: fs, fontWeight: 500,
          color: t.text,
          formatter: (p: { dataIndex: number }) => {
            const d = reversed[p.dataIndex];
            return d.pctRetrabalho > 0 ? `${d.pctRetrabalho}%` : "";
          },
        },
      },
    ],
  };
}

export function getHorizontalBarOption(data: HBarData[], mobile: boolean, t: ChartTheme): EChartsOption {
  const fs = mobile ? 11 : 12;
  const base = chartBase(t);
  const ax = axisStyle(t, fs);
  // data is expected pre-sorted ascending by pct (best appears at top in ECharts y-axis)
  return {
    ...base,
    tooltip: {
      ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } },
      formatter: (params: unknown) => {
        const d = (params as Array<{ name: string; value: number }>)[0];
        return `<strong>${d.name}</strong><br/>${d.value}% da meta`;
      },
    },
    grid: { top: 10, right: mobile ? 44 : 56, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: "{value}%" }, max: (v: { max: number }) => Math.max(v.max * 1.1, 110) },
    yAxis: { type: "category", data: data.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, width: mobile ? 80 : 150, overflow: "truncate" } },
    series: [{
      type: "bar", barMaxWidth: mobile ? 14 : 18,
      data: data.map(d => ({
        value: d.pct,
        itemStyle: { color: statusColor(t, d.pct), borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: true, position: "right", formatter: (p: { value?: unknown }) => `${p.value}%`, fontSize: fs, color: t.text },
      // Linha de referência: 100% da meta
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { color: t.reference, type: "dashed", width: 1 },
        label: { formatter: "Meta", color: t.muted, fontSize: fs - 1 },
        data: [{ xAxis: 100 }],
      },
    }],
  };
}
