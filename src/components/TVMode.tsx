import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import ReactEChartsCore from "echarts-for-react";
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import WEGLogo from "./WEGLogo";
import { chartBase, axisStyle, legendStyle } from "@/lib/chart-options";
import { type ChartTheme, readChartTheme, statusColor } from "@/lib/chart-theme";
import { getAttainmentStatus, STATUS_LABEL, STATUS_THRESHOLDS, STATUS_TOKEN, withAlpha } from "@/lib/status";

/** Cor CSS (token) do status de atingimento — para estilos inline do DOM. */
const pctColor = (pct: number) => `hsl(var(${STATUS_TOKEN[getAttainmentStatus(pct)]}))`;
import type { EChartsOption } from "echarts";

// ─── Constants ─────────────────────────────────────────────────────────────────
const SLIDE_DURATION_MS = 8000;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MachAgg {
  id: number;
  name: string;
  totalProd: number;
  totalMeta: number;
  pct: number;
  days: number;
}
interface DayPoint  { date: string; producao: number; meta: number; }
interface TurnoPoint { name: string; value: number; }
interface BarPoint  { name: string; meta: number; producao: number; }
interface HBarPoint { name: string; pct: number; }

interface HeatmapPoint { dayIdx: number; machIdx: number; pct: number; machineName: string; }
interface ParetoPoint  { name: string; gap: number; cumPct: number; pct: number; }

export interface TVModeProps {
  machAgg:         MachAgg[];
  dayAgg:          DayPoint[];
  turnoAgg:        TurnoPoint[];
  barData:         BarPoint[];
  hbarData:        HBarPoint[];   // pre-sorted ascending — ECharts renders y-axis bottom→top (best at top)
  totalProd:       number;
  totalMeta:       number;
  pctGeral:        number;
  tendency:        number | null;
  heatmapData:     HeatmapPoint[];
  paretoData:      ParetoPoint[];
  heatmapMachines: string[];
  onClose:         () => void;
}

// ─── ECharts no Modo TV ─────────────────────────────────────────────────────────
// Cores vêm dos tokens do container da TV (sempre .dark) via readChartTheme(scope).
// Tamanhos de fonte maiores: leitura a 3–5 m.
const TV_FS = 16;
const kFmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v));

function tvBase(t: ChartTheme) {
  const base = chartBase(t);
  return {
    ...base,
    backgroundColor: "transparent",
    tooltip: { ...base.tooltip, textStyle: { ...base.tooltip.textStyle, fontSize: 14 } },
  };
}

function tvAxis(t: ChartTheme) {
  return axisStyle(t, TV_FS);
}

function tvHBarOption(data: HBarPoint[], t: ChartTheme): EChartsOption {
  const base = tvBase(t);
  const ax = tvAxis(t);
  return {
    ...base,
    tooltip: {
      ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } },
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return `<strong>${p.name}</strong><br/>${p.value}% da meta · ${STATUS_LABEL[getAttainmentStatus(p.value)]}`;
      },
    },
    grid: { top: 12, right: 90, bottom: 12, left: 12, containLabel: true },
    xAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: "{value}%" }, max: (v: { max: number }) => Math.max(v.max * 1.1, 115) },
    yAxis: { type: "category", data: data.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, width: 220, overflow: "truncate" } },
    series: [{
      type: "bar",
      barMaxWidth: 32,
      data: data.map(d => ({ value: d.pct, itemStyle: { color: statusColor(t, d.pct), borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: "right", formatter: (p: { value?: unknown }) => `${p.value}%`, fontSize: 18, color: t.text, fontWeight: 600 },
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { color: t.reference, type: "dashed", width: 1.5 },
        label: { formatter: "Meta", color: t.muted, fontSize: 14 },
        data: [{ xAxis: 100 }],
      },
    }],
  };
}

function tvBarOption(data: BarPoint[], t: ChartTheme): EChartsOption {
  const base = tvBase(t);
  const ax = tvAxis(t);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } } },
    legend: { ...legendStyle(t, TV_FS), data: ["Meta", "Produção"], top: 4, itemWidth: 12, itemHeight: 12 },
    grid: { top: 48, right: 24, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: data.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, interval: 0, width: 140, overflow: "break" } },
    yAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFmt } },
    series: [
      { name: "Meta", type: "bar", data: data.map(d => d.meta), itemStyle: { color: t.series[3], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 },
      { name: "Produção", type: "bar", data: data.map(d => d.producao), itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 },
    ],
  };
}

