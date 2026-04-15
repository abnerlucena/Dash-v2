import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactEChartsCore from "echarts-for-react";
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import WEGLogo from "./WEGLogo";
import { pctColor } from "@/lib/api";
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

export interface TVModeProps {
  machAgg:    MachAgg[];
  dayAgg:     DayPoint[];
  turnoAgg:   TurnoPoint[];
  barData:    BarPoint[];
  hbarData:   HBarPoint[];   // pre-sorted ascending — ECharts renders y-axis bottom→top (best at top)
  totalProd:  number;
  totalMeta:  number;
  pctGeral:   number;
  tendency:   number | null;
  onClose:    () => void;
}

// ─── Dark ECharts theme helpers ─────────────────────────────────────────────────
const darkTooltip = {
  backgroundColor: "rgba(0,15,40,0.95)",
  borderColor: "#0066B3",
  borderWidth: 1,
  borderRadius: 8,
  textStyle: { color: "#fff", fontSize: 13 },
  confine: true,
};
const darkAxisLabel = { color: "rgba(255,255,255,0.7)", fontSize: 13 };
const darkSplitLine = { lineStyle: { color: "rgba(255,255,255,0.07)" } };
const darkAxisLine  = { lineStyle: { color: "rgba(255,255,255,0.12)" } };

function tvHBarOption(data: HBarPoint[]): EChartsOption {
  return {
    animation: true, animationDuration: 700,
    backgroundColor: "transparent",
    tooltip: {
      ...darkTooltip, trigger: "axis", axisPointer: { type: "shadow" },
      formatter: (params: any) => `<strong>${params[0].name}</strong><br/>${params[0].value}% da meta`,
    },
    grid: { top: 12, right: 90, bottom: 12, left: 12, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { ...darkAxisLabel, formatter: "{value}%" },
      splitLine: darkSplitLine,
      axisLine: darkAxisLine,
      max: (v: any) => Math.max(v.max * 1.1, 115),
    },
    yAxis: {
      type: "category",
      data: data.map(d => d.name),
      axisLabel: { ...darkAxisLabel, width: 160, overflow: "truncate" },
      axisLine: darkAxisLine,
    },
    series: [{
      type: "bar",
      barMaxWidth: 36,
      data: data.map(d => ({
        value: d.pct,
        itemStyle: {
          color: d.pct >= 100 ? "#22C55E" : d.pct >= 80 ? "#F59E0B" : "#EF4444",
          borderRadius: [0, 6, 6, 0],
        },
      })),
      label: {
        show: true, position: "right",
        formatter: (p: any) => `${p.value}%`,
        fontSize: 14, color: "#fff", fontWeight: "bold",
      },
    }],
  };
}

