import type { EChartsOption } from "echarts";
import { pctColor as pctCol } from "./api";

const C = {
  green: "#22C55E", yellow: "#F59E0B", red: "#EF4444",
  blue: "#0066B3", gray: "#6B7280", navy: "#003366",
  teal: "#0095A8", info: "#3B82F6",
};

const tooltipBase = {
  backgroundColor: '#fff',
  borderColor: '#D0DEE8',
  borderWidth: 1,
  borderRadius: 8,
  textStyle: { color: '#2D3E4E', fontSize: 12 },
  confine: true,
};

interface BarData { name: string; meta: number; producao: number; }
interface AreaData { date: string; producao: number; meta: number; }
interface PieData { name: string; value: number; }
interface HBarData { name: string; pct: number; }

export function getBarChartOption(data: BarData[], mobile: boolean): EChartsOption {
  const m = mobile;
  const fs = m ? 10 : 11;

  if (m) {
    return {
      animation: true, animationDuration: 750,
      tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Meta', 'Produção'], top: 0, right: 0, textStyle: { fontSize: fs } },
      grid: { top: 30, right: 10, bottom: 8, left: 8, containLabel: true },
      yAxis: { type: 'category', data: data.slice().reverse().map(d => d.name), axisLabel: { fontSize: fs, width: 100, overflow: 'truncate' } },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v), fontSize: fs } },
      series: [
        { name: 'Meta', type: 'bar', data: data.slice().reverse().map(d => d.meta), itemStyle: { color: C.gray, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 },
        { name: 'Produção', type: 'bar', data: data.slice().reverse().map(d => d.producao), itemStyle: { color: C.blue, borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 },
      ],
    };
  }

  return {
    animation: true, animationDuration: 750,
    tooltip: { ...tooltipBase, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.05)' } } },
    legend: { data: ['Meta', 'Produção'], top: 0, textStyle: { fontSize: fs } },
    grid: { top: 40, right: 20, bottom: 60, left: 60 },
    xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: fs, rotate: 25, interval: 0 } },
    yAxis: { type: 'value', axisLabel: { fontSize: fs, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) } },
    series: [
      { name: 'Meta', type: 'bar', data: data.map(d => d.meta), itemStyle: { color: C.gray, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 },
      { name: 'Produção', type: 'bar', data: data.map(d => d.producao), itemStyle: { color: C.blue, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 },
    ],
  };
}

export function getAreaChartOption(data: AreaData[], mobile: boolean): EChartsOption {
  const fs = mobile ? 10 : 11;
  return {
    animation: true, animationDuration: 750,
    tooltip: { ...tooltipBase, trigger: 'axis' },
    legend: {
      data: ['Produção Real', 'Meta Global', 'Meta Diária'],
      top: 0, textStyle: { fontSize: fs },
    },
    grid: { top: 40, right: 20, bottom: 40, left: mobile ? 50 : 65 },
    xAxis: { type: 'category', data: data.map(d => d.date), axisLabel: { fontSize: fs } },
    yAxis: { type: 'value', axisLabel: { fontSize: fs, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) } },
    series: [
      {
        name: 'Produção Real', type: 'line', data: data.map(d => d.producao),
        smooth: true, symbol: mobile ? 'none' : 'circle', symbolSize: 6,
        lineStyle: { color: C.blue, width: mobile ? 2 : 3 }, itemStyle: { color: C.blue },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C.blue + '44' }, { offset: 1, color: C.blue + '00' }] } },
      },
      {
        // Calculated meta: sum of all machine metas × turnos ativos
        name: 'Meta Global', type: 'line', data: data.map(d => Math.round(d.meta)),
        smooth: false, lineStyle: { color: C.navy, width: 2, type: 'dashed' },
        itemStyle: { color: C.navy }, symbol: 'none',
      },
      {
        // Fixed daily reference line
        name: 'Meta Diária', type: 'line', data: data.map(() => 60000),
        lineStyle: { color: C.red, width: 2, type: 'dashed' },
        itemStyle: { color: C.red }, symbol: 'none',
      },
    ],
  };
}

export function getPieChartOption(data: PieData[], mobile: boolean): EChartsOption {
  const colors = [C.blue, C.green, C.yellow, C.teal, C.navy];
  return {
    animation: true, animationDuration: 750,
    tooltip: { ...tooltipBase, trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: mobile ? 10 : 12 } },
    series: [{
      type: 'pie',
      radius: mobile ? ['30%', '60%'] : ['35%', '65%'],
      center: ['50%', '45%'],
      data: data.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } })),
      padAngle: 3,
      itemStyle: { borderRadius: 4 },
      label: { show: !mobile, formatter: '{b}: {d}%', fontSize: 12 },
    }],
  };
}

export function getHorizontalBarOption(data: HBarData[], mobile: boolean): EChartsOption {
  const fs = mobile ? 10 : 11;
  // data is expected pre-sorted ascending by pct (best appears at top in ECharts y-axis)
  return {
    animation: true, animationDuration: 750,
    tooltip: {
      ...tooltipBase, trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const d = params[0];
        return `<strong>${d.name}</strong><br/>${d.value}% da meta`;
      },
    },
    grid: { top: 10, right: mobile ? 50 : 65, bottom: 10, left: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: fs }, max: (v: any) => Math.max(v.max * 1.1, 110) },
    yAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: fs, width: mobile ? 70 : 130, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: mobile ? 18 : 30,
      data: data.map(d => ({
        value: d.pct,
        itemStyle: {
          color: d.pct >= 100 ? C.green : d.pct >= 80 ? C.yellow : C.red,
          borderRadius: [0, 4, 4, 0],
        },
      })),
      label: { show: true, position: 'right', formatter: (p: any) => `${p.value}%`, fontSize: fs, color: '#2D3E4E', fontWeight: 'bold' },
    }],
  };
}