function tvAreaOption(data: DayPoint[], t: ChartTheme): EChartsOption {
  const base = tvBase(t);
  const ax = tvAxis(t);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "axis" },
    legend: { ...legendStyle(t, TV_FS), top: 4, itemWidth: 12, itemHeight: 12 },
    grid: { top: 48, right: 28, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: data.map(d => d.date), ...ax, boundaryGap: false },
    yAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFmt } },
    series: [
      {
        name: "Produção Real", type: "line",
        data: data.map(d => d.producao),
        smooth: true, symbol: "none",
        lineStyle: { color: t.series[0], width: 3 },
        itemStyle: { color: t.series[0] },
        areaStyle: { color: t.series[0], opacity: 0.15 },
      },
      {
        name: "Meta", type: "line",
        data: data.map(d => Math.round(d.meta)),
        smooth: false,
        lineStyle: { color: t.reference, width: 2, type: "dashed" },
        itemStyle: { color: t.reference },
        symbol: "none",
      },
    ],
  };
}

function tvPieOption(data: TurnoPoint[], t: ChartTheme): EChartsOption {
  // Turnos são categorias: azuis WEG (verde/amarelo ficam reservados a status)
  const colors = [t.series[0], t.series[1], t.series[2]];
  const base = tvBase(t);
  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: "item", formatter: "{b}: {c} pç ({d}%)" },
    legend: { ...legendStyle(t, 18), bottom: 12, itemWidth: 14, itemHeight: 14 },
    series: [{
      type: "pie",
      radius: ["42%", "70%"],
      center: ["50%", "46%"],
      data: data.filter(d => d.value > 0).map((d, i) => ({
        ...d,
        itemStyle: { color: colors[i % colors.length] },
        label: { show: true, formatter: "{b}\n{d}%", fontSize: 18, color: t.text, lineHeight: 24 },
        labelLine: { lineStyle: { color: t.border } },
      })),
      padAngle: 2,
      itemStyle: { borderRadius: 4, borderColor: t.surface, borderWidth: 2 },
    }],
  };
}

function tvHeatmapOption(data: HeatmapPoint[], machineNames: string[], t: ChartTheme): EChartsOption {
  const WDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const hasWeekend = data.some(d => d.dayIdx >= 5);
  const base = tvBase(t);
  const ax = tvAxis(t);
  return {
    ...base,
    tooltip: {
      ...base.tooltip, trigger: "item",
      formatter: (params: unknown) => {
        const [dIdx, mIdx, pct] = (params as { data: number[] }).data;
        return `<strong>${machineNames[mIdx]}</strong><br/>${WDAYS[dIdx]}: <strong>${pct}%</strong> da meta · ${STATUS_LABEL[getAttainmentStatus(pct)]}`;
      },
    },
    visualMap: {
      type: "piecewise", show: false, dimension: 2,
      pieces: [
        { lt: STATUS_THRESHOLDS.attention, color: t.critical },
        { gte: STATUS_THRESHOLDS.attention, lt: STATUS_THRESHOLDS.near, color: t.attention },
        { gte: STATUS_THRESHOLDS.near, lt: STATUS_THRESHOLDS.met, color: t.near },
        { gte: STATUS_THRESHOLDS.met, color: t.met },
      ],
    },
    grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: hasWeekend ? WDAYS : WDAYS.slice(0, 5), ...ax, position: "top" },
    yAxis: { type: "category", data: machineNames, ...ax, axisLabel: { ...ax.axisLabel, width: 240, overflow: "truncate" } },
    series: [{
      type: "heatmap",
      data: data.filter(d => hasWeekend || d.dayIdx < 5).map(d => [d.dayIdx, d.machIdx, d.pct]),
      // Texto na cor da superfície (navy) sobre status claros: contraste ≥ 4.5:1
      label: { show: true, fontSize: 18, fontWeight: 600, color: t.surface, formatter: (p: { value?: unknown }) => { const v = (p.value as number[])[2]; return v > 0 ? `${v}%` : ""; } },
      itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 4 },
    }],
  };
}

