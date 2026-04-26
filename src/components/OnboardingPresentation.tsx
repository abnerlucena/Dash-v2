import { useEffect, useRef, useState, useMemo } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import ReactECharts from "echarts-for-react";
import {
  ClipboardEdit,
  LayoutDashboard,
  History,
  Target,
  MessageSquare,
  X,
  Plus,
  Save,
  Tv,
  Bell,
  Smartphone,
  Download,
  ArrowDown,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import WEGLogo from "@/components/WEGLogo";

interface OnboardingPresentationProps {
  onComplete: () => void;
}

// ── Paleta-tema por ato (todas derivam do navy/blue institucional) ─────────
const PALETTES = [
  { from: "#001022", to: "#001D3D", accent: "#3B82F6" }, // 0 cold
  { from: "#0B1230", to: "#1E2A5E", accent: "#60A5FA" }, // 1 apontamento
  { from: "#062046", to: "#0A3A78", accent: "#3B82F6" }, // 2 dashboard
  { from: "#082B5C", to: "#0066B3", accent: "#22D3EE" }, // 3 filtros
  { from: "#1E1B4B", to: "#312E81", accent: "#A78BFA" }, // 4 metas
  { from: "#0F172A", to: "#1E293B", accent: "#94A3B8" }, // 5 historico
  { from: "#083344", to: "#155E75", accent: "#22D3EE" }, // 6 feedbacks
  { from: "#1E293B", to: "#334155", accent: "#94A3B8" }, // 7 cantos
  { from: "#001D3D", to: "#0066B3", accent: "#FFFFFF" }, // 8 outro
];

// ── Hook: scrollProgress local de uma seção sticky ─────────────────────────
function useSectionProgress(ref: React.RefObject<HTMLDivElement | null>, container: React.RefObject<HTMLDivElement | null>) {
  const { scrollYProgress } = useScroll({
    target: ref,
    container,
    offset: ["start start", "end end"],
  });
  return scrollYProgress;
}

// ── Atom: número que conta animado ─────────────────────────────────────────
function MotionNumber({ value, format = (n: number) => Math.round(n).toLocaleString("pt-BR") }: { value: MotionValue<number>; format?: (n: number) => string }) {
  const [text, setText] = useState(() => format(value.get()));
  useMotionValueEvent(value, "change", (v) => setText(format(v)));
  return <span>{text}</span>;
}

// ── Atom: chrome de janela (browser-like) ───────────────────────────────────
function WindowChrome({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-white/[0.03]">
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        {label && <span className="ml-3 text-[10px] font-mono text-white/40 tracking-wider">{label}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Atom: eyebrow (numeração + verbo do ato) ───────────────────────────────
function Eyebrow({ index, verb }: { index: string; verb: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[11px] tracking-[0.25em] text-white/40">{index}</span>
      <span className="h-px w-8 bg-white/20" />
      <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/60">{verb}</span>
    </div>
  );
}

// ── Atom: display headline ─────────────────────────────────────────────────
function Display({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-white font-extrabold leading-[0.95] tracking-tight text-4xl sm:text-5xl md:text-6xl ${className}`}>
      {children}
    </h2>
  );
}

// ── Atom: parágrafo curto ──────────────────────────────────────────────────
function Lede({ children }: { children: React.ReactNode }) {
  return <p className="text-white/60 text-base sm:text-lg leading-relaxed mt-5 max-w-md">{children}</p>;
}

// ── Atom: frase-eco (cita o aprendizado em destaque) ───────────────────────
function Echo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 font-mono text-[11px] tracking-[0.2em] uppercase mt-8">
      → {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1 — Apontamento
// ─────────────────────────────────────────────────────────────────────────────
function OrderRow({ index, id, qtd }: { index: number; id: string; qtd: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ delay: index * 0.12, duration: 0.5, ease: "easeOut" }}
      className="flex items-center gap-2"
    >
      <div className="flex-1 h-9 rounded-md border border-white/10 bg-white/[0.02] flex items-center px-3 text-xs font-mono text-white/50">
        #{id}
      </div>
      <div className="w-20 h-9 rounded-md border border-blue-400/40 bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-300">
        {qtd}
      </div>
      <button className="w-9 h-9 rounded-md bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/30">
        <X size={12} />
      </button>
    </motion.div>
  );
}

function ApontamentoDemo({ progress }: { progress: MotionValue<number> }) {
  const orders = [
    { id: "7742", qtd: 220 },
    { id: "7743", qtd: 180 },
    { id: "8801", qtd: 145 },
  ];
  const total = useTransform(progress, [0, 0.5], [0, 545]);
  const pct = useTransform(progress, [0, 0.55], [0, 91]);
  const barWidth = useTransform(pct, (v) => `${Math.min(v, 100)}%`);

  return (
    <WindowChrome label="dash · apontamento">
      <div className="p-5 bg-[#0a0f1f]/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono tracking-wider text-white/30 uppercase">26 abr · turno 1</p>
            <p className="text-sm font-bold text-white mt-0.5">HORIZONTAL 1 · meta 600 pç</p>
          </div>
          <span className="text-[10px] font-mono text-white/40">3 / 18</span>
        </div>

        <div className="space-y-2">
          {orders.map((o, i) => (
            <OrderRow key={o.id} index={i} id={o.id} qtd={o.qtd} />
          ))}

          <motion.div
            style={{ opacity: useTransform(progress, [0.3, 0.5], [0.5, 1]) }}
            className="flex items-center justify-between pt-2"
          >
            <span className="text-[11px] font-semibold text-blue-300/80 border border-dashed border-blue-400/30 rounded-md px-3 py-1.5 flex items-center gap-1">
              <Plus size={11} /> Adicionar Ordem
            </span>
            <span className="text-[11px] text-white/50">
              Total: <strong className="text-white"><MotionNumber value={total} /></strong> pç
            </span>
          </motion.div>

          <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
            <motion.div
              className="h-full rounded-full"
              style={{ width: barWidth, background: "linear-gradient(90deg,#3B82F6,#22D3EE)" }}
            />
          </div>
          <p className="text-right text-[10px] font-mono text-white/40 mt-1">
            <MotionNumber value={pct} format={(n) => `${Math.round(n)}% da meta`} />
          </p>
        </div>

        <motion.div
          style={{ opacity: useTransform(progress, [0.45, 0.65], [0, 1]) }}
          className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-400/20"
        >
          <Save size={14} className="text-blue-300" />
          <span className="text-xs font-bold text-white">Salvar apontamento</span>
        </motion.div>
      </div>
    </WindowChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2 — Dashboard com 5 sub-abas (cross-fade pilotado pelo scroll)
// ─────────────────────────────────────────────────────────────────────────────
const SUB_TABS = ["Resumo", "Detalhado", "Turnos", "Gráficos", "Analytics"] as const;

function MiniBars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${(v / max) * 100}%`, background: `linear-gradient(180deg,${color},${color}55)` }}
        />
      ))}
    </div>
  );
}

