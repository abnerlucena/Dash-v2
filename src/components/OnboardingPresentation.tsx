import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { BarChart2, CalendarDays, ClipboardList, CheckCircle2, ArrowDown, X } from "lucide-react";

interface OnboardingPresentationProps {
  onComplete: () => void;
}

const NAVY = "#001D3D";
const BLUE = "#0066B3";

// Reusable section observer hook
function useSectionVisible(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.25 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useSectionVisible(ref);
  return (
    <div ref={ref} className={`min-h-screen flex flex-col items-center justify-center px-6 py-16 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="w-full max-w-2xl mx-auto"
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── Mock charts ───────────────────────────────────────────────

const barChartOption = {
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: "category",
    data: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    axisLine: { lineStyle: { color: "#ddd" } },
    axisLabel: { color: "#888", fontSize: 11 },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#888", fontSize: 11 },
    splitLine: { lineStyle: { color: "#f0f0f0" } },
  },
  series: [
    {
      name: "Produção",
      type: "bar",
      barMaxWidth: 36,
      data: [1820, 2100, 1950, 2300, 2080, 1640],
      itemStyle: {
        color: {
          type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: BLUE }, { offset: 1, color: "#0088CC" }],
        },
        borderRadius: [4, 4, 0, 0],
      },
    },
    {
      name: "Meta",
      type: "line",
      data: [2000, 2000, 2000, 2000, 2000, 2000],
      lineStyle: { color: "#F59E0B", type: "dashed", width: 2 },
      symbol: "none",
    },
  ],
};

const heatmapOption = {
  backgroundColor: "transparent",
  tooltip: {
    formatter: (p: any) => `Semana ${p.data[1] + 1}, ${["Seg","Ter","Qua","Qui","Sex"][p.data[0]]}: ${p.data[2]}%`,
  },
  grid: { left: 50, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: "category",
    data: ["Seg", "Ter", "Qua", "Qui", "Sex"],
    axisLabel: { color: "#888", fontSize: 11 },
    splitArea: { show: true, areaStyle: { color: ["#fafafa", "#fff"] } },
  },
  yAxis: {
    type: "category",
    data: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
    axisLabel: { color: "#888", fontSize: 11 },
    splitArea: { show: true, areaStyle: { color: ["#fafafa", "#fff"] } },
  },
  visualMap: {
    min: 60, max: 120,
    calculable: true,
    orient: "horizontal",
    left: "center", bottom: -8,
    inRange: { color: ["#EF4444", "#F59E0B", "#22C55E"] },
    textStyle: { color: "#888", fontSize: 10 },
  },
  series: [{
    type: "heatmap",
    data: [
      [0,0,92],[1,0,78],[2,0,105],[3,0,87],[4,0,113],
      [0,1,88],[1,1,95],[2,1,72],[3,1,110],[4,1,98],
      [0,2,115],[1,2,80],[2,2,102],[3,2,91],[4,2,76],
      [0,3,96],[1,3,108],[2,3,85],[3,3,119],[4,3,93],
    ],
    label: { show: true, formatter: (p: any) => p.data[2] + "%", fontSize: 10, color: "#fff" },
    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
  }],
};

// ── Main component ────────────────────────────────────────────

const OnboardingPresentation = ({ onComplete }: OnboardingPresentationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setScrollPct(scrollHeight <= clientHeight ? 100 : (scrollTop / (scrollHeight - clientHeight)) * 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[200] overflow-hidden"
        style={{ background: "#f8fafc" }}
      >
        {/* Progress bar */}
        <div className="fixed top-0 left-0 right-0 h-1 z-[201]" style={{ background: "#e2e8f0" }}>
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${NAVY}, ${BLUE})`, width: `${scrollPct}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={onComplete}
          className="fixed top-4 right-4 z-[201] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
          Pular
        </button>

        {/* Scrollable content */}
        <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth">

          {/* ── SECTION 1 — Hero ───────────────────────────────── */}
          <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
            style={{ background: `linear-gradient(160deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-xl mx-auto"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <BarChart2 size={32} color="#fff" />
              </div>
              <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight">
                Dashboard de Produção
              </h1>
              <p className="text-white/75 text-lg mb-10 leading-relaxed">
                Seu painel de controle para acompanhar e registrar a produção da linha WEG — em tempo real, de qualquer lugar.
              </p>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="text-white/50 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Role para conhecer</span>
                <ArrowDown size={18} />
              </motion.div>
            </motion.div>
          </div>

          {/* ── SECTION 2 — Apontamento ────────────────────────── */}
          <Section>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
                style={{ background: `${BLUE}15` }}>
                <ClipboardList size={24} style={{ color: BLUE }} />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-3">Apontamento por Ordem</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Registre quantas ordens de produção quiser por máquina. O sistema calcula automaticamente o total e o atingimento de meta.
              </p>
            </div>
            {/* Mock form */}
            <div className="bg-card rounded-2xl border border-border shadow-md p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-3">HORIZONTAL 1 · Meta: 500 pç</p>
              {[
                { id: "7742", qtd: "220" },
                { id: "7743", qtd: "180" },
              ].map((o, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <div className="flex-1 h-9 rounded-md border border-border bg-muted/30 flex items-center px-3 text-sm text-muted-foreground">
                    #{o.id}
                  </div>
                  <div className="w-20 h-9 rounded-md border border-primary/30 bg-primary/5 flex items-center justify-center text-sm font-bold text-primary">
                    {o.qtd}
                  </div>
                  <div className="w-9 h-9 rounded-md bg-red-50 flex items-center justify-center text-red-400 text-xs">✕</div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-md px-3 py-1.5">+ Adicionar Ordem</span>
                <span className="text-xs text-muted-foreground">Total: <strong className="text-foreground">400 pç</strong> (2 ordens)</span>
              </div>
              <div className="h-1 bg-muted rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: "80%", background: "#F59E0B" }} />
              </div>
              <p className="text-right text-[10px] text-muted-foreground mt-1">80% da meta</p>
            </div>
          </Section>

          {/* ── SECTION 3 — Calendário ─────────────────────────── */}
          <Section style={{ background: "#f1f5f9" } as React.CSSProperties}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
                style={{ background: `${BLUE}15` }}>
                <CalendarDays size={24} style={{ color: BLUE }} />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-3">Calendário Interativo</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Visualize a produção dia a dia, identifique feriados e clique em qualquer data para ver o detalhamento completo por turno e máquina.
              </p>
            </div>
            {/* Mock calendar */}
            <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: NAVY }}>
                <span className="text-sm font-bold text-white">Abril 2026</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: BLUE, color: "#fff" }}>Hoje</span>
              </div>
              <div className="grid grid-cols-7 text-center py-2 border-b border-border" style={{ background: "#F8FAFC" }}>
                {["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map(d => (
                  <span key={d} className="text-[10px] font-bold text-muted-foreground">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-border">
                {[null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,null,null,null].slice(0,28).map((d, i) => (
                  <div key={i} className={`p-2 border-b border-border ${d ? "hover:bg-muted/30 cursor-pointer" : "bg-muted/20"}`}
                    style={{ minHeight: 56, background: d === 15 ? "#EFF6FF" : undefined }}>
                    {d && (
                      <>
                        <span className={`text-xs font-bold ${d === 15 ? "text-primary" : "text-foreground"}`}>{d}</span>
                        {[3,7,10,14,15,17,21,24,28].includes(d) && (
                          <div className="mt-1 text-[9px] font-semibold px-1 py-0.5 rounded truncate"
                            style={{ background: "#0066B315", color: BLUE }}>
                            {d === 14 ? "Feriado 🎉" : `${Math.floor(Math.random() * 5) + 1}k pç`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── SECTION 4 — Analytics ──────────────────────────── */}
          <Section>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
                style={{ background: `${BLUE}15` }}>
                <BarChart2 size={24} style={{ color: BLUE }} />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-3">Análises Avançadas</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Gráficos de tendência com anotações automáticas, mapas de calor por máquina e semana, e insights gerados automaticamente.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border shadow-md p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Produção semanal vs. Meta</p>
                <ReactECharts option={barChartOption} style={{ height: 200 }} />
              </div>
              <div className="bg-card rounded-2xl border border-border shadow-md p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Mapa de Calor — Atingimento % por dia</p>
                <ReactECharts option={heatmapOption} style={{ height: 180 }} />
              </div>
            </div>
          </Section>

          {/* ── SECTION 5 — Exportação ─────────────────────────── */}
          <Section style={{ background: "#f1f5f9" } as React.CSSProperties}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-foreground mb-3">Exporte seus dados</h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Baixe relatórios em CSV ou PDF com um clique — com filtros de período, máquina e turno, e detalhamento de ordens de produção.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { format: "CSV", color: "#003366", desc: "Planilha editável para análise no Excel" },
                { format: "PDF", color: "#7c3aed", desc: "Relatório formatado com KPIs e tabela colorida" },
              ].map((item) => (
                <div key={item.format} className="bg-card rounded-2xl border border-border shadow-md p-5 text-center">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-extrabold text-sm"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}aa)` }}>
                    {item.format}
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">Exportar {item.format}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── SECTION 6 — Pronto! ────────────────────────────── */}
          <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
            style={{ background: `linear-gradient(160deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full max-w-lg mx-auto"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6 shadow-xl">
                <CheckCircle2 size={32} color="#fff" />
              </div>
              <h2 className="text-4xl font-extrabold text-white mb-4">Tudo pronto!</h2>
              <p className="text-white/75 text-lg mb-10 leading-relaxed">
                Você já conhece as principais funcionalidades. Comece agora a registrar a produção da sua linha.
              </p>
              <button
                onClick={onComplete}
                className="px-10 py-4 rounded-xl font-extrabold text-base transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: "#fff", color: NAVY, borderRadius: 14 }}>
                Começar a usar →
              </button>
            </motion.div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingPresentation;