function tvParetoOption(data: ParetoPoint[], t: ChartTheme): EChartsOption {
  const base = tvBase(t);
  const ax = tvAxis(t);
  return {
    ...base,
    tooltip: {
      ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: t.grid } },
      formatter: (params: unknown) => {
        const list = params as Array<{ seriesName: string; name: string; value: number }>;
        const bar = list.find(p => p.seriesName === "Gap");
        const line = list.find(p => p.seriesName === "% Acum");
        if (!bar) return "";
        return `<strong>${bar.name}</strong><br/>Gap: ${bar.value.toLocaleString("pt-BR")} pç<br/>Acumulado: ${line?.value ?? 0}%`;
      },
    },
    legend: { ...legendStyle(t, TV_FS), data: ["Gap", "% Acum"], top: 4, itemWidth: 12, itemHeight: 12 },
    grid: { top: 48, right: 8, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category", data: data.map(d => d.name), ...ax, axisLabel: { ...ax.axisLabel, interval: 0, width: 140, overflow: "break" } },
    yAxis: [
      { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: kFmt } },
      { type: "value", max: 100, min: 0, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: "{value}%" } },
    ],
    series: [
      {
        name: "Gap", type: "bar", yAxisIndex: 0, barMaxWidth: 48,
        data: data.map(d => d.gap),
        itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
      },
      {
        name: "% Acum", type: "line", yAxisIndex: 1,
        data: data.map(d => d.cumPct),
        lineStyle: { color: t.text, width: 2 }, itemStyle: { color: t.text },
        symbol: "circle", symbolSize: 8,
        label: { show: true, position: "top", color: t.text, fontSize: 16, fontWeight: 600, formatter: (p: { value?: unknown }) => `${p.value}%` },
      },
    ],
  };
}

// ─── Shared micro-components ────────────────────────────────────────────────────

const KPICard = ({
  label, value, unit, color, sublabel,
}: {
  label: string; value: string; unit?: string; color: string; sublabel?: string;
}) => (
  <div style={{
    background: "hsl(var(--foreground) / 0.05)",
    border: "1px solid hsl(var(--foreground) / 0.1)",
    borderRadius: "var(--radius-xl)",
    padding: "24px 24px 20px",
    display: "flex", flexDirection: "column",
    alignItems: "flex-start", justifyContent: "space-between",
    gap: 8,
  }}>
    <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, fontWeight: 600 }}>
      {label}
    </div>
    <div>
      <div style={{ color, fontSize: 56, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {unit && (
        <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, fontWeight: 600, marginTop: 4 }}>
          {unit}
        </div>
      )}
    </div>
    {sublabel && (
      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16 }}>{sublabel}</div>
    )}
  </div>
);