function tvBarOption(data: BarPoint[]): EChartsOption {
  return {
    animation: true, animationDuration: 700,
    backgroundColor: "transparent",
    tooltip: { ...darkTooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Meta", "Produção"], top: 4, textStyle: { color: "rgba(255,255,255,0.8)", fontSize: 13 } },
    grid: { top: 44, right: 24, bottom: 64, left: 72 },
    xAxis: {
      type: "category",
      data: data.map(d => d.name),
      axisLabel: { ...darkAxisLabel, rotate: 20, interval: 0 },
      axisLine: darkAxisLine,
    },
    yAxis: {
      type: "value",
      axisLabel: { ...darkAxisLabel, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) },
      splitLine: darkSplitLine,
      axisLine: darkAxisLine,
    },
    series: [
      {
        name: "Meta", type: "bar",
        data: data.map(d => d.meta),
        itemStyle: { color: "rgba(255,255,255,0.22)", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      },
      {
        name: "Produção", type: "bar",
        data: data.map(d => d.producao),
        itemStyle: { color: "#4DB8FF", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      },
    ],
  };
}

function tvAreaOption(data: DayPoint[]): EChartsOption {
  return {
    animation: true, animationDuration: 700,
    backgroundColor: "transparent",
    tooltip: { ...darkTooltip, trigger: "axis" },
    legend: { top: 4, textStyle: { color: "rgba(255,255,255,0.8)", fontSize: 13 } },
    grid: { top: 44, right: 28, bottom: 44, left: 72 },
    xAxis: {
      type: "category",
      data: data.map(d => d.date),
      axisLabel: { ...darkAxisLabel },
      axisLine: darkAxisLine,
    },
    yAxis: {
      type: "value",
      axisLabel: { ...darkAxisLabel, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v) },
      splitLine: darkSplitLine,
      axisLine: darkAxisLine,
    },
    series: [
      {
        name: "Produção Real", type: "line",
        data: data.map(d => d.producao),
        smooth: true, symbol: "circle", symbolSize: 5,
        lineStyle: { color: "#4DB8FF", width: 3 },
        itemStyle: { color: "#4DB8FF" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: "#4DB8FF44" }, { offset: 1, color: "#4DB8FF00" }],
          },
        },
      },
      {
        name: "Meta", type: "line",
        data: data.map(d => Math.round(d.meta)),
        smooth: false,
        lineStyle: { color: "#F59E0B", width: 2, type: "dashed" },
        itemStyle: { color: "#F59E0B" },
        symbol: "none",
      },
    ],
  };
}

function tvPieOption(data: TurnoPoint[]): EChartsOption {
  const colors = ["#4DB8FF", "#22C55E", "#F59E0B"];
  return {
    animation: true, animationDuration: 700,
    backgroundColor: "transparent",
    tooltip: { ...darkTooltip, trigger: "item" },
    legend: {
      bottom: 12,
      textStyle: { color: "rgba(255,255,255,0.8)", fontSize: 15 },
      itemWidth: 18, itemHeight: 12,
    },
    series: [{
      type: "pie",
      radius: ["38%", "70%"],
      center: ["50%", "46%"],
      data: data.filter(d => d.value > 0).map((d, i) => ({
        ...d,
        itemStyle: { color: colors[i % colors.length] },
        label: {
          show: true,
          formatter: "{b}\n{d}%",
          fontSize: 14,
          color: "#fff",
          lineHeight: 20,
        },
        labelLine: { lineStyle: { color: "rgba(255,255,255,0.4)" } },
      })),
      padAngle: 4,
      itemStyle: { borderRadius: 6, borderColor: "rgba(0,29,61,0.6)", borderWidth: 3 },
    }],
  };
}

// ─── Shared micro-components ────────────────────────────────────────────────────

