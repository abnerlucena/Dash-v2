import { useState, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EChartsOption } from "echarts";
import { BarChart3, TrendingUp, Factory, Activity, ClipboardEdit, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { TURNOS, pctColor, fmt, today } from "@/lib/api";
import { getBarChartOption, getAreaChartOption, getPieChartOption, getHorizontalBarOption } from "@/lib/chart-options";

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
import { DatePickerInput } from "@/components/DatePickerInput";
import { SelectDropdown } from "@/components/SelectDropdown";

type DashboardSubTab = "resumo" | "detalhado" | "turnos" | "graficos" | "analytics";

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
  { id: "analytics", label: "Analytics" },
];

const TOP3_BADGE_COLORS = ["#22C55E", "#16A34A", "#15803D"];
const BOTTOM3_BADGE_COLORS = ["#EF4444", "#F97316", "#F59E0B"];

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

  const barOption  = useMemo(() => getBarChartOption(barData, isMobile),        [barData, isMobile]);
  const areaOption = useMemo(() => getAreaChartOption(dayAgg, isMobile),         [dayAgg, isMobile]);
  const pieOption  = useMemo(() => getPieChartOption(turnoAgg, isMobile),        [turnoAgg, isMobile]);
  const hbarOption = useMemo(() => getHorizontalBarOption(hbarData, isMobile),   [hbarData, isMobile]);

  // Fullscreen options — always isMobile=false, derived from already-memoized data
  const barOptionFs  = useMemo(() => getBarChartOption(barData, false),          [barData]);
  const hbarOptionFs = useMemo(() => getHorizontalBarOption(hbarData, false),    [hbarData]);
  const areaOptionFs = useMemo(() => getAreaChartOption(dayAgg, false),          [dayAgg]);
  const pieOptionFs  = useMemo(() => getPieChartOption(turnoAgg, false),         [turnoAgg]);

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
    return {
      animation: true,
      tooltip: {
        trigger: "item",
        backgroundColor: "#fff", borderColor: "#D0DEE8", borderWidth: 1, borderRadius: 8,
        textStyle: { color: "#2D3E4E", fontSize: 12 }, confine: true,
        formatter: (params: any) => {
          const [dIdx, mIdx, pct] = params.data as number[];
          return `<strong>${heatmapMachines[mIdx]}</strong><br/>${WDAYS[dIdx]}: <strong>${pct}%</strong> da meta`;
        },
      },
      visualMap: {
        min: 0, max: 100, show: false, calculable: false,
        inRange: { color: ["#EF4444", "#F59E0B", "#22C55E"] },
      },
      grid: { top: 10, right: 10, bottom: 60, left: 10, containLabel: true },
      xAxis: { type: "category", data: WDAYS, axisLabel: { fontSize: 11 }, splitArea: { show: true } },
      yAxis: { type: "category", data: heatmapMachines, axisLabel: { fontSize: 10, width: 140, overflow: "truncate" }, splitArea: { show: true } },
      series: [{
        type: "heatmap",
        data: heatmapData.map(d => [d.dayIdx, d.machIdx, d.pct]),
        label: { show: true, fontSize: 10, formatter: (p: any) => p.value[2] > 0 ? `${p.value[2]}%` : "" },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
      }],
    };
  }, [heatmapData, heatmapMachines]);

  // Pareto: machines sorted by gap (meta - prod) descending + cumulative %
  const paretoData = useMemo(() =>
    machineAgg
      .map(m => ({ name: m.name, gap: Math.max(0, m.totalMeta - m.totalProd), pct: m.pct }))
      .filter(m => m.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .map((m, i, arr) => {
        const totalGap = arr.reduce((s, x) => s + x.gap, 0);
        const cumulative = arr.slice(0, i + 1).reduce((s, x) => s + x.gap, 0);
        return { ...m, cumPct: totalGap > 0 ? Math.round((cumulative / totalGap) * 100) : 0 };
      }),
  [machineAgg]);

  const paretoOption = useMemo((): EChartsOption => ({
    animation: true,
    tooltip: {
      trigger: "axis", axisPointer: { type: "cross" },
      backgroundColor: "#fff", borderColor: "#D0DEE8", borderWidth: 1, borderRadius: 8,
      textStyle: { color: "#2D3E4E", fontSize: 12 }, confine: true,
    },
    legend: { data: ["Gap (pç)", "% Acumulado"], top: 0, textStyle: { fontSize: 11 } },
    grid: { top: 36, right: 60, bottom: 80, left: 60 },
    xAxis: {
      type: "category",
      data: paretoData.map(d => d.name),
      axisLabel: { fontSize: 10, rotate: 25, interval: 0 },
    },
    yAxis: [
      { type: "value", name: "Gap (pç)", axisLabel: { fontSize: 10, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) } },
      { type: "value", name: "% Acum", max: 100, min: 0, axisLabel: { fontSize: 10, formatter: "{value}%" } },
    ],
    series: [
      {
        name: "Gap (pç)", type: "bar", yAxisIndex: 0, barMaxWidth: 40,
        data: paretoData.map(d => ({ value: d.gap, itemStyle: { color: pctColor(d.pct), borderRadius: [4, 4, 0, 0] } })),
      },
      {
        name: "% Acumulado", type: "line", yAxisIndex: 1,
        data: paretoData.map(d => d.cumPct),
        lineStyle: { color: "#003366", width: 2 }, itemStyle: { color: "#003366" },
        symbol: "circle", symbolSize: 6,
      },
    ],
  }), [paretoData]);

  // Trend: daily production + 7-day moving average + daily meta
  const trendData = useMemo(() =>
    dayAgg.map((d, i, arr) => {
      const win = arr.slice(Math.max(0, i - 6), i + 1);
      return { ...d, ma7: Math.round(win.reduce((s, x) => s + x.producao, 0) / win.length) };
    }),
  [dayAgg]);

  const trendOption = useMemo((): EChartsOption => ({
    animation: true,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#fff", borderColor: "#D0DEE8", borderWidth: 1, borderRadius: 8,
      textStyle: { color: "#2D3E4E", fontSize: 12 }, confine: true,
    },
    legend: { data: ["Produção Real", "Média 7d", "Meta"], top: 0, textStyle: { fontSize: 11 } },
    grid: { top: 36, right: 20, bottom: 40, left: 65 },
    xAxis: { type: "category", data: trendData.map(d => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) } },
    series: [
      {
        name: "Produção Real", type: "line", symbol: "none",
        data: trendData.map(d => d.producao),
        lineStyle: { color: "#0066B3", width: 1.5, opacity: 0.55 },
        itemStyle: { color: "#0066B3" },
      },
      {
        name: "Média 7d", type: "line", symbol: "none",
        data: trendData.map(d => d.ma7),
        lineStyle: { color: "#0066B3", width: 3 },
        itemStyle: { color: "#0066B3" },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#0066B330" }, { offset: 1, color: "#0066B300" }] } },
      },
      {
        name: "Meta", type: "line", symbol: "none",
        data: trendData.map(d => d.meta),
        lineStyle: { color: "#94A3B8", width: 1.5, type: "dashed" },
        itemStyle: { color: "#94A3B8" },
      },
    ],
  }), [trendData]);

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
    const COLORS = ["#0066B3", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#64748B"];
    return {
      animation: true,
      tooltip: { trigger: "item", confine: true },
      legend: { data: radarData.map(d => d.name), bottom: 0, type: "scroll", textStyle: { fontSize: 10 } },
      radar: {
        indicator: [
          { name: "% Meta", max: 100 },
          { name: "Consistência", max: 100 },
          { name: "Prod. Relativa", max: 100 },
        ],
        radius: "60%", center: ["50%", "45%"],
        axisName: { fontSize: 11, color: "#64748B" },
        splitArea: { areaStyle: { color: ["rgba(0,102,179,0.03)", "rgba(0,102,179,0.07)"] } },
      },
      series: [{
        type: "radar",
        data: radarData.map((m, i) => ({
          name: m.name,
          value: m.values,
          lineStyle: { color: COLORS[i % COLORS.length], width: 2 },
          itemStyle: { color: COLORS[i % COLORS.length] },
          areaStyle: { color: COLORS[i % COLORS.length] + "22" },
          symbol: "circle", symbolSize: 4,
        })),
      }],
    };
  }, [radarData]);

  return (
    <div className="min-h-screen bg-background">
      <WEGHeader onAdminClick={() => setShowAdmin(true)} onTVClick={() => setShowTV(true)} onTourClick={() => setShowTour(true)} />

      {/* Desktop main tab nav */}
      {!isMobile && (
        <div className="bg-card border-b border-border">
          <div className="max-w-[1400px] mx-auto px-4 py-2.5">
            <nav className="flex items-center gap-2 overflow-x-auto">
              {MAIN_TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-5 py-2 text-sm font-semibold transition-all border ${
                    activeTab === t.id
                      ? "text-white border-transparent shadow-sm"
                      : "text-foreground border-border hover:bg-muted/60"
                  }`}
                  style={{
                    borderRadius: 20,
                    ...(activeTab === t.id ? { background: "#0066B3" } : {}),
                  }}>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className={`max-w-[1400px] mx-auto px-4 py-4 space-y-4 ${isMobile ? "pb-24" : ""}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* ── APONTAMENTO ── */}
            {activeTab === "entry" && <ProductionEntry />}

            {/* ── DASHBOARD ── */}
            {activeTab === "dashboard" && (
              <div className="space-y-4">
                {/* Filters row */}
                <div className="flex flex-wrap items-end gap-3 bg-card rounded-xl p-4 border border-border shadow-sm" style={{ borderRadius: 12 }}>
                  <DatePickerInput label="De" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
                  <DatePickerInput label="Até" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
                  <SelectDropdown
                    label="Máquina"
                    value={selectedMachine}
                    onChange={setSelectedMachine}
                    options={[{ value: "TODAS", label: "TODAS" }, ...machines.map(m => ({ value: m.name, label: m.name }))]}
                  />
                  <SelectDropdown
                    label="Turno"
                    value={selectedTurno}
                    onChange={setSelectedTurno}
                    options={[{ value: "TODOS", label: "TODOS" }, ...TURNOS.map(t => ({ value: t, label: t }))]}
                  />

                  {/* Sub-tabs on the right */}
                  <div className="ml-auto flex items-center gap-1.5 flex-wrap overflow-x-auto">
                    {SUB_TABS.map(st => (
                      <button key={st.id} onClick={() => setDashSubTab(st.id)}
                        className={`px-4 py-2 text-xs font-semibold border transition-all ${
                          dashSubTab === st.id
                            ? "text-white border-transparent shadow-sm"
                            : "bg-card text-foreground border-border hover:bg-muted"
                        }`}
                        style={{
                          borderRadius: 20,
                          ...(dashSubTab === st.id ? { background: "#0066B3" } : {}),
                        }}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KPI Cards */}
                <KPICards totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} recordCount={filteredRecords.length} activeMachineCount={activeMachineCount} totalMachineCount={machines.length} appointmentRate={appointmentRate} consecutiveDays={consecutiveDays} tendency={tendency} loading={loading} />

                {/* Sub-tab content with animations */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={dashSubTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                {dashSubTab === "resumo" && (
                  <div className="space-y-4">
                    {/* Top 3 best & worst */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-card rounded-xl border border-border shadow-sm p-4" style={{ borderRadius: 12 }}>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#22C55E" }}>Top 3 Melhores</h3>
                        <div className="space-y-2">
                          {top3.map((m, i) => {
                            const badgeColors = TOP3_BADGE_COLORS;
                            return (
                              <div key={m.id} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: badgeColors[i] }}>{i + 1}</span>
                                <span className="flex-1 text-sm font-medium text-foreground">{m.name}</span>
                                <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-full" style={{ color: pctColor(m.pct), backgroundColor: `${pctColor(m.pct)}15`, borderRadius: 20 }}>{m.pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-card rounded-xl border border-border shadow-sm p-4" style={{ borderRadius: 12 }}>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#EF4444" }}>3 Que Mais Precisam de Atenção</h3>
                        <div className="space-y-2">
                          {bottom3.map((m, i) => {
                            const badgeColors = BOTTOM3_BADGE_COLORS;
                            return (
                              <div key={m.id} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: badgeColors[i] }}>{i + 1}</span>
                                <span className="flex-1 text-sm font-medium text-foreground">{m.name}</span>
                                <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-full" style={{ color: pctColor(m.pct), backgroundColor: `${pctColor(m.pct)}15`, borderRadius: 20 }}>{m.pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Export + Machine Table */}
                    <div>
                      <button className="mb-3 flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #003366, #0066B3)", borderRadius: 8 }}>
                        Exportar
                      </button>
                      {loading ? <DetailsSkeleton isMobile={isMobile} /> : 
                        isMobile ? <MobileDetailCards machines={machineAgg} totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} /> :
                        <MachineTable machines={machineAgg} totalProd={totalProd} totalMeta={totalMeta} pctGeral={pctGeral} />
                      }
                    </div>
                  </div>
                )}

                {dashSubTab === "detalhado" && (
                  <div>
                    {loading ? <OverviewSkeleton isMobile={isMobile} /> : isMobile ? (
                      <div className="grid grid-cols-1 gap-2">
                        {machineAgg.map((m, i) => <MachineCardMobile key={m.id} machine={m} index={i} />)}
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

                          return (
                            <motion.div key={m.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ borderRadius: 12 }}>
                              {/* Machine header */}
                              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#003366' }}>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">{m.name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-white/80">
                                    Total: {m.totalProd.toLocaleString("pt-BR")} pç
                                  </span>
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ color: pctColor(m.pct), background: `${pctColor(m.pct)}25` }}>
                                    {m.pct}%
                                  </span>
                                </div>
                              </div>
                              {/* Records table */}
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border" style={{ background: '#F8FAFC' }}>
                                    <th className="w-8 px-2 py-2" />
                                    <th className="text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">T1</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">T2</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">T3</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</th>
                                    <th className="text-center px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">% Meta</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dates.map((d, i) => {
                                    const rowKey = `${m.id}-${d.date}`;
                                    const isExpanded = expandedDetalhado === rowKey;
                                    const hasOrdens = d.records.some(r => (r.ordensProducao?.length ?? 0) > 0);
                                    const pctDia = metaDia > 0 ? Math.round(d.total / metaDia * 100) : null;
                                    const rowBg = i % 2 === 0 ? '#fff' : '#F8FAFC';
                                    return (
                                      <Fragment key={d.date}>
                                        <tr
                                          className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                                          style={{ background: rowBg }}
                                        >
                                          <td className="px-2 py-2 text-center">
                                            {hasOrdens && (
                                              <button
                                                onClick={() => setExpandedDetalhado(isExpanded ? null : rowKey)}
                                                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                title={isExpanded ? "Recolher ordens" : "Ver ordens de produção"}
                                              >
                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 font-semibold text-foreground text-xs">
                                            {d.date.split("-").reverse().join("/")}
                                          </td>
                                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                                            {d.t1 > 0 ? d.t1.toLocaleString("pt-BR") : "—"}
                                          </td>
                                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                                            {d.t2 > 0 ? d.t2.toLocaleString("pt-BR") : "—"}
                                          </td>
                                          <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                                            {d.t3 > 0 ? d.t3.toLocaleString("pt-BR") : "—"}
                                          </td>
                                          <td className="px-3 py-2.5 text-right font-bold text-foreground text-xs">
                                            {d.total.toLocaleString("pt-BR")}
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            {pctDia !== null ? (
                                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                                                style={{ color: pctColor(pctDia), background: `${pctColor(pctDia)}15` }}>
                                                {pctDia}%
                                              </span>
                                            ) : "—"}
                                          </td>
                                        </tr>
                                        {isExpanded && (
                                          <tr style={{ background: rowBg }}>
                                            <td />
                                            <td colSpan={6} className="px-4 pb-3 pt-1">
                                              <div className="space-y-1.5 border-l-2 border-primary/30 pl-3">
                                                {d.records.map((r, ri) => {
                                                  const hasOPs = (r.ordensProducao?.length ?? 0) > 0;
                                                  return (
                                                    <div key={ri} className="text-xs">
                                                      <span className="font-semibold text-muted-foreground">{r.turno.replace("TURNO ", "T")} · {r.savedBy}</span>
                                                      {hasOPs && (
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                          {r.ordensProducao!.map((o, oi) => (
                                                            <span key={oi}
                                                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-primary/20"
                                                              style={{ background: "#0066B310", color: "#0066B3" }}>
                                                              <span className="text-muted-foreground">#{o.ordemId}</span>
                                                              <span className="text-primary/40">→</span>
                                                              <span>{o.quantidade.toLocaleString("pt-BR")} pç</span>
                                                              {o.obs && <span className="text-muted-foreground">· {o.obs}</span>}
                                                            </span>
                                                          ))}
                                                        </div>
                                                      )}
                                                      {r.obs && !hasOPs && (
                                                        <span className="text-muted-foreground ml-2">— {r.obs}</span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {dashSubTab === "turnos" && (
                  <div className="space-y-4">
                    {loading ? <TurnosSkeleton /> : (
                    <>
                    {/* Comparativo por Turno table */}
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ borderRadius: 12 }}>
                      <div className="px-4 py-2.5" style={{ background: '#003366' }}>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Comparativo por Turno</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border" style={{ background: '#F8FAFC' }}>
                            <th className="text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Máquina</th>
                            <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Turno 1</th>
                            <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Turno 2</th>
                            <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Turno 3</th>
                            <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</th>
                            <th className="text-center px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Melhor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {machineAgg.map((m) => {
                            const tb = turnoBreakdown[m.id];
                            if (!tb || tb.total === 0) return null;
                            const { t1, t2, t3, total, best } = tb;
                            const t1Pct = Math.round(t1 / total * 100);
                            const t2Pct = Math.round(t2 / total * 100);
                            const t3Pct = Math.round(t3 / total * 100);
                            return (
                              <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-semibold text-foreground text-xs">{m.name}</td>
                                <td className="px-3 py-3 text-center">
                                  {t1 > 0 ? <><span className="font-bold">{t1.toLocaleString("pt-BR")}</span><br/><span className="text-[10px] text-muted-foreground">{t1Pct}%</span></> : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {t2 > 0 ? <><span className="font-bold">{t2.toLocaleString("pt-BR")}</span><br/><span className="text-[10px] text-muted-foreground">{t2Pct}%</span></> : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {t3 > 0 ? <><span className="font-bold">{t3.toLocaleString("pt-BR")}</span><br/><span className="text-[10px] text-muted-foreground">{t3Pct}%</span></> : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-3 text-right font-bold text-foreground">{total.toLocaleString("pt-BR")}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full inline-block" style={{ color: '#0066B3', backgroundColor: '#0066B315', borderRadius: 20 }}>
                                    {best}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </>
                    )}
                  </div>
                )}

                {dashSubTab === "graficos" && (
                  <>
                    {loading ? <ChartsSkeleton isMobile={isMobile} /> : (
                      <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                        <ChartCard title="Produção vs Meta por Máquina" subtitle="Comparativo entre produção real e meta estabelecida"
                          option={barOption} height={isMobile ? Math.max(280, barData.length * 48) : 400}
                          onExpand={() => setFullscreenChart("bar")} />
                        <ChartCard title="Distribuição por Turno" subtitle="Percentual de produção em cada turno"
                          option={pieOption} height={isMobile ? 280 : 400}
                          onExpand={() => setFullscreenChart("pie")} />
                        <ChartCard title="Tendência de Produção" subtitle="Evolução diária da produção no período"
                          option={areaOption} height={isMobile ? 280 : 300}
                          onExpand={() => setFullscreenChart("area")} />
                        <ChartCard title="Ranking de Performance" subtitle="Máquinas ordenadas por % da meta"
                          option={hbarOption} height={isMobile ? Math.max(260, hbarData.length * 38) : 300}
                          onExpand={() => setFullscreenChart("hbar")} />
                      </div>
                    )}
                  </>
                )}

                {dashSubTab === "analytics" && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Activity size={16} className="text-primary" />
                        Analytics Avançado
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Análise interpretativa do período selecionado</p>
                    </div>

                    {heatmapData.length === 0 ? (
                      <div className="bg-card rounded-xl border border-border p-8 text-center" style={{ borderRadius: 12 }}>
                        <Activity size={32} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum dado com meta disponível no período filtrado.</p>
                      </div>
                    ) : (
                      <>
                        {/* Heatmap — full width */}
                        <div>
                          <ChartCard
                            title="Heatmap de Performance"
                            subtitle="% médio de atingimento de meta por máquina × dia da semana"
                            option={heatmapOption}
                            height={Math.max(220, heatmapMachines.length * 36 + 80)}
                          />
                          <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                            <strong>Como interpretar:</strong> Células verdes indicam dias da semana onde a produção supera consistentemente a meta. Células vermelhas revelam padrões sistemáticos de baixa performance — úteis para investigar causas estruturais (ex: troca de turno, manutenção recorrente).
                          </p>
                        </div>

                        {/* Pareto + Tendência — side by side on desktop */}
                        <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
                          <div>
                            {paretoData.length > 0 ? (
                              <ChartCard
                                title="Pareto de Desvio de Meta"
                                subtitle="Onde concentrar atenção para recuperar o resultado (lei 80/20)"
                                option={paretoOption}
                                height={320}
                              />
                            ) : (
                              <div className="bg-card rounded-xl border border-border p-6 text-center" style={{ borderRadius: 12 }}>
                                <p className="text-xs text-muted-foreground">Todas as máquinas atingiram ou superaram a meta no período.</p>
                              </div>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                              <strong>Como interpretar:</strong> Barras à esquerda representam maior contribuição ao gap total. A linha acumulada mostra o ponto de inflexão 80/20 — focar nas primeiras máquinas já resolve a maior parte do desvio.
                            </p>
                          </div>
                          <div>
                            <ChartCard
                              title="Tendência com Média Móvel 7d"
                              subtitle="Produção real vs. média suavizada para identificar tendência de longo prazo"
                              option={trendOption}
                              height={320}
                            />
                            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                              <strong>Como interpretar:</strong> A linha espessa (Média 7d) remove o ruído diário e revela a tendência real. Se a média 7d estiver abaixo da meta tracejada por vários dias consecutivos, há queda sistêmica e não apenas variação pontual.
                            </p>
                          </div>
                        </div>

                        {/* Radar — full width */}
                        <div>
                          <ChartCard
                            title="Radar de Consistência por Máquina"
                            subtitle="Visão multidimensional: % meta, consistência (dias acima da meta) e produção relativa ao pico"
                            option={radarOption}
                            height={Math.min(500, Math.max(320, radarData.length * 40 + 120))}
                          />
                          <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                            <strong>Como interpretar:</strong> Uma máquina ideal ocupa o hexágono externo em todos os eixos. Uma máquina com % meta alta mas consistência baixa bate a meta apenas esporadicamente — isso pode mascarar instabilidade no processo.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
                  </motion.div>
                </AnimatePresence>

                {/* Fullscreen charts */}
                <ChartFullscreen open={fullscreenChart === "bar"}  onClose={() => setFullscreenChart(null)} title="Produção vs Meta"       option={barOptionFs} />
                <ChartFullscreen open={fullscreenChart === "hbar"} onClose={() => setFullscreenChart(null)} title="% Atingimento"            option={hbarOptionFs} />
                <ChartFullscreen open={fullscreenChart === "area"} onClose={() => setFullscreenChart(null)} title="Tendência Diária"         option={areaOptionFs} />
                <ChartFullscreen open={fullscreenChart === "pie"}  onClose={() => setFullscreenChart(null)} title="Distribuição por Turno"   option={pieOptionFs} />
              </div>
            )}

            {/* ── HISTÓRICO ── */}
            {activeTab === "history" && (loading ? <HistorySkeleton /> : <ReportsTab />)}

            {/* ── METAS ── */}
            {activeTab === "metas" && (loading ? <MetasSkeleton /> : <MetasTab />)}

            {/* ── FEEDBACKS ── */}
            {activeTab === "feedbacks" && (loading ? <FeedbacksSkeleton /> : <FeedbacksTab />)}
          </motion.div>
        </AnimatePresence>
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

/* Skeleton loaders */
const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-muted ${className}`} />
);

const OverviewSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"} gap-3`}>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-card rounded-xl p-4 border border-border" style={{ borderRadius: 12 }}>
        <div className="flex items-start justify-between mb-3">
          <SkeletonBox className="h-4 w-28 rounded-md" />
          <SkeletonBox className="h-5 w-12 rounded-full" />
        </div>
        <SkeletonBox className="h-2 w-full rounded-full mb-3" />
        <div className="flex justify-between">
          <SkeletonBox className="h-3 w-16 rounded-md" />
          <SkeletonBox className="h-3 w-16 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

const ChartsSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className={`${isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}`}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className={`bg-card rounded-xl border border-border p-4 ${!isMobile && i === 0 ? "lg:col-span-2" : ""}`} style={{ borderRadius: 12 }}>
        <SkeletonBox className="h-4 w-40 rounded-md mb-4" />
        <SkeletonBox className={`w-full rounded-lg ${isMobile ? "h-[260px]" : i === 0 ? "h-[380px]" : "h-[280px]"}`} />
      </div>
    ))}
  </div>
);

const DetailsSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div className="space-y-2">
    {isMobile ? (
      <>
        <SkeletonBox className="h-24 w-full rounded-2xl" />
        {Array.from({ length: 5 }).map((_, i) => <SkeletonBox key={i} className="h-20 w-full rounded-xl" />)}
      </>
    ) : (
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ borderRadius: 12 }}>
        <SkeletonBox className="h-10 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => <SkeletonBox key={i} className="h-12 w-full rounded-none" />)}
      </div>
    )}
  </div>
);

const TurnosSkeleton = () => (
  <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ borderRadius: 12 }}>
    <SkeletonBox className="h-10 w-full rounded-none" />
    <div className="p-1">
      <div className="grid grid-cols-6 gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonBox key={i} className="h-4 rounded-md" />)}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 px-3 py-2">
          {Array.from({ length: 6 }).map((_, j) => <SkeletonBox key={j} className="h-5 rounded-md" />)}
        </div>
      ))}
    </div>
  </div>
);

const MetasSkeleton = () => (
  <div className="space-y-6">
    <div className="bg-card rounded-xl border border-border p-5" style={{ borderRadius: 12 }}>
      <SkeletonBox className="h-3 w-48 rounded-md mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-20 rounded-lg" />)}
      </div>
    </div>
    <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ borderRadius: 12 }}>
      <SkeletonBox className="h-10 w-full rounded-none" />
      {Array.from({ length: 6 }).map((_, i) => <SkeletonBox key={i} className="h-12 w-full rounded-none" />)}
    </div>
  </div>
);

const FeedbacksSkeleton = () => (
  <div className="space-y-5">
    <div className="bg-card rounded-xl border border-border p-5" style={{ borderRadius: 12 }}>
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-10 w-36 rounded-md" />)}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-40 rounded-xl" />)}
    </div>
  </div>
);

const HistorySkeleton = () => (
  <div className="space-y-4">
    <div className="flex gap-2">
      {Array.from({ length: 2 }).map((_, i) => <SkeletonBox key={i} className="h-9 w-24 rounded-full" />)}
    </div>
    <div className="bg-card rounded-xl border border-border p-4" style={{ borderRadius: 12 }}>
      <SkeletonBox className="h-8 w-full rounded-md mb-3" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => <SkeletonBox key={i} className="h-16 rounded-lg" />)}
      </div>
    </div>
  </div>
);

export default DashboardPage;