/** Linha do ranking na TV: nome grande, barra de status e % + rótulo (cor nunca sozinha). */
const RankRow = ({
  rank, name, pct,
}: {
  rank: number; name: string; pct: number;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: "hsl(var(--foreground) / 0.1)", color: "hsl(var(--foreground))",
      fontSize: 18, fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {rank}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: "hsl(var(--foreground))", fontSize: 24, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </div>
      <div style={{ height: 8, background: "hsl(var(--foreground) / 0.1)", borderRadius: "var(--radius-sm)", marginTop: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "var(--radius-sm)", width: `${Math.min(pct, 100)}%`, background: pctColor(pct) }} />
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 96 }}>
      <span style={{ color: "hsl(var(--foreground))", fontSize: 32, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
      <span style={{ color: pctColor(pct), fontSize: 16, marginTop: 4 }}>● {STATUS_LABEL[getAttainmentStatus(pct)]}</span>
    </div>
  </div>
);

// ─── Slide sub-components ───────────────────────────────────────────────────────

const CHART_H = "calc(100vh - 210px)";

const SlideKPI = ({
  totalProd, totalMeta, pctGeral, tendency, machAgg,
}: {
  totalProd: number; totalMeta: number; pctGeral: number;
  tendency: number | null; machAgg: MachAgg[];
}) => {
  const sorted = machAgg.filter(m => m.totalMeta > 0).sort((a, b) => b.pct - a.pct);
  const top3 = sorted.slice(0, 3);
  const bot3 = [...sorted].reverse().slice(0, 3);
  const pctCol = pctGeral >= 100 ? "hsl(var(--success))" : pctGeral >= 80 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const TrendIcon = tendency === null ? Minus : tendency > 0 ? TrendingUp : TrendingDown;
  const trendColor = tendency === null ? "hsl(var(--muted-foreground))" : tendency > 0 ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* Row 1 — 4 KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KPICard
          label="Produção Total"
          value={totalProd.toLocaleString("pt-BR")}
          unit="peças produzidas"
          color="hsl(var(--brand-text))"
        />
        <KPICard
          label="Meta Global"
          value={totalMeta.toLocaleString("pt-BR")}
          unit="peças esperadas"
          color="hsl(var(--foreground) / 0.55)"
        />
        <KPICard
          label="% Atingimento"
          value={`${pctGeral}%`}
          unit={pctGeral >= 100 ? "meta atingida" : pctGeral >= 80 ? "dentro da faixa" : "abaixo da meta"}
          color={pctCol}
        />
        {/* Tendency card — manual layout for icon */}
        <div style={{
          background: "hsl(var(--foreground) / 0.05)",
          border: "1px solid hsl(var(--foreground) / 0.1)",
          borderRadius: "var(--radius-xl)", padding: "24px 24px 20px",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}>
          <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, fontWeight: 600 }}>
            Tendência
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <TrendIcon size={44} color={trendColor} strokeWidth={2.5} />
            <div>
              <div style={{ color: trendColor, fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
                {tendency !== null ? `${tendency > 0 ? "+" : ""}${tendency}%` : "—"}
              </div>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, marginTop: 4 }}>
                vs período anterior
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 — Top 3 / Bottom 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1 }}>
        <div style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius-xl)", padding: "24px 28px",
          display: "flex", flexDirection: "column", gap: 16, justifyContent: "space-evenly",
        }}>
          <div style={{ color: "hsl(var(--foreground))", fontSize: 20, fontWeight: 500 }}>
            Maiores atingimentos
          </div>
          {top3.length > 0
            ? top3.map((m, i) => <RankRow key={m.id} rank={i + 1} name={m.name} pct={m.pct} />)
            : <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18 }}>Sem dados suficientes</p>
          }
        </div>
        <div style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius-xl)", padding: "24px 28px",
          display: "flex", flexDirection: "column", gap: 16, justifyContent: "space-evenly",
        }}>
          <div style={{ color: "hsl(var(--foreground))", fontSize: 20, fontWeight: 500 }}>
            Precisam de atenção
          </div>
          {bot3.length > 0
            ? bot3.map((m, i) => <RankRow key={m.id} rank={i + 1} name={m.name} pct={m.pct} />)
            : <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18 }}>Sem dados suficientes</p>
          }
        </div>
      </div>
    </div>
  );
};

const SlideRanking = ({ option, data }: { option: EChartsOption; data: HBarPoint[] }) => {
  // Dynamic chart height: at least 400px, 48px per bar, capped to avoid overflow
  const chartH = Math.min(Math.max(400, data.length * 48), window.innerHeight - 220);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginBottom: 12 }}>
        Ordenado por % de atingimento da meta
      </p>
      <ReactEChartsCore option={option} style={{ height: chartH }} notMerge lazyUpdate />
    </div>
  );
};

const SlideProdVsMeta = ({ option }: { option: EChartsOption }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginBottom: 12 }}>
      Produção real acumulada vs meta estabelecida por máquina
    </p>
    <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />
  </div>
);

const SlideTendencia = ({ option }: { option: EChartsOption }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginBottom: 12 }}>
      Evolução diária da produção total no período filtrado
    </p>
    <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />
  </div>
);