const KPICard = ({
  label, value, unit, color, sublabel,
}: {
  label: string; value: string; unit?: string; color: string; sublabel?: string;
}) => (
  <div style={{
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "24px 24px 20px",
    display: "flex", flexDirection: "column",
    alignItems: "flex-start", justifyContent: "space-between",
    gap: 8,
  }}>
    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {label}
    </div>
    <div>
      <div style={{ color, fontSize: 52, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {unit && (
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          {unit}
        </div>
      )}
    </div>
    {sublabel && (
      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{sublabel}</div>
    )}
  </div>
);

const RankRow = ({
  rank, name, pct, accent,
}: {
  rank: number; name: string; pct: number; accent: string;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: accent, color: "#fff",
      fontSize: 14, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {rank}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: `${Math.min(pct, 100)}%`,
          background: pctColor(pct),
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
    <div style={{
      color: pctColor(pct), fontSize: 18, fontWeight: 800,
      background: `${pctColor(pct)}18`,
      borderRadius: 8, padding: "4px 12px",
      flexShrink: 0,
    }}>
      {pct}%
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
  const pctCol = pctGeral >= 100 ? "#22C55E" : pctGeral >= 80 ? "#F59E0B" : "#EF4444";
  const TrendIcon = tendency === null ? Minus : tendency > 0 ? TrendingUp : TrendingDown;
  const trendColor = tendency === null ? "#9CA3AF" : tendency > 0 ? "#22C55E" : "#EF4444";
  const topAccents = ["#22C55E", "#16A34A", "#15803D"];
  const botAccents = ["#EF4444", "#F97316", "#F59E0B"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* Row 1 — 4 KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KPICard
          label="Produção Total"
          value={totalProd.toLocaleString("pt-BR")}
          unit="peças produzidas"
          color="#4DB8FF"
        />
        <KPICard
          label="Meta Global"
          value={totalMeta.toLocaleString("pt-BR")}
          unit="peças esperadas"
          color="rgba(255,255,255,0.55)"
        />
        <KPICard
          label="% Atingimento"
          value={`${pctGeral}%`}
          unit={pctGeral >= 100 ? "meta atingida" : pctGeral >= 80 ? "dentro da faixa" : "abaixo da meta"}
          color={pctCol}
        />
        {/* Tendency card — manual layout for icon */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, padding: "24px 24px 20px",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Tendência
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <TrendIcon size={44} color={trendColor} strokeWidth={2.5} />
            <div>
              <div style={{ color: trendColor, fontSize: 48, fontWeight: 900, lineHeight: 1 }}>
                {tendency !== null ? `${tendency > 0 ? "+" : ""}${tendency}%` : "—"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>
                vs período anterior
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 — Top 3 / Bottom 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1 }}>
        <div style={{
          background: "rgba(34,197,94,0.07)",
          border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 16, padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ color: "#22C55E", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            ▲ Top 3 Melhores
          </div>
          {top3.length > 0
            ? top3.map((m, i) => <RankRow key={m.id} rank={i + 1} name={m.name} pct={m.pct} accent={topAccents[i]} />)
            : <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>Sem dados suficientes</p>
          }
        </div>
        <div style={{
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 16, padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ color: "#EF4444", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            ▼ Precisam de Atenção
          </div>
          {bot3.length > 0
            ? bot3.map((m, i) => <RankRow key={m.id} rank={i + 1} name={m.name} pct={m.pct} accent={botAccents[i]} />)
            : <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>Sem dados suficientes</p>
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
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 12 }}>
        Ordenado por % de atingimento da meta
      </p>
      <ReactEChartsCore option={option} style={{ height: chartH }} notMerge lazyUpdate />
    </div>
  );
};

const SlideProdVsMeta = ({ option }: { option: EChartsOption }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 12 }}>
      Produção real acumulada vs meta estabelecida por máquina
    </p>
    <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />
  </div>
);

const SlideTendencia = ({ option }: { option: EChartsOption }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 12 }}>
      Evolução diária da produção total no período filtrado
    </p>
    <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />
  </div>
);

const SlideTurnos = ({
  option, turnoAgg, totalProd,
}: { option: EChartsOption; turnoAgg: TurnoPoint[]; totalProd: number }) => {
  const colors = ["#4DB8FF", "#22C55E", "#F59E0B"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, flex: 1, alignItems: "center" }}>
      <ReactEChartsCore option={option} style={{ height: CHART_H }} notMerge lazyUpdate />

      {/* Breakdown sidebar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {turnoAgg.filter(t => t.value > 0).map((t, i) => {
          const pct = totalProd > 0 ? Math.round(t.value / totalProd * 100) : 0;
          return (
            <div key={t.name} style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${colors[i % colors.length]}33`,
              borderLeft: `4px solid ${colors[i % colors.length]}`,
              borderRadius: 12, padding: "16px 20px",
            }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t.name}
              </div>
              <div style={{ color: colors[i % colors.length], fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>
                {t.value.toLocaleString("pt-BR")}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 2 }}>
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
        <CheckCircle2 size={80} color="#22C55E" strokeWidth={1.5} />
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#22C55E", fontSize: 40, fontWeight: 900 }}>Todas dentro da meta!</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, marginTop: 8 }}>
            {totalMachines} máquina{totalMachines !== 1 ? "s" : ""} com performance ≥ 80%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AlertTriangle size={22} color="#F59E0B" />
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
          <strong style={{ color: "#F59E0B" }}>{alertMachines.length}</strong> de {totalMachines} máquinas abaixo de 80% da meta
        </p>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(alertMachines.length, 3)}, 1fr)`,
        gap: 16, flex: 1,
      }}>
        {alertMachines.map(m => {
          const col = m.pct >= 60 ? "#F59E0B" : "#EF4444";
          return (
            <div key={m.id} style={{
              background: `${col}0D`,
              border: `1px solid ${col}33`,
              borderTop: `3px solid ${col}`,
              borderRadius: 14, padding: "22px 24px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {m.name}
              </div>
              <div style={{ color: col, fontSize: 52, fontWeight: 900, lineHeight: 1 }}>
                {m.pct}%
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(m.pct, 100)}%`,
                  background: col, borderRadius: 4,
                  transition: "width 0.8s ease",
                }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                {m.totalProd.toLocaleString("pt-BR")} / {m.totalMeta.toLocaleString("pt-BR")} pç
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main TVMode component ──────────────────────────────────────────────────────

const TVMode = ({
  machAgg, dayAgg, turnoAgg, barData, hbarData,
  totalProd, totalMeta, pctGeral, tendency,
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
  ], []);

  // Pre-computed dark chart options — only recomputed when upstream data changes
  const hbarOpt = useMemo(() => tvHBarOption(hbarData), [hbarData]);
  const barOpt  = useMemo(() => tvBarOption(barData),   [barData]);
  const areaOpt = useMemo(() => tvAreaOption(dayAgg),   [dayAgg]);
  const pieOpt  = useMemo(() => tvPieOption(turnoAgg),  [turnoAgg]);

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
    <div
      ref={containerRef}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        overflow: "hidden",
        background: "linear-gradient(145deg, #001D3D 0%, #003366 60%, #004080 100%)",
        display: "flex", flexDirection: "column",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header style={{
        height: 70, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
      }}>
        {/* Left: logo + slide title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "#0066B3", borderRadius: 8, padding: "6px 14px", flexShrink: 0 }}>
            <WEGLogo height={22} color="#fff" />
          </div>
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Modo Apresentação · Dashboard de Produção
            </div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>
              {slides[slide].label}
            </div>
          </div>
        </div>

        {/* Right: clock + slide counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{
              color: "#4DB8FF", fontSize: 30, fontWeight: 800,
              letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {timeStr}
            </div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 600, textTransform: "capitalize", marginTop: 3 }}>
              {dateStr}
            </div>
          </div>
          {/* Slide indicator pill */}
          <div style={{
            background: "rgba(0,102,179,0.35)",
            border: "1px solid rgba(77,184,255,0.3)",
            borderRadius: 10, padding: "8px 18px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === slide ? 20 : 7,
                  height: 7, borderRadius: 4,
                  background: i === slide ? "#4DB8FF" : "rgba(255,255,255,0.25)",
                  border: "none", cursor: "pointer",
                  transition: "all 0.3s ease",
                  padding: 0,
                }}
              />
            ))}
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginLeft: 6 }}>
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
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer style={{
        height: 60, flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center",
        gap: 14, padding: "0 28px",
      }}>
        {/* Animated progress bar — key={slide} forces re-mount on every slide change, restarting animation */}
        <div style={{
          flex: 1, height: 4,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 4, overflow: "hidden",
        }}>
          <div
            key={slide}
            style={{
              height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg, #4DB8FF, #0095FF)",
              animation: `tvSlideProgress ${SLIDE_DURATION_MS}ms linear forwards`,
            }}
          />
        </div>

        {/* Prev */}
        <button
          onClick={() => goTo(slide - 1)}
          title="Slide anterior"
          style={{
            width: 48, height: 48, borderRadius: 10,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
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
            width: 48, height: 48, borderRadius: 10,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
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
            borderRadius: 10, border: "none",
            background: "#EF4444", color: "#fff",
            fontSize: 15, fontWeight: 800,
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
