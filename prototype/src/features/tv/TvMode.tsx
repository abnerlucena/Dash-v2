import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ELAPSED_DATES,
  MACHINES,
  REFERENCE_DATE,
  SHIFT_META,
  WORKING_DAYS,
  STATUS_META,
  aggregate,
  plantSeries,
  shiftTotals,
  statusFor,
  type Status,
} from "@/data/machines";
import { cn, formatNumber, readToken } from "@/lib/utils";
import { BURNUP_LEGEND, BurnupChart } from "@/components/data/BurnupChart";
import { Legend } from "@/components/data/Chart";
import { SHIFT_FILL } from "@/components/data/StackedBar";
import { IconButton } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { WegTile } from "@/components/ui/Misc";

const FILL: Record<Status, string> = {
  critical: "bg-danger-bold",
  attention: "bg-warning-bold",
  near: "bg-information-bold",
  achieved: "bg-success-bold",
};
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/**
 * Modo TV: telão no chão de fábrica. Sempre no tema escuro, números grandes,
 * rotação automática de slides. ← → navegam, Espaço pausa, F tela cheia,
 * Esc sai.
 */
export function TvMode({ onExit }: { onExit: () => void }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(new Date());
  const [fullscreen, setFullscreen] = useState(false);

  const totals = aggregate(MACHINES);
  const status = statusFor(totals.percent);

  const slides: Array<{ title: string; body: ReactNode }> = [
    {
      title: "Visão geral de março",
      body: (
        <div className="grid h-full grid-cols-1 content-center gap-400 m:grid-cols-2">
          <div className="flex flex-col gap-150">
            <span className="font-tv-body text-subtle">Produção no mês</span>
            <span className="font-tv-hero text-default">{formatNumber(totals.produced)}</span>
            <span className="font-tv-body text-subtlest">de {formatNumber(totals.target)} previstos</span>
          </div>
          <div className="flex flex-col gap-150">
            <span className="font-tv-body text-subtle">Atingimento da meta</span>
            <span className="flex items-center gap-300">
              <span className="font-tv-hero text-default">{totals.percent}%</span>
              <span className={cn("rounded-small px-150 py-050 font-tv-body", STATUS_TONE[status])}>{STATUS_META[status].label}</span>
            </span>
            <span className="font-tv-body text-subtlest">Faltam {WORKING_DAYS - ELAPSED_DATES.length} dias úteis</span>
          </div>
          <div className="flex flex-col gap-150">
            <span className="font-tv-body text-subtle">Taxa de apontamento</span>
            <span className="font-tv-metric text-default">{totals.entryRate}%</span>
          </div>
          <div className="flex flex-col gap-150">
            <span className="font-tv-body text-subtle">Máquinas ativas</span>
            <span className="font-tv-metric text-default">
              {totals.count} <span className="font-tv-body text-subtle">de {MACHINES.length}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Atingimento por máquina",
      body: (
        <ul className="flex h-full flex-col justify-center gap-250">
          {[...MACHINES]
            .sort((a, b) => b.percent - a.percent)
            .map((m) => (
              <li key={m.id} className="grid grid-cols-tv items-center gap-300">
                <span className="truncate font-tv-body text-default">{m.name}</span>
                <span className="relative h-400 rounded-r-small bg-neutral">
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 rounded-r-small", FILL[m.status])}
                    style={{ width: `${Math.min(m.percent, 100)}%` }}
                  />
                </span>
                <span className="flex items-center gap-200">
                  <span className="font-tv-metric text-default">{m.percent}%</span>
                  <span className={cn("rounded-small px-100 py-025 font-body-large font-semibold", STATUS_TONE[m.status])}>
                    {STATUS_META[m.status].label}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      ),
    },
    {
      title: "Produção acumulada vs meta",
      body: (
        <div className="flex h-full flex-col gap-200">
          <Legend items={BURNUP_LEGEND} className="font-tv-body" />
          <div className="min-h-0 flex-1">
            <BurnupChart series={plantSeries(MACHINES)} label="Produção acumulada vs meta" heightClass="h-full" />
          </div>
        </div>
      ),
    },
    {
      title: "Produção por turno",
      body: (
        <div className="grid h-full grid-cols-1 content-center gap-400 m:grid-cols-3">
          {shiftTotals(MACHINES).map((t) => {
            const pct = Math.round((t.produced / t.target) * 100);
            const st = statusFor(pct);
            return (
              <div key={t.shift} className="flex flex-col gap-150 rounded-xlarge bg-surface-raised p-400 shadow-raised">
                <span className="flex items-center gap-150 font-tv-body text-subtle">
                  <span aria-hidden className={cn("size-200 rounded-full", SHIFT_FILL[t.shift])} />
                  {SHIFT_META[t.shift].label} · {SHIFT_META[t.shift].hours}
                </span>
                <span className="font-tv-metric text-default">{formatNumber(t.produced)}</span>
                <span className="flex items-center gap-150 font-tv-body text-subtle">
                  {pct}% da meta
                  <span className={cn("rounded-small px-100 py-025 font-body-large font-semibold", STATUS_TONE[st])}>
                    {STATUS_META[st].label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  const go = useCallback((dir: number) => setSlide((s) => (s + dir + slides.length) % slides.length), [slides.length]);

  // Relógio
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Rotação automática; a troca manual reinicia o tempo (a key reinicia a barra)
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => go(1), readToken("--dash-tv-slide-duration"));
    return () => window.clearTimeout(t);
  }, [slide, paused, go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") setPaused((p) => !p);
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement) onExit();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen, onExit]);

  const current = slides[slide];

  return (
    // data-color-mode="dark" aplica os tokens escuros só neste bloco
    <div data-color-mode="dark" className="flex h-dvh flex-col bg-surface text-default">
      <header className="flex flex-wrap items-center gap-300 border-b px-400 py-200">
        <span className="flex items-center gap-150">
          <WegTile />
          <span className="flex flex-col">
            <span className="font-heading-small">Dash de Produção</span>
            <span className="font-body-small text-subtle">Fábrica · Jaraguá do Sul</span>
          </span>
        </span>
        <h1 className="min-w-0 flex-1 truncate text-center font-tv-title">{current.title}</h1>
        <span className="flex flex-col items-end">
          <span className="font-tv-body tabular-nums">{clock.format(now)}</span>
          {/* hora ao vivo; a data é a de referência dos dados do protótipo */}
          <span className="font-body-small text-subtle first-letter:uppercase">{today.format(REFERENCE_DATE)}</span>
        </span>
      </header>

      <main aria-live="polite" className="min-h-0 flex-1 px-600 py-400">
        <div key={slide} className="h-full animate-fade-in">
          {current.body}
        </div>
      </main>

      <footer className="flex items-center gap-200 border-t px-400 py-150">
        <span className="flex items-center gap-050">
          <IconButton icon={ChevronLeft} label="Slide anterior" shortcut="←" onClick={() => go(-1)} />
          <IconButton icon={paused ? Play : Pause} label={paused ? "Retomar rotação" : "Pausar rotação"} shortcut="Espaço" onClick={() => setPaused((p) => !p)} />
          <IconButton icon={ChevronRight} label="Próximo slide" shortcut="→" onClick={() => go(1)} />
        </span>
        <ol aria-label="Slides" className="flex flex-1 items-center gap-100">
          {slides.map((s, i) => (
            <li key={s.title} className="flex-1">
              <button
                type="button"
                aria-label={`${i + 1}. ${s.title}`}
                aria-current={i === slide ? "step" : undefined}
                onClick={() => setSlide(i)}
                className="block h-control-compact w-full"
              >
                <span className="relative block h-050 overflow-hidden rounded-full bg-neutral">
                  {i < slide && <span className="absolute inset-0 bg-neutral-bold" />}
                  {i === slide && (
                    <span
                      key={`${slide}-${paused}`}
                      className={cn("absolute inset-0 origin-left bg-brand-bold", paused ? "" : "animate-tv-progress")}
                    />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <Lozenge>{paused ? "Pausado" : `${slide + 1} de ${slides.length}`}</Lozenge>
        <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} shortcut="F" onClick={toggleFullscreen} />
        <IconButton icon={X} label="Sair do Modo TV" shortcut="Esc" onClick={onExit} />
      </footer>
    </div>
  );
}

// Tom de status em tamanho grande (mesma dupla dos lozenges)
const STATUS_TONE: Record<Status, string> = {
  critical: "bg-danger text-danger",
  attention: "bg-warning text-warning",
  near: "bg-information text-information",
  achieved: "bg-success text-success",
};