const SlideTurnos = ({
  option, turnoAgg, totalProd,
}: { option: EChartsOption; turnoAgg: TurnoPoint[]; totalProd: number }) => {
  const colors = ["hsl(var(--brand-text))", "hsl(var(--success))", "hsl(var(--warning))"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, flex: 1, alignItems: "center" }}>
      <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />

      {/* Breakdown sidebar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {turnoAgg.filter(t => t.value > 0).map((t, i) => {
          const pct = totalProd > 0 ? Math.round(t.value / totalProd * 100) : 0;
          return (
            <div key={t.name} style={{
              background: "hsl(var(--foreground) / 0.05)",
              border: `1px solid ${withAlpha(colors[i % colors.length], 0.2)}`,
              borderLeft: `4px solid ${colors[i % colors.length]}`,
              borderRadius: "var(--radius-xl)", padding: "16px 20px",
            }}>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, fontWeight: 600 }}>
                {t.name}
              </div>
              <div style={{ color: colors[i % colors.length], fontSize: 36, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
                {t.value.toLocaleString("pt-BR")}
              </div>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginTop: 2 }}>
                {pct}% do total
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SlideAlertas = ({
  alertMachines, totalMachines,
}: { alertMachines: MachAgg[]; totalMachines: number }) => {
  if (alertMachines.length === 0) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
      }}>
        <CheckCircle2 size={80} color="hsl(var(--success))" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "hsl(var(--success))", fontSize: 40, fontWeight: 600 }}>Todas dentro da meta!</div>
          <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginTop: 8 }}>
            {totalMachines} máquina{totalMachines !== 1 ? "s" : ""} com performance ≥ 80%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AlertTriangle size={22} color="hsl(var(--warning))" />
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18 }}>
          <strong style={{ color: "hsl(var(--warning))" }}>{alertMachines.length}</strong> de {totalMachines} máquinas abaixo de 80% da meta
        </p>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(alertMachines.length, 3)}, 1fr)`,
        gap: 16, flex: 1,
      }}>
        {alertMachines.map(m => {
          const col = m.pct >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
          return (
            <div key={m.id} style={{
              background: withAlpha(col, 0.05),
              border: `1px solid ${withAlpha(col, 0.2)}`,
              borderTop: `3px solid ${col}`,
              borderRadius: "var(--radius-xl)", padding: "22px 24px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ color: "hsl(var(--foreground))", fontSize: 16, fontWeight: 600 }}>
                {m.name}
              </div>
              <div style={{ color: col, fontSize: 56, fontWeight: 600, lineHeight: 1 }}>
                {m.pct}%
              </div>
              <div style={{ height: 6, background: "hsl(var(--foreground) / 0.08)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(m.pct, 100)}%`,
                  background: col, borderRadius: "var(--radius-sm)",
                  transition: "width 0.8s ease",
                }} />
              </div>
              <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16 }}>
                {m.totalProd.toLocaleString("pt-BR")} / {m.totalMeta.toLocaleString("pt-BR")} pç
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SlideHeatmap = ({ option, machineCount }: { option: EChartsOption; machineCount: number }) => {
  const chartH = Math.min(Math.max(400, machineCount * 44 + 80), window.innerHeight - 240);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginBottom: 12 }}>
        % médio de atingimento de meta por máquina e dia da semana — padrões sistemáticos de performance
      </p>
      <ReactEChartsCore option={option} style={{ height: chartH }} notMerge lazyUpdate />
    </div>
  );
};

const SlidePareto = ({ option }: { option: EChartsOption }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, marginBottom: 12 }}>
      Onde concentrar atenção para recuperar o resultado global (lei 80/20)
    </p>
    <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />
  </div>
);

// ─── Main TVMode component ──────────────────────────────────────────────────────

const TVMode = ({
  machAgg, dayAgg, turnoAgg, barData, hbarData,
  totalProd, totalMeta, pctGeral, tendency,
  heatmapData, paretoData, heatmapMachines,
  onClose,
}: TVModeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // intervalRef stores the current rotation interval so manual nav can cancel & restart it
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [slide, setSlide] = useState(0);
  const [fade,  setFade]  = useState(true);
  const [clock, setClock] = useState(() => new Date());

  // Slides definition (stable — never recreated)
  const slides = useMemo(() => [
    { id: "kpi",       label: "Overview" },
    { id: "ranking",   label: "Ranking de Performance" },
    { id: "producao",  label: "Produção vs Meta" },
    { id: "tendencia", label: "Tendência Diária" },
    { id: "turnos",    label: "Distribuição por Turno" },
    { id: "alertas",   label: "Alertas de Atenção" },
    { id: "heatmap",   label: "Heatmap Dia × Máquina" },
    { id: "pareto",    label: "Pareto de Desvio" },
  ], []);

  // Pre-computed dark chart options — only recomputed when upstream data changes
  // Tema dos gráficos lido do próprio container (classe .dark), depois de montar
  const [ct, setCt] = useState<ChartTheme>(() => readChartTheme());
  useLayoutEffect(() => { if (containerRef.current) setCt(readChartTheme(containerRef.current)); }, []);

  const hbarOpt    = useMemo(() => tvHBarOption(hbarData, ct),                    [hbarData, ct]);
  const barOpt     = useMemo(() => tvBarOption(barData, ct),                      [barData, ct]);
  const areaOpt    = useMemo(() => tvAreaOption(dayAgg, ct),                      [dayAgg, ct]);
  const pieOpt     = useMemo(() => tvPieOption(turnoAgg, ct),                     [turnoAgg, ct]);
  const heatmapOpt = useMemo(() => tvHeatmapOption(heatmapData, heatmapMachines, ct), [heatmapData, heatmapMachines, ct]);
  const paretoOpt  = useMemo(() => tvParetoOption(paretoData, ct),                [paretoData, ct]);

  // Machines below 80% meta, sorted worst-first
  const alertMachines = useMemo(() =>
    machAgg.filter(m => m.totalMeta > 0 && m.pct < 80).sort((a, b) => a.pct - b.pct),
  [machAgg]);

  // ── Fullscreen + body scroll lock on mount ────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const el = containerRef.current;
    if (el) {
      try {
        if      (el.requestFullscreen)              el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        else if ((el as any).mozRequestFullScreen)    (el as any).mozRequestFullScreen();
        else if ((el as any).msRequestFullscreen)     (el as any).msRequestFullscreen();
      } catch { /* browser may deny — silently ignore */ }
    }

    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Live clock — 1s tick ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Slide rotation — cancel & restart whenever slides.length changes ────────
  const startRotation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      // Fade out → swap slide → fade in
      setFade(false);
      setTimeout(() => {
        setSlide(s => (s + 1) % slides.length);
        setFade(true);
      }, 400); // must be < SLIDE_DURATION_MS
    }, SLIDE_DURATION_MS);
  }, [slides.length]);

  useEffect(() => {
    startRotation();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startRotation]);

  // ── Manual navigation ───────────────────────────────────────────────────────
  function goTo(target: number) {
    const next = ((target % slides.length) + slides.length) % slides.length;
    setFade(false);
    setTimeout(() => {
      setSlide(next);
      setFade(true);
      startRotation(); // reset auto-rotation timer after manual nav
    }, 300);
  }

  // ── Close: exit native fullscreen, then notify parent ───────────────────────
  function handleClose() {
    try {
      if      (document.exitFullscreen)               document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen)  (document as any).webkitExitFullscreen();
      else if ((document as any).mozCancelFullScreen)   (document as any).mozCancelFullScreen();
      else if ((document as any).msExitFullscreen)      (document as any).msExitFullscreen();
    } catch { /* ignore */ }
    onClose();
  }

  const timeStr = clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = clock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    // Modo TV é sempre escuro: a classe .dark faz os tokens usarem os valores escuros
    <div
      ref={containerRef}
      className="dark bg-background font-sans text-foreground"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header style={{
        height: 70, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px",
        borderBottom: "1px solid hsl(var(--foreground) / 0.07)",
        background: "hsl(var(--weg-950) / 0.3)",
        backdropFilter: "blur(8px)",
      }}>
        {/* Left: logo + slide title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "hsl(var(--primary))", borderRadius: "var(--radius)", padding: "6px 14px", flexShrink: 0 }}>
            <WEGLogo height={22} className="text-white" />
          </div>
          <div>
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, fontWeight: 600 }}>
              Modo Apresentação · Dashboard de Produção
            </div>
            <div style={{ color: "hsl(var(--foreground))", fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>
              {slides[slide].label}
            </div>
          </div>
        </div>

        {/* Right: clock + slide counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              color: "hsl(var(--brand-text))", fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {timeStr}
            </div>
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, fontWeight: 600, textTransform: "capitalize", marginTop: 3 }}>
              {dateStr}
            </div>
          </div>
          {/* Slide indicator pill */}
          <div style={{
            background: "hsl(var(--primary) / 0.35)",
            border: "1px solid hsl(var(--brand-text) / 0.3)",
            borderRadius: "var(--radius)", padding: "8px 18px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === slide ? 20 : 7,
                  height: 7, borderRadius: "var(--radius-sm)",
                  background: i === slide ? "hsl(var(--brand-text))" : "hsl(var(--foreground) / 0.25)",
                  border: "none", cursor: "pointer",
                  transition: "all 0.3s ease",
                  padding: 0,
                }}
              />
            ))}
            <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 16, marginLeft: 6 }}>
              {slide + 1}/{slides.length}
            </span>
          </div>
        </div>
      </header>

      {/* ── SLIDE BODY ─────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, overflow: "hidden",
        padding: "20px 28px 12px",
        display: "flex", flexDirection: "column",
        opacity: fade ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
      }}>
        {slides[slide].id === "kpi"       && (
          <SlideKPI
            totalProd={totalProd} totalMeta={totalMeta}
            pctGeral={pctGeral} tendency={tendency}
            machAgg={machAgg}
          />
        )}
        {slides[slide].id === "ranking"   && <SlideRanking option={hbarOpt} data={hbarData} />}
        {slides[slide].id === "producao"  && <SlideProdVsMeta option={barOpt} />}
        {slides[slide].id === "tendencia" && <SlideTendencia option={areaOpt} />}
        {slides[slide].id === "turnos"    && (
          <SlideTurnos option={pieOpt} turnoAgg={turnoAgg} totalProd={totalProd} />
        )}
        {slides[slide].id === "alertas"   && (
          <SlideAlertas
            alertMachines={alertMachines}
            totalMachines={machAgg.filter(m => m.totalMeta > 0).length}
          />
        )}
        {slides[slide].id === "heatmap" && (
          heatmapData.length > 0
            ? <SlideHeatmap option={heatmapOpt} machineCount={heatmapMachines.length} />
            : <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 18, margin: "auto" }}>Sem dados de meta no período filtrado</div>
        )}
        {slides[slide].id === "pareto" && (
          paretoData.length > 0
            ? <SlidePareto option={paretoOpt} />
            : <div style={{ color: "hsl(var(--success))", fontSize: 28, fontWeight: 600, margin: "auto", textAlign: "center" }}>
                Parabéns! Todas as máquinas atingiram a meta no período.
              </div>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer style={{
        height: 60, flexShrink: 0,
        borderTop: "1px solid hsl(var(--foreground) / 0.07)",
        background: "hsl(var(--weg-950) / 0.3)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center",
        gap: 14, padding: "0 28px",
      }}>
        {/* Animated progress bar — key={slide} forces re-mount on every slide change, restarting animation */}
        <div style={{
          flex: 1, height: 4,
          background: "hsl(var(--foreground) / 0.1)",
          borderRadius: "var(--radius-sm)", overflow: "hidden",
        }}>
          <div
            key={slide}
            style={{
              height: "100%", width: "100%", transformOrigin: "left", borderRadius: "var(--radius-sm)",
              background: "hsl(var(--brand-text))",
              animation: `tvSlideProgress ${SLIDE_DURATION_MS}ms linear forwards`,
            }}
          />
        </div>

        {/* Prev */}
        <button
          onClick={() => goTo(slide - 1)}
          title="Slide anterior"
          style={{
            width: 48, height: 48, borderRadius: "var(--radius)",
            background: "hsl(var(--foreground) / 0.07)",
            border: "1px solid hsl(var(--foreground) / 0.14)",
            color: "hsl(var(--foreground))", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ChevronLeft size={22} />
        </button>

        {/* Next */}
        <button
          onClick={() => goTo(slide + 1)}
          title="Próximo slide"
          style={{
            width: 48, height: 48, borderRadius: "var(--radius)",
            background: "hsl(var(--foreground) / 0.07)",
            border: "1px solid hsl(var(--foreground) / 0.14)",
            color: "hsl(var(--foreground))", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ChevronRight size={22} />
        </button>

        {/* Close — always visible, high-contrast red */}
        <button
          onClick={handleClose}
          title="Sair do Modo TV"
          style={{
            height: 48, paddingInline: 22,
            borderRadius: "var(--radius)", border: "none",
            background: "hsl(var(--destructive))", color: "hsl(var(--foreground))",
            fontSize: 18, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <X size={18} />
          Fechar
        </button>
      </footer>
    </div>
  );
};

export default TVMode;