function SubResumo() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { k: "Produção", v: "12.480", sub: "peças", c: "#3B82F6" },
        { k: "Meta", v: "13.200", sub: "peças", c: "#A78BFA" },
        { k: "OEE", v: "94%", sub: "atingimento", c: "#22D3EE" },
      ].map((kpi) => (
        <div key={kpi.k} className="rounded-lg p-3 bg-white/[0.03] border border-white/5">
          <p className="text-[9px] font-mono uppercase tracking-wider text-white/40">{kpi.k}</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: kpi.c }}>{kpi.v}</p>
          <p className="text-[9px] text-white/40 mt-0.5">{kpi.sub}</p>
        </div>
      ))}
      <div className="col-span-3 rounded-lg p-3 bg-white/[0.03] border border-white/5">
        <p className="text-[9px] font-mono uppercase tracking-wider text-white/40 mb-2">Produção semanal</p>
        <MiniBars data={[820, 1020, 940, 1180, 1080, 760, 0]} color="#3B82F6" />
      </div>
    </div>
  );
}

function SubDetalhado() {
  const rows = [
    { m: "HORIZONTAL 1", p: 2480, meta: 2400, pct: 103 },
    { m: "HORIZONTAL 2", p: 2120, meta: 2400, pct: 88 },
    { m: "VERTICAL 1", p: 1820, meta: 2000, pct: 91 },
    { m: "VERTICAL 2", p: 1640, meta: 2000, pct: 82 },
  ];
  return (
    <div className="rounded-lg overflow-hidden border border-white/5">
      {rows.map((r, i) => {
        const color = r.pct >= 100 ? "#22C55E" : r.pct >= 85 ? "#F59E0B" : "#EF4444";
        return (
          <div key={r.m} className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2.5 text-xs ${i % 2 ? "bg-white/[0.02]" : ""}`}>
            <span className="font-semibold text-white/80 truncate">{r.m}</span>
            <span className="font-mono text-white/50">{r.p.toLocaleString("pt-BR")} / {r.meta.toLocaleString("pt-BR")}</span>
            <span className="font-bold px-2 py-0.5 rounded-full text-[10px]" style={{ color, background: `${color}22` }}>
              {r.pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubTurnos() {
  const turnos = [
    { t: "TURNO 1", p: 5240, c: "#3B82F6" },
    { t: "TURNO 2", p: 4180, c: "#A78BFA" },
    { t: "TURNO 3", p: 3060, c: "#22D3EE" },
  ];
  const total = turnos.reduce((s, t) => s + t.p, 0);
  return (
    <div className="space-y-3">
      {turnos.map((t) => {
        const pct = (t.p / total) * 100;
        return (
          <div key={t.t}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-mono text-white/50">{t.t}</span>
              <span className="font-bold text-white">{t.p.toLocaleString("pt-BR")} <span className="text-white/40 font-mono text-[10px]">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/5">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.c }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubGraficos() {
  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { left: 30, right: 10, top: 10, bottom: 20 },
    xAxis: { type: "category", data: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 } },
    yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "rgba(255,255,255,0.3)", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } } },
    series: [
      {
        type: "line", smooth: true, symbol: "circle", symbolSize: 6,
        data: [1820, 2100, 1950, 2300, 2080, 1640],
        lineStyle: { color: "#3B82F6", width: 2.5 },
        itemStyle: { color: "#3B82F6", borderColor: "#0A1428", borderWidth: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(59,130,246,0.4)" }, { offset: 1, color: "rgba(59,130,246,0)" }] } },
      },
      {
        type: "line", smooth: true, symbol: "none",
        data: [2000, 2000, 2000, 2000, 2000, 2000],
        lineStyle: { color: "#A78BFA", width: 1.5, type: "dashed" },
      },
    ],
  }), []);
  return <div className="bg-white/[0.02] rounded-lg p-2 border border-white/5"><ReactECharts option={option} style={{ height: 180 }} /></div>;
}

function SubAnalytics() {
  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { left: 50, right: 10, top: 10, bottom: 20 },
    xAxis: { type: "category", data: ["Seg", "Ter", "Qua", "Qui", "Sex"], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 }, splitArea: { show: false } },
    yAxis: { type: "category", data: ["S1", "S2", "S3", "S4"], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10 }, splitArea: { show: false } },
    visualMap: { show: false, min: 60, max: 120, inRange: { color: ["#EF4444", "#F59E0B", "#22C55E"] } },
    series: [{
      type: "heatmap",
      data: [
        [0,0,92],[1,0,78],[2,0,105],[3,0,87],[4,0,113],
        [0,1,88],[1,1,95],[2,1,72],[3,1,110],[4,1,98],
        [0,2,115],[1,2,80],[2,2,102],[3,2,91],[4,2,76],
        [0,3,96],[1,3,108],[2,3,85],[3,3,119],[4,3,93],
      ],
      itemStyle: { borderColor: "#0A1428", borderWidth: 2, borderRadius: 3 },
      label: { show: true, formatter: (p: { data: [number, number, number] }) => p.data[2] + "%", fontSize: 9, color: "#fff", fontWeight: "bold" },
    }],
  }), []);
  return <div className="bg-white/[0.02] rounded-lg p-2 border border-white/5"><ReactECharts option={option} style={{ height: 180 }} /></div>;
}

function DashboardDemo({ progress }: { progress: MotionValue<number> }) {
  const [activeIdx, setActiveIdx] = useState(0);
  // Sub-tabs cross-fade: divide o progresso em 5 fatias, com overlap
  useMotionValueEvent(progress, "change", (v) => {
    const idx = Math.min(SUB_TABS.length - 1, Math.max(0, Math.floor(v * SUB_TABS.length)));
    if (idx !== activeIdx) setActiveIdx(idx);
  });

  const Slides = [SubResumo, SubDetalhado, SubTurnos, SubGraficos, SubAnalytics];

  return (
    <WindowChrome label="dash · dashboard">
      <div className="bg-[#0a0f1f]/40">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto">
          {SUB_TABS.map((t, i) => (
            <button
              key={t}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${i === activeIdx ? "bg-blue-500/20 text-blue-300" : "text-white/40"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative p-4 min-h-[260px]">
          {Slides.map((S, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ opacity: i === activeIdx ? 1 : 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0 p-4"
              style={{ pointerEvents: i === activeIdx ? "auto" : "none" }}
            >
              <S />
            </motion.div>
          ))}
        </div>
      </div>
    </WindowChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3 — Filtros & KPIs (números reagem ao scroll)
// ─────────────────────────────────────────────────────────────────────────────
function FiltrosDemo({ progress }: { progress: MotionValue<number> }) {
  const prod = useTransform(progress, [0.1, 0.9], [0, 12480]);
  const meta = useTransform(progress, [0.1, 0.9], [0, 13200]);
  const oee = useTransform(progress, [0.1, 0.9], [0, 94]);
  const reg = useTransform(progress, [0.1, 0.9], [0, 287]);

  // O "valor selecionado" do filtro de máquina muda na metade
  const [machine, setMachine] = useState("TODAS");
  useMotionValueEvent(progress, "change", (v) => {
    setMachine(v > 0.55 ? "HORIZONTAL 1" : "TODAS");
  });

  return (
    <div className="space-y-3">
      <WindowChrome label="filtros">
        <div className="bg-[#0a0f1f]/40 p-3 flex flex-wrap gap-2">
          {[
            { k: "De", v: "01/04" },
            { k: "Até", v: "25/04" },
            { k: "Máquina", v: machine, hot: machine !== "TODAS" },
            { k: "Turno", v: "Todos" },
          ].map((f) => (
            <div key={f.k} className={`flex-1 min-w-[80px] rounded-md px-3 py-2 border transition-colors ${f.hot ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/[0.02]"}`}>
              <p className="text-[9px] font-mono uppercase tracking-wider text-white/40">{f.k}</p>
              <p className="text-xs font-bold text-white mt-0.5 truncate">{f.v}</p>
            </div>
          ))}
        </div>
      </WindowChrome>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { k: "Produção", v: prod, c: "#3B82F6" },
          { k: "Meta", v: meta, c: "#A78BFA" },
          { k: "OEE", v: oee, c: "#22D3EE", suffix: "%" },
          { k: "Registros", v: reg, c: "#F59E0B" },
        ].map((kpi) => (
          <div key={kpi.k} className="rounded-lg p-3 bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: kpi.c }} />
            <p className="text-[9px] font-mono uppercase tracking-wider text-white/40 pl-2">{kpi.k}</p>
            <p className="text-xl font-extrabold mt-1 pl-2" style={{ color: kpi.c }}>
              <MotionNumber value={kpi.v} format={(n) => `${Math.round(n).toLocaleString("pt-BR")}${kpi.suffix || ""}`} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4 — Metas (slider move barra de atingimento)
// ─────────────────────────────────────────────────────────────────────────────
function MetasDemo({ progress }: { progress: MotionValue<number> }) {
  // meta sobe: usuário vê a régua mudando
  const meta = useTransform(progress, [0.1, 0.9], [400, 700]);
  const prod = 545; // produção fixa, real
  const pct = useTransform(meta, (m) => Math.round((prod / m) * 100));
  const sliderPct = useTransform(progress, [0.1, 0.9], [0, 100]);
  const sliderLeft = useTransform(sliderPct, (v) => `${Math.min(Math.max(v, 0), 100)}%`);
  const barWidth = useTransform(pct, (v) => `${Math.min(v, 100)}%`);
  const barColor = useTransform(pct, (v) => v >= 100 ? "#22C55E" : v >= 85 ? "#F59E0B" : "#EF4444");

  return (
    <WindowChrome label="dash · metas">
      <div className="bg-[#0a0f1f]/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-white">HORIZONTAL 1</p>
          <span className="text-[10px] font-mono text-white/40">vigência: 25 abr</span>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Meta por turno</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-violet-300">
              <MotionNumber value={meta} />
            </p>
            <span className="text-xs text-white/40">peças</span>
          </div>
          {/* Slider track */}
          <div className="relative h-2 bg-white/5 rounded-full mt-3">
            <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ width: sliderLeft, background: "linear-gradient(90deg,#312E81,#A78BFA)" }} />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-violet-300 shadow-[0_0_20px_rgba(167,139,250,0.6)] border-2 border-[#0a0f1f]"
              style={{ left: sliderLeft }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-mono text-white/40">Atingimento real</span>
            <span className="font-bold text-white">{prod} / <MotionNumber value={meta} /></span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ width: barWidth, background: barColor }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono text-white/30">% da meta</span>
            <motion.span className="text-sm font-extrabold" style={{ color: barColor }}>
              <MotionNumber value={pct} format={(n) => `${Math.round(n)}%`} />
            </motion.span>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 5 — Histórico & Exportação (calendário + modal flutuando)
// ─────────────────────────────────────────────────────────────────────────────
function HistoricoDemo({ progress }: { progress: MotionValue<number> }) {
  // Abril 2026: 1º cai numa quarta-feira. Padding 3 (Dom, Seg, Ter), 30 dias úteis até quinta 30/abr.
  const padStart = 3;
  const totalCells = padStart + 30;
  const cells: (number | null)[] = Array.from({ length: totalCells }, (_, i) =>
    i < padStart ? null : i - padStart + 1,
  );
  // Modal aparece cedo (não quero "buraco" enquanto usuário rola)
  const modalOpacity = useTransform(progress, [0.15, 0.45], [0, 1]);
  const modalY = useTransform(progress, [0.15, 0.45], [24, 0]);
  const modalScale = useTransform(progress, [0.15, 0.45], [0.96, 1]);
  // Realce de uma data quando o modal aparece
  const highlightDay = 15;

  return (
    <div className="space-y-4">
      <WindowChrome label="dash · histórico">
        <div className="bg-[#0a0f1f]/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white">Abril 2026</p>
            <span className="text-[10px] font-mono text-white/40">30 dias</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i} className="text-[9px] font-bold text-center text-white/30">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`p-${i}`} className="aspect-square" />;
              // intensidade pseudo-aleatória estável
              const intensity = (d * 37) % 100;
              const bg = intensity > 70 ? "#22C55E" : intensity > 40 ? "#F59E0B" : "#3B82F6";
              const opacity = intensity > 70 ? 0.65 : intensity > 40 ? 0.5 : 0.3;
              const isToday = d === 26;
              const isHl = d === highlightDay;
              return (
                <div
                  key={d}
                  className={`aspect-square rounded flex items-center justify-center text-[10px] font-bold text-white/85 relative ${isToday ? "ring-1 ring-white/60" : ""} ${isHl ? "ring-1 ring-blue-300/80" : ""}`}
                  style={{ background: `${bg}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </WindowChrome>

      <motion.div
        style={{ opacity: modalOpacity, y: modalY, scale: modalScale }}
        className="rounded-2xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md border border-white/10 p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-blue-300" />
            <span className="text-xs font-bold text-white">Exportar relatório</span>
          </div>
          <span className="text-[9px] font-mono text-white/40">15 abr · selecionado</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-blue-500/15 border border-blue-400/30 p-3 text-center">
            <p className="text-sm font-extrabold text-blue-200">CSV</p>
            <p className="text-[9px] text-white/50 mt-1">Editável no Excel</p>
          </div>
          <div className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-3 text-center">
            <p className="text-sm font-extrabold text-violet-200">PDF</p>
            <p className="text-[9px] text-white/50 mt-1">Relatório formatado</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 6 — Feedbacks (bolhas de observação)
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackBubble({ index, who, date, text }: { index: number; who: string; date: string; text: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ delay: index * 0.15, duration: 0.55, ease: "easeOut" }}
      className="flex gap-3"
    >
      <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400/30 to-cyan-600/30 border border-cyan-300/30 flex items-center justify-center">
        <MessageSquare size={14} className="text-cyan-200" />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/10 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-cyan-200">{who}</span>
          <span className="text-[9px] font-mono text-white/30">{date}</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );
}

function FeedbacksDemo() {
  const items = [
    { who: "Operador A · Turno 1", date: "24 abr · HORIZONTAL 1", text: "Parada de 40 min para troca de ferramenta. Retomado às 09:20." },
    { who: "Operador B · Turno 2", date: "24 abr · VERTICAL 1", text: "Lote com peça fora de tolerância — 12 peças refugadas." },
    { who: "Operador C · Turno 3", date: "25 abr · HORIZONTAL 2", text: "Sem ocorrências. Meta atingida com folga." },
  ];
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <FeedbackBubble key={i} index={i} who={it.who} date={it.date} text={it.text} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 7 — Pelos cantos (TVMode, BottomNav, Alertas)
// ─────────────────────────────────────────────────────────────────────────────
function CornerCard({ index, Icon, title, body, c }: { index: number; Icon: LucideIcon; title: string; body: string; c: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ delay: index * 0.12, duration: 0.55, ease: "easeOut" }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${c}22`, border: `1px solid ${c}44` }}>
        <Icon size={18} style={{ color: c }} />
      </div>
      <p className="text-base font-extrabold text-white mb-1">{title}</p>
      <p className="text-xs text-white/50 leading-relaxed">{body}</p>
    </motion.div>
  );
}

function CantosDemo() {
  const cards = [
    { Icon: Tv, title: "Modo TV", body: "Ative o painel para a fábrica. Atualização automática, fonte gigante.", c: "#3B82F6" },
    { Icon: Smartphone, title: "Mobile", body: "BottomNav com os 5 menus sempre à mão no celular.", c: "#A78BFA" },
    { Icon: Bell, title: "Alertas", body: "Configure avisos quando uma máquina ficar abaixo da meta.", c: "#22D3EE" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card, i) => (
        <CornerCard key={card.title} index={i} Icon={card.Icon} title={card.title} body={card.body} c={card.c} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — Frame de um ato (sticky)
// ─────────────────────────────────────────────────────────────────────────────
interface ActFrameProps {
  index: string;
  verb: string;
  title: React.ReactNode;
  lede: React.ReactNode;
  echo: string;
  demo: React.ReactNode;
  progress: MotionValue<number>;
  /** Posiciona o demo: "right" (default) ou "left" — alterna o ritmo. */
  side?: "right" | "left";
}

function ActFrame({ index, verb, title, lede, echo, demo, progress, side = "right" }: ActFrameProps) {
  const reduce = useReducedMotion();
  // Visível desde o início da seção (progress=0); fade-out apenas no fim do scroll-through
  const copyOpacity = useTransform(progress, [0, 0.85, 1], [1, 1, 0]);
  const copyY = useTransform(progress, [0, 0.85, 1], reduce ? [0, 0, 0] : [0, 0, -30]);
  const demoOpacity = useTransform(progress, [0, 0.85, 1], [1, 1, 0]);
  const demoScale = useTransform(progress, [0, 0.85, 1], reduce ? [1, 1, 1] : [1, 1, 0.97]);

  return (
    <div className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-6xl mx-auto w-full ${side === "left" ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <motion.div style={{ opacity: copyOpacity, y: copyY }} className="lg:max-w-md">
        <Eyebrow index={index} verb={verb} />
        <Display>{title}</Display>
        <Lede>{lede}</Lede>
        <Echo>{echo}</Echo>
      </motion.div>
      <motion.div style={{ opacity: demoOpacity, scale: demoScale }} className="w-full max-w-md mx-auto lg:mx-0">
        {demo}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLD OPEN scene
// ─────────────────────────────────────────────────────────────────────────────
function ColdOpenScene({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const logoScale = useTransform(progress, [0, 0.7, 1], reduce ? [1, 1, 1] : [1, 1, 0.9]);
  const logoOpacity = useTransform(progress, [0, 0.7, 1], [1, 1, 0]);
  const taglineOpacity = useTransform(progress, [0, 0.75, 1], [1, 1, 0]);
  const taglineY = useTransform(progress, [0, 0.75, 1], reduce ? [0, 0, 0] : [0, 0, -20]);
  const hintOpacity = useTransform(progress, [0, 0.6, 0.85], [1, 1, 0]);
  return (
    <div className="text-center max-w-2xl mx-auto">
      <motion.div style={{ scale: logoScale, opacity: logoOpacity }} className="flex justify-center mb-10">
        <WEGLogo height={64} color="#fff" />
      </motion.div>
      <motion.div style={{ opacity: taglineOpacity, y: taglineY }}>
        <Display className="text-5xl sm:text-6xl md:text-7xl">
          Onde a sua linha<br />
          <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">vira número.</span>
        </Display>
        <p className="text-white/50 text-base sm:text-lg mt-6 max-w-md mx-auto">
          Um tour rápido de 90 segundos pelo seu novo painel de produção.
        </p>
      </motion.div>
      <motion.div
        style={{ opacity: hintOpacity }}
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="mt-16 inline-flex flex-col items-center gap-2 text-white/40"
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Role para começar</span>
        <ArrowDown size={16} />
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CANTOS scene (header + 3 cards)
// ─────────────────────────────────────────────────────────────────────────────
function CantosScene({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const headerOpacity = useTransform(progress, [0, 0.85, 1], [1, 1, 0]);
  const headerY = useTransform(progress, [0, 0.85, 1], reduce ? [0, 0, 0] : [0, 0, -30]);
  return (
    <div className="max-w-5xl mx-auto w-full">
      <motion.div style={{ opacity: headerOpacity, y: headerY }} className="text-center mb-12">
        <Eyebrow index="07 / 07" verb="E mais" />
        <Display className="text-center mx-auto">Detalhes que importam<br />nos cantos.</Display>
        <p className="text-white/60 text-base mt-5 max-w-md mx-auto">
          Três recursos discretos que mudam como você vive o dashboard no dia a dia.
        </p>
      </motion.div>
      <CantosDemo />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION wrapper — gera o sticky de cada ato
// ─────────────────────────────────────────────────────────────────────────────
function Section({
  containerRef,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: (progress: MotionValue<number>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useSectionProgress(ref, containerRef);
  return (
    <section ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center px-6 sm:px-10 py-20">
        {children(progress)}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingPresentation = ({ onComplete }: OnboardingPresentationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Global scroll progress (driven by inner scrollable container)
  const { scrollYProgress } = useScroll({ container: containerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.4 });

  // Background interpolation across all palettes
  const bgFrom = useTransform(
    smoothProgress,
    PALETTES.map((_, i) => i / (PALETTES.length - 1)),
    PALETTES.map((p) => p.from),
  );
  const bgTo = useTransform(
    smoothProgress,
    PALETTES.map((_, i) => i / (PALETTES.length - 1)),
    PALETTES.map((p) => p.to),
  );
  const bgGradient = useTransform([bgFrom, bgTo], ([f, t]) => `linear-gradient(160deg, ${f} 0%, ${t} 100%)`);

  // Progress bar width
  const progressWidth = useTransform(smoothProgress, (v) => `${v * 100}%`);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* Animated background */}
      <motion.div className="absolute inset-0 -z-10" style={{ background: bgGradient }} />
      {/* Aura blobs (decorative) */}
      {!reduce && (
        <>
          <div className="absolute -top-1/4 -right-1/4 w-[60vw] h-[60vw] rounded-full opacity-30 blur-[120px] -z-10" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.6), transparent 60%)" }} />
          <div className="absolute -bottom-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full opacity-20 blur-[120px] -z-10" style={{ background: "radial-gradient(circle, rgba(167,139,250,0.6), transparent 60%)" }} />
        </>
      )}

      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-[201] bg-white/5">
        <motion.div className="h-full bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-300" style={{ width: progressWidth }} />
      </div>

      {/* Skip */}
      <button
        onClick={onComplete}
        className="fixed top-4 right-4 z-[201] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider text-white/60 hover:text-white border border-white/10 bg-white/[0.03] backdrop-blur-md transition-colors"
      >
        <X size={11} />
        Pular
      </button>

      {/* Scrollable container — barra de scroll escondida (cross-browser) */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-hidden scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >

        {/* ── COLD OPEN ─────────────────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => <ColdOpenScene progress={p} />}
        </Section>

        {/* ── ATO I — APONTAMENTO ───────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="01 / 07"
              verb="Aponte"
              title={<>Tudo começa onde<br />a peça é feita.</>}
              lede="Lance a produção por ordem em cada máquina. Quantas ordens quiser, por turno e data — o sistema soma o total e calcula o atingimento."
              echo="Apontamento alimenta tudo o que vem depois."
              demo={<ApontamentoDemo progress={p} />}
            />
          )}
        </Section>

        {/* ── ATO II — DASHBOARD ────────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="02 / 07"
              verb="Analise"
              title={<>Cinco lentes,<br />uma só verdade.</>}
              lede="Dashboard reúne Resumo, Detalhado, Turnos, Gráficos e Analytics. Mesma fonte de dados, perspectivas diferentes."
              echo="Role devagar para ver as 5 sub-abas se sucederem."
              demo={<DashboardDemo progress={p} />}
              side="left"
            />
          )}
        </Section>

        {/* ── ATO III — FILTROS & KPIs ──────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="03 / 07"
              verb="Filtre"
              title={<>O controle remoto<br />do seu painel.</>}
              lede="Período, máquina, turno. Os KPIs respondem em tempo real. Restrinja o foco — tudo se reorganiza ao redor."
              echo="Mesmos dados. Recortes diferentes."
              demo={<FiltrosDemo progress={p} />}
            />
          )}
        </Section>

        {/* ── ATO IV — METAS ────────────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="04 / 07"
              verb="Calibre"
              title={<>A régua<br />é sua.</>}
              lede="Defina metas por máquina, por turno, com data de vigência. O atingimento se reescreve em todo o dashboard."
              echo="Meta calibrada hoje, decisões mais nítidas amanhã."
              demo={<MetasDemo progress={p} />}
              side="left"
            />
          )}
        </Section>

        {/* ── ATO V — HISTÓRICO & EXPORT ────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="05 / 07"
              verb="Leve"
              title={<>O passado, do<br />jeito que precisar.</>}
              lede="Calendário diário, tabela detalhada, e exportação em CSV ou PDF — com filtros aplicados. Você viu, agora leva."
              echo="Cada visão pode virar um arquivo."
              demo={<HistoricoDemo progress={p} />}
            />
          )}
        </Section>

        {/* ── ATO VI — FEEDBACKS ────────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => (
            <ActFrame
              progress={p}
              index="06 / 07"
              verb="Comente"
              title={<>O número<br />ganha contexto.</>}
              lede="Cada apontamento aceita uma observação. Feedbacks reúne tudo num lugar — o porquê por trás do que aconteceu."
              echo="Por trás de cada queda, uma história."
              demo={<FeedbacksDemo />}
              side="left"
            />
          )}
        </Section>

        {/* ── ATO VII — PELOS CANTOS ────────────────────────────── */}
        <Section containerRef={containerRef}>
          {(p) => <CantosScene progress={p} />}
        </Section>

        {/* ── OUTRO ─────────────────────────────────────────────── */}
        <section className="relative h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-10">
              {[
                { Icon: ClipboardEdit, label: "Apontar" },
                { Icon: LayoutDashboard, label: "Dashboard" },
                { Icon: History, label: "Histórico" },
                { Icon: Target, label: "Metas" },
                { Icon: MessageSquare, label: "Feedbacks" },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md flex items-center justify-center">
                    <m.Icon size={20} className="text-white/80" />
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">{m.label}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Display className="text-5xl sm:text-6xl md:text-7xl">Tudo pronto.</Display>
              <p className="text-white/60 text-base sm:text-lg mt-5 max-w-md mx-auto">
                Lance, analise, calibre, leve e comente. O ciclo é seu.
              </p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              onClick={onComplete}
              className="mt-12 group inline-flex items-center gap-3 pl-7 pr-5 py-4 rounded-full font-bold text-sm bg-white text-slate-900 hover:bg-white/95 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_60px_-10px_rgba(255,255,255,0.4)]"
            >
              Começar a usar
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={14} />
              </span>
            </motion.button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default OnboardingPresentation;
