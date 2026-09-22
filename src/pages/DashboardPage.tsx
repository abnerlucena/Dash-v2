import { useState, useMemo, Fragment } from "react";
import type { EChartsOption } from "echarts";
import { Activity, BarChart3, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { TURNOS, fmt, today } from "@/lib/api";
import { getBarChartOption, getPieChartOption, getHorizontalBarOption, getRetrabalhoOption, chartBase, axisStyle, legendStyle } from "@/lib/chart-options";
import { useChartTheme } from "@/lib/chart-theme";
import { getAttainmentStatus, STATUS_BG_CLASS, STATUS_LABEL, STATUS_THRESHOLDS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/StatusChip";
import { SegmentedBar } from "@/components/SegmentedBar";

import WEGHeader from "@/components/WEGHeader";
import BottomNav, { type TabId } from "@/components/BottomNav";
import KPICards from "@/components/KPICards";
import FilterBar from "@/components/FilterBar";
import ChartCard from "@/components/ChartCard";
import ChartFullscreen from "@/components/ChartFullscreen";
import MachineTable from "@/components/MachineTable";
import ProductionEntry from "@/components/ProductionEntry";
import ReportsTab from "@/components/ReportsTab";
import AdminPanel from "@/components/AdminPanel";
import MachineCardMobile from "@/components/MachineCardMobile";
import MobileDetailCards from "@/components/MobileDetailCards";
import MetasTab from "@/components/MetasTab";
import FeedbacksTab from "@/components/FeedbacksTab";
import TVMode from "@/components/TVMode";
import OnboardingPresentation from "@/components/OnboardingPresentation";

type DashboardSubTab = "resumo" | "detalhado" | "turnos" | "graficos";

// Static — defined outside component so they're never recreated on re-render
const MAIN_TABS: { id: TabId; label: string }[] = [
  { id: "entry", label: "Apontamento" },
  { id: "dashboard", label: "Dashboard" },
  { id: "history", label: "Histórico" },
  { id: "metas", label: "Metas" },
  { id: "feedbacks", label: "Feedbacks" },
];
const SUB_TABS: { id: DashboardSubTab; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "detalhado", label: "Detalhado" },
  { id: "turnos", label: "Turnos" },
  { id: "graficos", label: "Gráficos" },
];

const DashboardPage = () => {
  const { user, machines, metas, records, holidays, loading, turnosAtivos, setTurnosAtivos, needsOnboarding, completeOnboarding } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [dashSubTab, setDashSubTab] = useState<DashboardSubTab>("resumo");
  const [selectedTurno, setSelectedTurno] = useState("TODOS");
  const [selectedMachine, setSelectedMachine] = useState("TODAS");
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTV,    setShowTV]    = useState(false);
  const [showTour,  setShowTour]  = useState(false);
  const [expandedDetalhado, setExpandedDetalhado] = useState<string | null>(null);
  // Modo do gráfico de tendência: produção diária (ruidosa) vs. média móvel 7d (suavizada)
  const [trendMode, setTrendMode] = useState<"daily" | "ma7">("ma7");

  // Date range — default to last 30 days
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return fmt(d);
  });
  const [dateTo, setDateTo] = useState(() => today());

  // Exclude holiday/annulled dates from all calculations
  const validRecords = useMemo(() => {
    if (!holidays.length) return records;
    const holidayDates = new Set(holidays.map(h => h.date));
    return records.filter(r => !holidayDates.has(r.date));
  }, [records, holidays]);

  const filteredRecords = useMemo(() => {
    return validRecords.filter(r => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo   && r.date > dateTo)   return false;
      if (selectedTurno !== "TODOS"  && r.turno       !== selectedTurno)   return false;
      if (selectedMachine !== "TODAS" && r.machineName !== selectedMachine) return false;
      return true;
    });
  }, [validRecords, selectedTurno, selectedMachine, dateFrom, dateTo]);

  // When a single turno is selected, meta multiplier = 1 (not turnosAtivos)
  const turnoMultiplier = selectedTurno === "TODOS" ? turnosAtivos : 1;

  const machineAgg = useMemo(() => {
    const agg: Record<number, { totalProd: number; days: Set<string> }> = {};
    for (const r of filteredRecords) {
      if (!agg[r.machineId]) agg[r.machineId] = { totalProd: 0, days: new Set() };
      agg[r.machineId].totalProd += r.producao;
      agg[r.machineId].days.add(r.date);
    }
    return machines.map(m => {
      const a = agg[m.id];
      const totalProd = a?.totalProd ?? 0;
      const dayCount  = a?.days.size ?? 0;
      const metaTurno = metas[m.id] ?? m.defaultMeta;
      // Meta = meta/turno × turnos aplicáveis × dias com apontamento
      const totalMeta = metaTurno * turnoMultiplier * dayCount;
      const pct = totalMeta > 0 ? Math.round(totalProd / totalMeta * 100) : 0;
      return { id: m.id, name: m.name, totalProd, totalMeta, pct, days: dayCount };
    });
  }, [filteredRecords, machines, metas, turnoMultiplier]);

  const dayAgg = useMemo(() => {
    const agg: Record<string, { totalProd: number }> = {};
    for (const r of filteredRecords) {
      if (!agg[r.date]) agg[r.date] = { totalProd: 0 };
      agg[r.date].totalProd += r.producao;
    }
    // Meta diária: only machines that appear in filtered records (respects machine filter)
    const filteredMachineIds = new Set(filteredRecords.map(r => r.machineId));
    const dailyMeta = machines
      .filter(m => filteredMachineIds.has(m.id))
      .reduce((s, m) => s + (metas[m.id] ?? m.defaultMeta) * turnoMultiplier, 0);
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date: date.slice(5), producao: d.totalProd, meta: dailyMeta }));
  }, [filteredRecords, machines, metas, turnoMultiplier]);

  // Pie respects all active filters
  const turnoAgg = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const r of filteredRecords) { agg[r.turno] = (agg[r.turno] ?? 0) + r.producao; }
    return TURNOS.map(t => ({ name: t, value: agg[t] ?? 0 }));
  }, [filteredRecords]);

  const { totalProd, totalMeta, pctGeral } = useMemo(() => {
    const totalProd = machineAgg.reduce((s, m) => s + m.totalProd, 0);
    const totalMeta = machineAgg.reduce((s, m) => s + m.totalMeta, 0);
    return { totalProd, totalMeta, pctGeral: totalMeta > 0 ? Math.round(totalProd / totalMeta * 100) : 0 };
  }, [machineAgg]);

  // Tx. Apontamento: % de combos (máquina × data × turno) preenchidos vs possível
  const appointmentRate = useMemo(() => {
    const uniqueDates = new Set(filteredRecords.map(r => r.date));
    if (uniqueDates.size === 0 || machines.length === 0) return 0;
    const machineCountForRate = selectedMachine !== "TODAS" ? 1 : machines.length;
    const turnoCount = selectedTurno === "TODOS" ? TURNOS.length : 1;
    const possible = machineCountForRate * uniqueDates.size * turnoCount;
    const actual = new Set(filteredRecords.map(r => `${r.machineId}_${r.date}_${r.turno}`)).size;
    return Math.round(Math.min(actual / possible, 1) * 100);
  }, [filteredRecords, machines, selectedTurno, selectedMachine]);

  // Dias consecutivos: sequência de dias mais recentes onde produção diária ≥ 90 % da meta
  const consecutiveDays = useMemo(() => {
    const dailyMeta = machines.reduce((s, m) => s + (metas[m.id] ?? m.defaultMeta) * turnoMultiplier, 0);
    if (dailyMeta === 0) return 0;
    const byDate: Record<string, number> = {};
    for (const r of filteredRecords) { byDate[r.date] = (byDate[r.date] ?? 0) + r.producao; }
    const sorted = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); // newest first
    let streak = 0;
    for (const date of sorted) {
      if (byDate[date] / dailyMeta >= 0.9) streak++;
      else break;
    }
    return streak;
  }, [filteredRecords, machines, metas, turnoMultiplier]);

  // Máquinas ativas no período filtrado
  const activeMachineCount = useMemo(() =>
    new Set(filteredRecords.map(r => r.machineId)).size,
  [filteredRecords]);

  // Tendência: compara produção do período atual vs período anterior de mesmo tamanho.
  // Só calculada quando o intervalo selecionado tem mais de 30 dias.
  const tendency = useMemo((): number | null => {
    if (!dateFrom || !dateTo) return null;
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD   = new Date(dateTo   + "T00:00:00");
    const spanMs = toD.getTime() - fromD.getTime();
    const spanDays = Math.round(spanMs / 86_400_000);
    if (spanDays < 30) return null;

    const prevToD   = new Date(fromD.getTime() - 86_400_000);          // dia anterior ao início atual
    const prevFromD = new Date(prevToD.getTime() - spanMs);             // mesmo intervalo para trás
    const prevFrom  = fmt(prevFromD);
    const prevTo    = fmt(prevToD);

    // Use validRecords (holiday-excluded) to match how current period is computed
    const prevRecords = validRecords.filter(r => {
      if (r.date < prevFrom || r.date > prevTo) return false;
      if (selectedTurno   !== "TODOS"  && r.turno       !== selectedTurno)   return false;
      if (selectedMachine !== "TODAS"  && r.machineName !== selectedMachine) return false;
      return true;
    });

    const currTotal = filteredRecords.reduce((s, r) => s + r.producao, 0);
    const prevTotal = prevRecords.reduce((s, r) => s + r.producao, 0);
    if (prevTotal === 0) return null;
    return Math.round((currTotal - prevTotal) / prevTotal * 100);
  }, [dateFrom, dateTo, filteredRecords, validRecords, selectedTurno, selectedMachine]);

  const barData = useMemo(() =>
    machineAgg.filter(m => m.totalMeta > 0 || m.totalProd > 0).map(m => ({ name: m.name, meta: m.totalMeta, producao: m.totalProd })),
  [machineAgg]);

  // Sort ascending so best pct appears at top of horizontal bar chart (ECharts renders y-axis bottom→top)
  const hbarData = useMemo(() =>
    machineAgg.filter(m => m.totalMeta > 0).map(m => ({ name: m.name, pct: m.pct })).sort((a, b) => a.pct - b.pct),
  [machineAgg]);

  // Cores dos gráficos vêm dos tokens (claro/escuro) — recalculadas ao trocar o tema
  const ct = useChartTheme();

  const barOption  = useMemo(() => getBarChartOption(barData, isMobile, ct),        [barData, isMobile, ct]);
  const pieOption  = useMemo(() => getPieChartOption(turnoAgg, isMobile, ct),        [turnoAgg, isMobile, ct]);
  const hbarOption = useMemo(() => getHorizontalBarOption(hbarData, isMobile, ct),   [hbarData, isMobile, ct]);

  // Fullscreen options — always isMobile=false, derived from already-memoized data
  const barOptionFs  = useMemo(() => getBarChartOption(barData, false, ct),          [barData, ct]);
  const hbarOptionFs = useMemo(() => getHorizontalBarOption(hbarData, false, ct),    [hbarData, ct]);
  const pieOptionFs  = useMemo(() => getPieChartOption(turnoAgg, false, ct),         [turnoAgg, ct]);

  // Sparkline da MachineTable: % da meta por dia (últimos 14 dias com apontamento) por máquina.
  // Só apresentação — usa a mesma meta/turno × turnos aplicáveis do machineAgg.
  const machineTrend = useMemo(() => {
    const byMachineDay: Record<number, Record<string, number>> = {};
    for (const r of filteredRecords) {
      const m = (byMachineDay[r.machineId] ??= {});
      m[r.date] = (m[r.date] ?? 0) + r.producao;
    }
    const out: Record<number, number[]> = {};
    for (const mach of machines) {
      const days = byMachineDay[mach.id];
      const dailyMeta = (metas[mach.id] ?? mach.defaultMeta) * turnoMultiplier;
      if (!days || dailyMeta <= 0) continue;
      out[mach.id] = Object.keys(days).sort().slice(-14).map(d => Math.round((days[d] / dailyMeta) * 100));
    }
    return out;
  }, [filteredRecords, machines, metas, turnoMultiplier]);

  // Top 3 best and worst
  const { top3, bottom3 } = useMemo(() => {
    const sorted = [...machineAgg].filter(m => m.totalMeta > 0).sort((a, b) => b.pct - a.pct);
    return { top3: sorted.slice(0, 3), bottom3: [...sorted].reverse().slice(0, 3) };
  }, [machineAgg]);

  // Per-machine turno breakdown — precomputed so "Turnos" tab renders in O(1) per row
  const turnoBreakdown = useMemo(() => {
    const map: Record<number, { t1: number; t2: number; t3: number; total: number; best: string }> = {};
    for (const r of filteredRecords) {
      if (!map[r.machineId]) map[r.machineId] = { t1: 0, t2: 0, t3: 0, total: 0, best: "TURNO 1" };
      const entry = map[r.machineId];
      if (r.turno === "TURNO 1") entry.t1 += r.producao;
      else if (r.turno === "TURNO 2") entry.t2 += r.producao;
      else if (r.turno === "TURNO 3") entry.t3 += r.producao;
      entry.total += r.producao;
    }
    for (const entry of Object.values(map)) {
      entry.best = entry.t1 >= entry.t2 && entry.t1 >= entry.t3 ? "TURNO 1"
                 : entry.t2 >= entry.t1 && entry.t2 >= entry.t3 ? "TURNO 2" : "TURNO 3";
    }
    return map;
  }, [filteredRecords]);

  // ── Analytics useMemos ──────────────────────────────────────────────────────

  // Machine names for heatmap Y-axis (only machines with data in period)
  const heatmapMachines = useMemo(() =>
    machineAgg.filter(m => m.totalProd > 0 || m.totalMeta > 0).map(m => m.name),
  [machineAgg]);

  // Heatmap: [dayIdx (Mon=0..Sun=6), machIdx, avgPct]
  const heatmapData = useMemo(() => {
    const machineIdx = new Map(heatmapMachines.map((n, i) => [n, i]));
    // getDay() returns 0=Sun…6=Sat; remap so Mon=0…Sun=6
    const dowRemap = [6, 0, 1, 2, 3, 4, 5];
    const agg: Record<string, { sumPct: number; count: number; machineName: string }> = {};
    for (const r of filteredRecords) {
      if (!r.meta || r.meta <= 0) continue;
      const midx = machineIdx.get(r.machineName);
      if (midx === undefined) continue;
      const dow = new Date(r.date + "T12:00:00").getDay();
      const didx = dowRemap[dow];
      const key = `${midx}_${didx}`;
      if (!agg[key]) agg[key] = { sumPct: 0, count: 0, machineName: r.machineName };
      agg[key].sumPct += (r.producao / r.meta) * 100;
      agg[key].count += 1;
    }
    return Object.entries(agg).map(([key, v]) => {
      const [machIdxN, dayIdx] = key.split("_").map(Number);
      return { dayIdx, machIdx: machIdxN, pct: Math.round(v.sumPct / v.count), machineName: v.machineName };
    });
  }, [filteredRecords, heatmapMachines]);

  const heatmapOption = useMemo((): EChartsOption => {
    const WDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    // Só mostra fim de semana se houver apontamento em sáb/dom
    const hasWeekend = heatmapData.some(d => d.dayIdx >= 5);
    const days = hasWeekend ? WDAYS : WDAYS.slice(0, 5);
    const base = chartBase(ct);
    const ax = axisStyle(ct, 12);
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: "item",
        formatter: (params: unknown) => {
          const [dIdx, mIdx, pct] = (params as { data: number[] }).data;
          return `<strong>${heatmapMachines[mIdx]}</strong><br/>${WDAYS[dIdx]}: <strong>${pct}%</strong> da meta · ${STATUS_LABEL[getAttainmentStatus(pct)]}`;
        },
      },
      // Mesma escala de status do resto do app (faixas, não gradiente contínuo)
      visualMap: {
        type: "piecewise", show: false, dimension: 2,
        pieces: [
          { lt: STATUS_THRESHOLDS.attention, color: ct.critical },
          { gte: STATUS_THRESHOLDS.attention, lt: STATUS_THRESHOLDS.near, color: ct.attention },
          { gte: STATUS_THRESHOLDS.near, lt: STATUS_THRESHOLDS.met, color: ct.near },
          { gte: STATUS_THRESHOLDS.met, color: ct.met },
        ],
      },
      grid: { top: 8, right: 8, bottom: 8, left: 8, containLabel: true },
      xAxis: { type: "category", data: days, ...ax, position: "top", splitArea: { show: false } },
      yAxis: { type: "category", data: heatmapMachines, ...ax, axisLabel: { ...ax.axisLabel, width: 150, overflow: "truncate" } },
      series: [{
        type: "heatmap",
        data: heatmapData.filter(d => hasWeekend || d.dayIdx < 5).map(d => [d.dayIdx, d.machIdx, d.pct]),
        // Texto na cor da superfície: branco sobre status escuro (claro) e navy sobre status claro (escuro), ≥ 4.5:1
        label: { show: true, fontSize: 12, fontWeight: 500, color: ct.surface, formatter: (p: { value?: unknown }) => { const v = (p.value as number[])[2]; return v > 0 ? `${v}%` : ""; } },
        itemStyle: { borderColor: ct.surface, borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: ct.text } },
      }],
    };
  }, [heatmapData, heatmapMachines, ct]);

  // Pareto: máquinas ordenadas por gap (meta - prod) descendente + % acumulado.
  // totalGap é constante — calculado uma vez fora do map. cumPct usa running sum
  // para evitar O(n²) (era recomputado a cada item antes).
  const paretoData = useMemo(() => {
    const sorted = machineAgg
      .map(m => ({ name: m.name, gap: Math.max(0, m.totalMeta - m.totalProd), pct: m.pct }))
      .filter(m => m.gap > 0)
      .sort((a, b) => b.gap - a.gap);
    const totalGap = sorted.reduce((s, x) => s + x.gap, 0);
    let running = 0;
    return sorted.map(m => {
      running += m.gap;
      return { ...m, cumPct: totalGap > 0 ? Math.round((running / totalGap) * 100) : 0 };
    });
  }, [machineAgg]);

  const paretoOption = useMemo((): EChartsOption => {
    const base = chartBase(ct);
    const ax = axisStyle(ct, 12);
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: ct.grid } } },
      legend: { ...legendStyle(ct, 12), data: ["Gap (pç)", "% Acumulado"], top: 0, right: 0 },
      grid: { top: 36, right: 8, bottom: 8, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: paretoData.map(d => d.name),
        ...ax,
        axisLabel: { ...ax.axisLabel, interval: 0, width: 96, overflow: "break" },
      },
      yAxis: [
        { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) } },
        { type: "value", max: 100, min: 0, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: "{value}%" } },
      ],
      series: [
        {
          // Gap é volume (categoria), não status: azul WEG
          name: "Gap (pç)", type: "bar", yAxisIndex: 0, barMaxWidth: 28,
          data: paretoData.map(d => d.gap),
          itemStyle: { color: ct.series[0], borderRadius: [3, 3, 0, 0] },
        },
        {
          name: "% Acumulado", type: "line", yAxisIndex: 1,
          data: paretoData.map(d => d.cumPct),
          lineStyle: { color: ct.text, width: 1.5 }, itemStyle: { color: ct.text },
          symbol: "circle", symbolSize: 5,
        },
      ],
    };
  }, [paretoData, ct]);

  // Trend: daily production + 7-day moving average + daily meta
  const trendData = useMemo(() =>
    dayAgg.map((d, i, arr) => {
      const win = arr.slice(Math.max(0, i - 6), i + 1);
      return { ...d, ma7: Math.round(win.reduce((s, x) => s + x.producao, 0) / win.length) };
    }),
  [dayAgg]);

  const trendOption = useMemo((): EChartsOption => {
    // Series base (Meta sempre visível). Produção alterna entre diária crua e MA-7d.
    const isDaily = trendMode === "daily";
    const area = { color: ct.series[0], opacity: 0.12 };
    const prodSeries = isDaily
      ? {
          name: "Produção Diária", type: "line" as const, symbol: "circle" as const, symbolSize: 4,
          data: trendData.map(d => d.producao),
          lineStyle: { color: ct.series[0], width: 1.5 },
          itemStyle: { color: ct.series[0] },
          areaStyle: area,
        }
      : {
          name: "Média 7d", type: "line" as const, symbol: "none" as const, smooth: true,
          data: trendData.map(d => d.ma7),
          lineStyle: { color: ct.series[0], width: 2 },
          itemStyle: { color: ct.series[0] },
          areaStyle: area,
        };
    const base = chartBase(ct);
    const ax = axisStyle(ct, 12);
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis" },
      legend: { ...legendStyle(ct, 12), data: [prodSeries.name, "Meta"], top: 0, right: 0 },
      grid: { top: 32, right: 8, bottom: 8, left: 8, containLabel: true },
      xAxis: { type: "category", data: trendData.map(d => d.date), ...ax, boundaryGap: false },
      yAxis: { type: "value", ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) } },
      series: [
        prodSeries,
        {
          name: "Meta", type: "line", symbol: "none",
          data: trendData.map(d => d.meta),
          lineStyle: { color: ct.reference, width: 1, type: "dashed" },
          itemStyle: { color: ct.reference },
        },
      ],
    };
  }, [trendData, trendMode, ct]);

  // Radar: top 8 machines — % meta, consistency, relative production
  const radarData = useMemo(() => {
    const top8 = [...machineAgg].sort((a, b) => b.totalProd - a.totalProd).slice(0, 8);
    const maxProd = Math.max(...top8.map(m => m.totalProd), 1);
    return top8.map(m => {
      const machRecords = filteredRecords.filter(r => r.machineId === m.id && r.meta > 0);
      const uniqueDates = [...new Set(machRecords.map(r => r.date))];
      const dayProdMap: Record<string, number> = {};
      for (const r of machRecords) dayProdMap[r.date] = (dayProdMap[r.date] ?? 0) + r.producao;
      const metaPerDay = (metas[m.id] ?? 0) * turnoMultiplier;
      const daysAbove = uniqueDates.filter(d => metaPerDay > 0 && (dayProdMap[d] ?? 0) >= metaPerDay).length;
      const consistency = uniqueDates.length > 0 ? Math.round((daysAbove / uniqueDates.length) * 100) : 0;
      return { name: m.name, values: [Math.min(m.pct, 100), consistency, Math.round((m.totalProd / maxProd) * 100)] };
    });
  }, [machineAgg, filteredRecords, metas, turnoMultiplier]);

  const radarOption = useMemo((): EChartsOption => {
    // Muitas séries sobrepostas ficam ilegíveis: destaca a de maior produção (azul WEG)
    // e deixa as demais em neutro; passar o mouse na legenda destaca cada uma.
    const base = chartBase(ct);
    return {
      ...base,
      tooltip: { ...base.tooltip, trigger: "item" },
      legend: { ...legendStyle(ct, 12), data: radarData.map(d => d.name), bottom: 0, type: "scroll", pageTextStyle: { color: ct.muted } },
      radar: {
        indicator: [
          { name: "% Meta", max: 100 },
          { name: "Consistência", max: 100 },
          { name: "Prod. Relativa", max: 100 },
        ],
        radius: "60%", center: ["50%", "45%"],
        axisName: { fontSize: 12, color: ct.muted },
        splitLine: { lineStyle: { color: ct.grid } },
        axisLine: { lineStyle: { color: ct.grid } },
        splitArea: { show: false },
      },
      series: [{
        type: "radar",
        emphasis: { focus: "self", lineStyle: { width: 2.5 } },
        data: radarData.map((m, i) => {
          const c = i === 0 ? ct.series[0] : ct.series[3];
          return {
            name: m.name,
            value: m.values,
            lineStyle: { color: c, width: i === 0 ? 2 : 1 },
            itemStyle: { color: c },
            areaStyle: { color: c, opacity: i === 0 ? 0.15 : 0.03 },
            symbol: "circle", symbolSize: 3,
          };
        }),
      }],
    };
  }, [radarData, ct]);

  // ── Retrabalho por máquina ──────────────────────────────────────────────────
  // Agrega quantidade normal vs retrabalho por máquina, somando todas as ordens de
  // produção de filteredRecords. Ignora máquinas sem produção. Ordena por % retrabalho
  // descendente (problema fica no topo) — chart-option inverte para colocar no topo do eixo.
  const retrabalhoData = useMemo(() => {
    const agg: Record<string, { normal: number; retrabalho: number }> = {};
    for (const r of filteredRecords) {
      const ops = r.ordensProducao || [];
      if (ops.length === 0) continue;
      if (!agg[r.machineName]) agg[r.machineName] = { normal: 0, retrabalho: 0 };
      for (const o of ops) {
        const q = o.quantidade || 0;
        if (q <= 0) continue;
        if (o.retrabalho) agg[r.machineName].retrabalho += q;
        else agg[r.machineName].normal += q;
      }
    }
    return Object.entries(agg)
      .map(([name, v]) => {
        const total = v.normal + v.retrabalho;
        return {
          name,
          normal: v.normal,
          retrabalho: v.retrabalho,
          pctRetrabalho: total > 0 ? Math.round((v.retrabalho / total) * 100) : 0,
        };
      })
      .filter(d => d.normal + d.retrabalho > 0)
      .sort((a, b) => b.pctRetrabalho - a.pctRetrabalho);
  }, [filteredRecords]);

  const retrabalhoOption = useMemo(() => getRetrabalhoOption(retrabalhoData, isMobile, ct), [retrabalhoData, isMobile, ct]);
  const retrabalhoOptionFs = useMemo(() => getRetrabalhoOption(retrabalhoData, false, ct), [retrabalhoData, ct]);

  const subTabs = (
    <div role="tablist" aria-label="Visão do dashboard" className="inline-flex items-center rounded-md border bg-card p-0.5">
      {SUB_TABS.map(st => (
        <button
          key={st.id}
          role="tab"
          aria-selected={dashSubTab === st.id}
          onClick={() => setDashSubTab(st.id)}
          className={cn(
            "h-7 rounded-sm px-3 text-sm transition-colors duration-fast",
            dashSubTab === st.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {st.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <WEGHeader onAdminClick={() => setShowAdmin(true)} onTVClick={() => setShowTV(true)} onTourClick={() => setShowTour(true)} />

      {/* Desktop main tab nav — abas em texto simples com sublinhado (referência) */}
      {!isMobile && (
        <div className="border-b bg-card">
          <div className="mx-auto max-w-[1400px] px-4">
            <nav role="tablist" aria-label="Seções" className="flex items-center gap-5 overflow-x-auto">
              {MAIN_TABS.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "relative h-11 whitespace-nowrap text-sm transition-colors duration-fast",
                    activeTab === t.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {activeTab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-sm bg-primary" aria-hidden="true" />}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Troca de aba é instantânea: ação frequente não anima (emil-design-eng) */}
      <main className={cn("mx-auto max-w-[1400px] space-y-4 px-4 py-4", isMobile && "pb-24")}>
            {/* ── APONTAMENTO ── */}
            {activeTab === "entry" && <ProductionEntry />}

            {/* ── DASHBOARD ── */}
            {activeTab === "dashboard" && (
              <div className="space-y-4">
                {/* Filtros em pílulas + visão à direita */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FilterBar
                    dateFrom={dateFrom} setDateFrom={setDateFrom}
                    dateTo={dateTo} setDateTo={setDateTo}
                    machine={selectedMachine} setMachine={setSelectedMachine}
                    turno={selectedTurno} setTurno={setSelectedTurno}
                    machines={machines}
                  />
                  <div className="max-w-full overflow-x-auto">{subTabs}</div>
                </div>

                {/* KPI Cards */}
                <KPICards totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} recordCount={filteredRecords.length} activeMachineCount={activeMachineCount} totalMachineCount={machines.length} appointmentRate={appointmentRate} consecutiveDays={consecutiveDays} tendency={tendency} loading={loading} />

                {dashSubTab === "resumo" && (
                  <div className="space-y-4">
                    {/* Maiores atingimentos × precisam de atenção */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <RankList title="Maiores atingimentos" subtitle="Máquinas com maior % da meta no período" items={top3} />
                      <RankList title="Precisam de atenção" subtitle="Máquinas com menor % da meta no período" items={bottom3} />
                    </div>

                    {/* Tabela de máquinas */}
                    <section aria-labelledby="machines-title" className="space-y-2">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <h2 id="machines-title" className="text-sm font-medium">Máquinas</h2>
                          <p className="text-xs text-muted-foreground">Produção, meta e tendência dos últimos 14 dias apontados</p>
                        </div>
                        <Button variant="outline" size="sm">
                          <FileText aria-hidden="true" />
                          Exportar
                        </Button>
                      </div>
                      {loading ? <DetailsSkeleton isMobile={isMobile} /> :
                        isMobile ? <MobileDetailCards machines={machineAgg} totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} /> :
                        <MachineTable machines={machineAgg} totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} trend={machineTrend} recordCount={filteredRecords.length} />
                      }
                    </section>
                  </div>
                )}

                {dashSubTab === "detalhado" && (
                  <div>
                    {loading ? <OverviewSkeleton isMobile={isMobile} /> : isMobile ? (
                      <div className="divide-y overflow-hidden rounded-lg border bg-card">
                        {machineAgg.map((m) => <MachineCardMobile key={m.id} machine={m} />)}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {machineAgg.map((m) => {
                          const metaTurno = metas[m.id] ?? 0;
                          const metaDia = metaTurno * turnosAtivos;
                          const machineRecords = filteredRecords.filter(r => r.machineId === m.id);

                          // Build date map preserving per-record detail for OPs
                          const dateMap: Record<string, {
                            t1: number; t2: number; t3: number; total: number;
                            records: typeof machineRecords;
                          }> = {};
                          for (const r of machineRecords) {
                            if (!dateMap[r.date]) dateMap[r.date] = { t1: 0, t2: 0, t3: 0, total: 0, records: [] };
                            dateMap[r.date].records.push(r);
                            dateMap[r.date].t1 += r.turno === "TURNO 1" ? r.producao : 0;
                            dateMap[r.date].t2 += r.turno === "TURNO 2" ? r.producao : 0;
                            dateMap[r.date].t3 += r.turno === "TURNO 3" ? r.producao : 0;
                            dateMap[r.date].total += r.producao;
                          }
                          const dates = Object.entries(dateMap)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([date, d]) => ({ date, ...d }));

                          if (dates.length === 0) return null;
                          // Coluna T3 só aparece se houve produção no 3º turno
                          const hasT3 = dates.some(d => d.t3 > 0);

                          return (
                            <section key={m.id} aria-label={m.name} className="overflow-hidden rounded-lg border bg-card">
                              {/* Machine header */}
                              <div className="flex items-center justify-between gap-3 border-b bg-surface-2 px-4 py-2.5">
                                <h3 className="text-sm font-medium">{m.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                                  <span>Total <span className="font-medium text-foreground">{m.totalProd.toLocaleString("pt-BR")}</span> pç</span>
                                  <span className="text-foreground">{m.pct}%</span>
                                  <StatusChip pct={m.totalMeta > 0 ? m.pct : null} />
                                </div>
                              </div>
                              {/* Records table */}
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10"><span className="sr-only">Ordens</span></TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">T1</TableHead>
                                    <TableHead className="text-right">T2</TableHead>
                                    {hasT3 && <TableHead className="text-right">T3</TableHead>}
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="pr-4">% da meta</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {dates.map((d) => {
                                    const rowKey = `${m.id}-${d.date}`;
                                    const isExpanded = expandedDetalhado === rowKey;
                                    const hasOrdens = d.records.some(r => (r.ordensProducao?.length ?? 0) > 0);
                                    const pctDia = metaDia > 0 ? Math.round(d.total / metaDia * 100) : null;
                                    return (
                                      <Fragment key={d.date}>
                                        <TableRow data-state={isExpanded ? "selected" : undefined}>
                                          <TableCell className="text-center">
                                            {hasOrdens && (
                                              <button
                                                onClick={() => setExpandedDetalhado(isExpanded ? null : rowKey)}
                                                className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
                                                aria-expanded={isExpanded}
                                                aria-label={isExpanded ? "Recolher ordens de produção" : "Ver ordens de produção"}
                                              >
                                                {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                                              </button>
                                            )}
                                          </TableCell>
                                          <TableCell className="font-medium">{d.date.split("-").reverse().join("/")}</TableCell>
                                          <TableCell className="text-right text-muted-foreground">{d.t1 > 0 ? d.t1.toLocaleString("pt-BR") : "—"}</TableCell>
                                          <TableCell className="text-right text-muted-foreground">{d.t2 > 0 ? d.t2.toLocaleString("pt-BR") : "—"}</TableCell>
                                          {hasT3 && <TableCell className="text-right text-muted-foreground">{d.t3 > 0 ? d.t3.toLocaleString("pt-BR") : "—"}</TableCell>}
                                          <TableCell className="text-right font-medium">{d.total.toLocaleString("pt-BR")}</TableCell>
                                          <TableCell className="pr-4">
                                            {pctDia !== null ? (
                                              <div className="flex items-center gap-2">
                                                <SegmentedBar pct={pctDia} className="w-16 shrink-0" />
                                                <span className="w-10 text-right">{pctDia}%</span>
                                              </div>
                                            ) : "—"}
                                          </TableCell>
                                        </TableRow>
                                        {isExpanded && (
                                          <TableRow className="bg-surface-2 hover:bg-surface-2">
                                            <TableCell />
                                            <TableCell colSpan={hasT3 ? 6 : 5} className="h-auto pb-3 pt-1">
                                              <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                                                {d.records.map((r, ri) => {
                                                  const hasOPs = (r.ordensProducao?.length ?? 0) > 0;
                                                  return (
                                                    <div key={ri} className="text-xs">
                                                      <span className="text-muted-foreground">{r.turno.replace("TURNO ", "T")} · {r.savedBy}</span>
                                                      {hasOPs && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                          {r.ordensProducao!.map((o, oi) => (
                                                            <Badge key={oi} variant={o.retrabalho ? "warning" : "info"} className="tabular-nums">
                                                              <span className="text-muted-foreground">#{o.ordemId}</span>
                                                              <span aria-hidden="true">→</span>
                                                              <span>{o.quantidade.toLocaleString("pt-BR")} pç</span>
                                                              {o.retrabalho && <span>· retrabalho</span>}
                                                              {o.obs && <span className="text-muted-foreground">· {o.obs}</span>}
                                                            </Badge>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {r.obs && !hasOPs && (
                                                        <span className="ml-2 text-muted-foreground">— {r.obs}</span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {dashSubTab === "turnos" && (
                  <div className="space-y-4">
                    {loading ? <TurnosSkeleton /> : (
                    <section aria-labelledby="turnos-title" className="overflow-hidden rounded-lg border bg-card">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                        <div>
                          <h2 id="turnos-title" className="text-sm font-medium">Produção por turno</h2>
                          <p className="text-xs text-muted-foreground">Participação de cada turno na produção da máquina</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" aria-hidden="true" />Turno 1</span>
                          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />Turno 2</span>
                          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-3" aria-hidden="true" />Turno 3</span>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-4">Máquina</TableHead>
                            <TableHead className="text-right">Turno 1</TableHead>
                            <TableHead className="text-right">Turno 2</TableHead>
                            <TableHead className="text-right">Turno 3</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="min-w-[180px] pr-4">Divisão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {machineAgg.map((m) => {
                            const tb = turnoBreakdown[m.id];
                            if (!tb || tb.total === 0) return null;
                            const { t1, t2, t3, total } = tb;
                            const pcts = [t1, t2, t3].map(v => Math.round(v / total * 100));
                            const cell = (v: number, p: number) => v > 0
                              ? <>{v.toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground">{p}%</span></>
                              : <span className="text-muted-foreground">—</span>;
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="pl-4 font-medium">{m.name}</TableCell>
                                <TableCell className="text-right">{cell(t1, pcts[0])}</TableCell>
                                <TableCell className="text-right">{cell(t2, pcts[1])}</TableCell>
                                <TableCell className="text-right">{cell(t3, pcts[2])}</TableCell>
                                <TableCell className="text-right font-medium">{total.toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="pr-4">
                                  <div className="flex h-2 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`Turno 1 ${pcts[0]}%, turno 2 ${pcts[1]}%, turno 3 ${pcts[2]}%`}>
                                    <span className="bg-chart-1" style={{ width: `${pcts[0]}%` }} />
                                    <span className="bg-chart-2" style={{ width: `${pcts[1]}%` }} />
                                    <span className="bg-chart-3" style={{ width: `${pcts[2]}%` }} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </section>
                    )}
                  </div>
                )}

                {dashSubTab === "graficos" && (
                  <>
                    {loading ? <ChartsSkeleton isMobile={isMobile} /> : filteredRecords.length === 0 ? (
                      <div className="rounded-lg border bg-card px-6 py-12 text-center">
                        <BarChart3 size={24} className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium">Nenhum apontamento no período</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ajuste as datas, a máquina ou o turno para ver os gráficos.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Linha 1 — overview por máquina e turno */}
                        <div className={isMobile ? "space-y-4" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
                          <ChartCard title="Produção vs meta por máquina" subtitle="Comparativo entre produção real e meta estabelecida"
                            option={barOption} height={isMobile ? Math.max(280, barData.length * 48) : 360}
                            onExpand={() => setFullscreenChart("bar")} />
                          <ChartCard title="Distribuição por turno" subtitle="Percentual de produção em cada turno"
                            option={pieOption} height={isMobile ? 280 : 360}
                            onExpand={() => setFullscreenChart("pie")} />
                        </div>

                        {/* Ranking — full width */}
                        <ChartCard title="Ranking de performance" subtitle="Máquinas ordenadas por % da meta · linha tracejada = 100%"
                          option={hbarOption} height={isMobile ? Math.max(260, hbarData.length * 38) : 280}
                          onExpand={() => setFullscreenChart("hbar")} />

                        {/* Tendência — fundida (toggle Diária/Média 7d), full width */}
                        <div>
                          <ChartCard
                            title="Tendência de produção"
                            subtitle={trendMode === "ma7"
                              ? "Média móvel 7d — remove ruído diário e revela tendência real"
                              : "Produção crua dia a dia — útil pra ver variabilidade pontual"}
                            option={trendOption}
                            height={isMobile ? 280 : 320}
                            onExpand={() => setFullscreenChart("trend")}
                            headerExtra={
                              <div role="radiogroup" aria-label="Modo da tendência" className="flex items-center rounded-md border p-0.5">
                                {(["daily", "ma7"] as const).map(m => (
                                  <button
                                    key={m}
                                    role="radio"
                                    aria-checked={trendMode === m}
                                    onClick={() => setTrendMode(m)}
                                    className={cn("h-7 rounded-sm px-2.5 text-xs transition-colors duration-fast", trendMode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
                                  >
                                    {m === "daily" ? "Diária" : "Média 7d"}
                                  </button>
                                ))}
                              </div>
                            }
                          />
                          <Hint>{trendMode === "ma7"
                            ? "A linha suaviza variações diárias e revela tendência real. Se ficar abaixo da meta tracejada por vários dias seguidos, é queda sistêmica — não só ruído."
                            : "A produção diária crua mostra os altos e baixos do dia a dia. Use pra investigar dias específicos; pra olhar tendência, troque pra 'Média 7d'."}</Hint>
                        </div>

                        {heatmapData.length === 0 ? (
                          <div className="rounded-lg border bg-card p-6 text-center">
                            <Activity size={24} className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm font-medium">Sem dados com meta no período</p>
                            <p className="text-xs text-muted-foreground">Ajuste o período ou a máquina para ver as análises avançadas.</p>
                          </div>
                        ) : (
                          <>
                            {/* Heatmap × dia da semana — full width */}
                            <div>
                              <ChartCard
                                title="Heatmap de performance"
                                subtitle="% médio de atingimento de meta por máquina × dia da semana"
                                option={heatmapOption}
                                height={Math.max(200, heatmapMachines.length * 36 + 48)}
                                onExpand={() => setFullscreenChart("heatmap")}
                              />
                              <Hint>Cada célula usa a escala de status: crítico &lt; 70%, atenção 70–89%, próximo 90–99%, atingido ≥ 100%. O número sempre aparece dentro da célula.</Hint>
                            </div>

                            {/* Pareto + Radar — side by side em desktop */}
                            <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
                              <div>
                                {paretoData.length > 0 ? (
                                  <ChartCard
                                    title="Pareto de desvio de meta"
                                    subtitle="Onde concentrar atenção (lei 80/20)"
                                    option={paretoOption}
                                    height={320}
                                    onExpand={() => setFullscreenChart("pareto")}
                                  />
                                ) : (
                                  <div className="rounded-lg border bg-card p-6 text-center">
                                    <p className="text-sm text-muted-foreground">Todas as máquinas atingiram ou superaram a meta no período.</p>
                                  </div>
                                )}
                                <Hint>Barras à esquerda contribuem mais ao gap total. A linha acumulada mostra o ponto 80/20 — focar nas primeiras já resolve a maior parte.</Hint>
                              </div>
                              <div>
                                <ChartCard
                                  title="Radar de consistência"
                                  subtitle="% meta · consistência · produção relativa"
                                  option={radarOption}
                                  height={Math.min(500, Math.max(320, radarData.length * 40 + 120))}
                                  onExpand={() => setFullscreenChart("radar")}
                                />
                                <Hint>A máquina de maior produção aparece em azul; passe o mouse na legenda para destacar outra. Máquina ideal ocupa o triângulo externo em todos os eixos.</Hint>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Taxa de Retrabalho — full width */}
                        {retrabalhoData.length > 0 && (
                          <div>
                            <ChartCard
                              title="Taxa de retrabalho por máquina"
                              subtitle="Produção normal vs. retrabalho — % indica fração de retrabalho no total"
                              option={retrabalhoOption}
                              height={Math.max(220, retrabalhoData.length * 32 + 60)}
                              onExpand={() => setFullscreenChart("retrabalho")}
                            />
                            <Hint>Barras com trecho âmbar grande indicam máquinas com alta taxa de retrabalho — sinal de qualidade ou processo a investigar. Ordenado por % retrabalho descendente.</Hint>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Fullscreen charts */}
                <ChartFullscreen open={fullscreenChart === "bar"}        onClose={() => setFullscreenChart(null)} title="Produção vs meta"               option={barOptionFs} />
                <ChartFullscreen open={fullscreenChart === "hbar"}       onClose={() => setFullscreenChart(null)} title="% de atingimento"               option={hbarOptionFs} />
                <ChartFullscreen open={fullscreenChart === "trend"}      onClose={() => setFullscreenChart(null)} title="Tendência de produção"          option={trendOption} />
                <ChartFullscreen open={fullscreenChart === "pie"}        onClose={() => setFullscreenChart(null)} title="Distribuição por turno"         option={pieOptionFs} />
                <ChartFullscreen open={fullscreenChart === "heatmap"}    onClose={() => setFullscreenChart(null)} title="Heatmap de performance"         option={heatmapOption} />
                <ChartFullscreen open={fullscreenChart === "pareto"}     onClose={() => setFullscreenChart(null)} title="Pareto de desvio de meta"       option={paretoOption} />
                <ChartFullscreen open={fullscreenChart === "radar"}      onClose={() => setFullscreenChart(null)} title="Radar de consistência"          option={radarOption} />
                <ChartFullscreen open={fullscreenChart === "retrabalho"} onClose={() => setFullscreenChart(null)} title="Taxa de retrabalho por máquina" option={retrabalhoOptionFs} />
              </div>
            )}

            {/* ── HISTÓRICO ── */}
            {activeTab === "history" && (loading ? <HistorySkeleton /> : <ReportsTab />)}

            {/* ── METAS ── */}
            {activeTab === "metas" && (loading ? <MetasSkeleton /> : <MetasTab />)}

            {/* ── FEEDBACKS ── */}
            {activeTab === "feedbacks" && (loading ? <FeedbacksSkeleton /> : <FeedbacksTab />)}
      </main>

      {isMobile && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {(needsOnboarding || showTour) && (
        <OnboardingPresentation onComplete={() => {
          if (needsOnboarding) completeOnboarding();
          setShowTour(false);
        }} />
      )}

      {/* TV Mode — fullscreen presentation overlay. Receives only pre-computed data, zero backend calls. */}
      {showTV && (
        <TVMode
          machAgg={machineAgg}
          dayAgg={dayAgg}
          turnoAgg={turnoAgg}
          barData={barData}
          hbarData={hbarData}
          totalProd={totalProd}
          totalMeta={totalMeta}
          pctGeral={pctGeral}
          tendency={tendency}
          heatmapData={heatmapData}
          paretoData={paretoData}
          heatmapMachines={heatmapMachines}
          onClose={() => setShowTV(false)}
        />
      )}
    </div>
  );
};

/** Texto de ajuda "como interpretar" abaixo dos gráficos. */
const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1.5 px-1 text-xs text-muted-foreground">
    <span className="font-medium text-foreground">Como interpretar:</span> {children}
  </p>
);

/** Lista curta ranqueada (padrão "Marketing goals" da referência): nome · valor/meta · barra fina. */
const RankList = ({ title, subtitle, items }: {
  title: string; subtitle: string;
  items: { id: number; name: string; pct: number; totalProd: number; totalMeta: number }[];
}) => (
  <section className="rounded-lg border bg-card p-4" aria-label={title}>
    <h2 className="text-sm font-medium">{title}</h2>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
    {items.length === 0 ? (
      <p className="mt-4 text-sm text-muted-foreground">Sem máquinas com meta no período.</p>
    ) : (
      <ol className="mt-3 space-y-3">
        {items.map((m, i) => (
          <li key={m.id}>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate">{m.name}</span>
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                <span className="text-foreground">{m.totalProd.toLocaleString("pt-BR")}</span> / {m.totalMeta.toLocaleString("pt-BR")}
              </span>
              <span className="w-10 text-right tabular-nums">{m.pct}%</span>
              <StatusChip pct={m.pct} />
            </div>
            <div className="ml-6 mt-1.5 h-1 overflow-hidden rounded-sm bg-muted">
              <div className={cn("h-full rounded-sm", STATUS_BG_CLASS[getAttainmentStatus(m.pct)])} style={{ width: `${Math.min(m.pct, 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    )}
  </section>
);

/* Skeleton loaders — mesma forma do conteúdo final */
const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-sm bg-muted motion-reduce:animate-none ${className}`} />
);

const OverviewSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"} gap-3`}>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-start justify-between">
          <SkeletonBox className="h-4 w-28" />
          <SkeletonBox className="h-5 w-12" />
        </div>
        <SkeletonBox className="mb-3 h-2 w-full" />
        <div className="flex justify-between">
          <SkeletonBox className="h-3 w-16" />
          <SkeletonBox className="h-3 w-16" />
        </div>
      </div>
    ))}
  </div>
);

const ChartsSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className={`${isMobile ? "space-y-3" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}`}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className={`rounded-lg border bg-card p-4 ${!isMobile && i === 0 ? "lg:col-span-2" : ""}`}>
        <SkeletonBox className="mb-4 h-4 w-40" />
        <SkeletonBox className={`w-full ${isMobile ? "h-[260px]" : i === 0 ? "h-[360px]" : "h-[280px]"}`} />
      </div>
    ))}
  </div>
);

const DetailsSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className="overflow-hidden rounded-lg border bg-card" aria-busy="true" aria-label="Carregando máquinas">
    <SkeletonBox className={`w-full rounded-none ${isMobile ? "h-20" : "h-9"}`} />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="border-t px-4 py-2.5">
        <SkeletonBox className={`w-full ${isMobile ? "h-12" : "h-4"}`} />
      </div>
    ))}
  </div>
);

const TurnosSkeleton = () => (
  <div className="overflow-hidden rounded-lg border bg-card">
    <SkeletonBox className="h-14 w-full rounded-none" />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="grid grid-cols-6 gap-2 border-t px-4 py-2.5">
        {Array.from({ length: 6 }).map((_, j) => <SkeletonBox key={j} className="h-4" />)}
      </div>
    ))}
  </div>
);

const MetasSkeleton = () => (
  <div className="space-y-4">
    <div className="rounded-lg border bg-card p-4">
      <SkeletonBox className="mb-4 h-3 w-48" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-20" />)}
      </div>
    </div>
    <div className="overflow-hidden rounded-lg border bg-card">
      <SkeletonBox className="h-9 w-full rounded-none" />
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="border-t px-4 py-2.5"><SkeletonBox className="h-4 w-full" /></div>)}
    </div>
  </div>
);

const FeedbacksSkeleton = () => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-8 w-36" />)}
    </div>
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-40 rounded-lg" />)}
    </div>
  </div>
);

const HistorySkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-2">
      {Array.from({ length: 2 }).map((_, i) => <SkeletonBox key={i} className="h-8 w-24" />)}
    </div>
    <div className="rounded-lg border bg-card p-4">
      <SkeletonBox className="mb-3 h-8 w-full" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => <SkeletonBox key={i} className="h-16" />)}
      </div>
    </div>
  </div>
);

export default DashboardPage;
