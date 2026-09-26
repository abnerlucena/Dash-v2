import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn, readToken } from "@/lib/utils";

// Só os módulos usados entram no pacote (tree-shaking). SVG: texto nítido em qualquer zoom.
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, SVGRenderer]);

/** Cores e medidas do tema atual, lidas do tokens.css (o ECharts não entende var()). */
export interface ChartTheme {
  brand: string;
  neutral: string;
  gridline: string;
  target: string;
  text: string;
  textSubtle: string;
  textSubtlest: string;
  textSuccess: string;
  textDanger: string;
  /** paleta categórica validada (montagem, embalagem, …) */
  categorical: [string, string, string];
  status: { critical: string; attention: string; near: string; achieved: string };
  areaOpacity: number;
  line: number;
  marker: number;
  radius: number;
  fontFamily: string;
  fontSize: number;
  tvFontSize: number;
  dash: number[];
  duration: number;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
/** Tamanho de um token de fonte ("400 0.75rem / 1rem Inter…") em px */
const fontPx = (name: string) => parseFloat(css(name).match(/([\d.]+)rem/)?.[1] ?? "0") * rootPx();

/**
 * Cor de token → rgb()/rgba(). O ECharts não interpreta a sintaxe moderna
 * "hsl(207 100% 62%)" ao animar cores (as séries sumiam na troca de tema);
 * o navegador faz a conversão.
 */
let probe: HTMLSpanElement | null = null;
const color = (name: string) => {
  if (!probe) {
    probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
  }
  probe.style.color = css(name);
  return getComputedStyle(probe).color;
};

function readTheme(): ChartTheme {
  return {
    brand: color("--ds-chart-brand"),
    neutral: color("--ds-chart-neutral"),
    gridline: color("--ds-chart-gridline"),
    target: color("--ds-chart-target"),
    text: color("--ds-text"),
    textSubtle: color("--ds-text-subtle"),
    textSubtlest: color("--ds-text-subtlest"),
    textSuccess: color("--ds-text-success"),
    textDanger: color("--ds-text-danger"),
    categorical: [color("--ds-chart-categorical-1"), color("--ds-chart-categorical-2"), color("--ds-chart-categorical-3")],
    status: {
      critical: color("--ds-background-danger-bold"),
      attention: color("--ds-background-warning-bold"),
      near: color("--ds-background-information-bold"),
      achieved: color("--ds-background-success-bold"),
    },
    areaOpacity: readToken("--ds-opacity-chart-area"),
    line: readToken("--dash-chart-line"),
    marker: readToken("--dash-chart-marker"),
    radius: readToken("--ds-radius-small"),
    fontFamily: css("--ds-font-family-body"),
    fontSize: fontPx("--ds-font-body-small"),
    tvFontSize: fontPx("--dash-font-tv-body"),
    dash: css("--dash-chart-dash").split(/\s+/).map(Number),
    // Entrada curta como o resto da interface; zero com "reduzir movimento"
    duration: readToken("--ds-motion-duration-panel"),
  };
}

/** Tema do gráfico; relê os tokens quando o modo de cor muda (data-color-mode no <html>). */
export function useChartTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/** Base comum: fonte e animação. A descrição acessível é nossa (em pt-BR), não a do ECharts. */
export function baseOption(t: ChartTheme, fontSize = t.fontSize) {
  return {
    animationDuration: t.duration,
    animationDurationUpdate: t.duration,
    animationEasing: "cubicOut" as const,
    animationEasingUpdate: "cubicOut" as const,
    textStyle: { fontFamily: t.fontFamily, fontSize, color: t.textSubtlest },
  };
}

/**
 * Tooltip no visual do protótipo. O container do ECharts fica transparente
 * (ele existe mesmo escondido); a caixa vem no HTML, com as classes do ChartTooltip.
 * confine: nunca sai da área do gráfico (nem corta na borda do card).
 */
export const tooltipBase = {
  confine: true,
  backgroundColor: "transparent",
  borderWidth: 0,
  padding: 0,
  extraCssText: "box-shadow: none;",
  transitionDuration: 0,
};

/** Eixos no padrão dos gráficos do app: sem traços, grade sutil, rótulos subtlest. */
export function axisStyle(t: ChartTheme, fontSize = t.fontSize) {
  return {
    axisLine: { lineStyle: { color: t.gridline } },
    axisTick: { show: false },
    // primeiro/último rótulo alinhados para dentro: não cortam na borda
    // (o ECharts não herda o tamanho global nos eixos: vai explícito)
    axisLabel: { color: t.textSubtlest, fontSize, hideOverlap: true, alignMinLabel: "left" as const, alignMaxLabel: "right" as const },
    splitLine: { lineStyle: { color: t.gridline } },
  };
}

export interface TooltipRow {
  value: string;
  label: string;
  swatch?: string;
  dashed?: boolean;
}

/** HTML do tooltip: valor em destaque, rótulo depois (mesmo padrão do resto do app). */
export function tooltipHtml(title: string, rows: TooltipRow[]) {
  const items = rows
    .map(
      (r) =>
        `<li class="flex items-center gap-100">${
          r.swatch
            ? `<span class="w-150 shrink-0 ${r.dashed ? "border-t-thick border-dashed" : "h-splitter-line rounded-full"}" style="${
                r.dashed ? `border-color:${r.swatch}` : `background:${r.swatch}`
              }"></span>`
            : ""
        }<span class="font-semibold tabular-nums text-default">${r.value}</span><span class="font-body-small text-subtle">${r.label}</span></li>`,
    )
    .join("");
  return `<div class="w-chart-tooltip rounded-medium bg-surface-overlay p-150 shadow-overlay"><p class="pb-075 font-body-small text-subtlest">${title}</p><ul class="flex flex-col gap-050">${items}</ul></div>`;
}

/** Mesma informação do tooltip, em texto corrido, para o leitor de tela */
export const tooltipText = (title: string, rows: TooltipRow[]) => `${title}: ${rows.map((r) => `${r.value} ${r.label}`).join(", ")}`;

interface EChartProps {
  /** Opção do ECharts; como função, recebe a largura atual (layout responsivo) */
  option: EChartsCoreOption | ((width: number) => EChartsCoreOption);
  /** Resumo em texto do gráfico (nome acessível) */
  label: string;
  className?: string;
  /** altura calculada (ex.: proporcional ao número de linhas) */
  style?: CSSProperties;
  /**
   * Navegação por teclado: setas percorrem os itens (mostram o tooltip e
   * anunciam o valor), Enter ativa, Esc fecha. Sem isto o gráfico não recebe foco.
   */
  keyboard?: {
    count: number;
    /** item inicial ao começar a navegar (ex.: último dia apontado) */
    start?: number;
    /** direção das setas: horizontal (dias) ou vertical (lista de barras) */
    axis: "x" | "y";
    describe: (index: number) => string;
    onActivate?: (index: number) => void;
  };
  onClick?: (params: { dataIndex: number; componentType: string; value?: unknown }) => void;
  /** Sem tooltip nem interação (Modo TV) */
  isStatic?: boolean;
}

/** Monta o ECharts num div, acompanha o tamanho do container e libera ao desmontar. */
export function EChart({ option, label, className, style, keyboard, onClick, isStatic }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.(p as { dataIndex: number; componentType: string; value?: unknown }));
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
      c.resize();
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  const resolved = useMemo(
    () => (typeof option === "function" ? (width > 0 ? option(width) : null) : option),
    [option, width],
  );
  useEffect(() => {
    // Mescla com o estado anterior: trocar filtro/tema anima a mudança em vez de redesenhar do zero
    if (resolved) chart.current?.setOption(resolved, { lazyUpdate: true });
  }, [resolved]);

  const show = (i: number | null) => {
    const c = chart.current;
    if (!c) return;
    c.dispatchAction({ type: "downplay", seriesIndex: 0 });
    if (i == null) {
      c.dispatchAction({ type: "hideTip" });
    } else {
      c.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: i });
      c.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: i });
    }
    setIndex(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!keyboard) return;
    const next = keyboard.axis === "x" ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 };
    const dir = next[e.key as keyof typeof next];
    if (dir) {
      e.preventDefault();
      // Primeira seta: começa no item inicial; depois, anda um item
      const target = index == null ? (keyboard.start ?? (dir > 0 ? 0 : keyboard.count - 1)) : index + dir;
      show(Math.min(keyboard.count - 1, Math.max(0, target)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      show(e.key === "Home" ? 0 : keyboard.count - 1);
    } else if ((e.key === "Enter" || e.key === " ") && index != null && keyboard.onActivate) {
      e.preventDefault();
      keyboard.onActivate(index);
    } else if (e.key === "Escape") {
      show(null);
    }
  };

  const hint = keyboard ? ` Use as setas para percorrer ${keyboard.axis === "x" ? "os dias" : "os itens"}${keyboard.onActivate ? " e Enter para abrir" : ""}.` : "";

  return (
    <div
      role="group"
      aria-label={label + hint}
      tabIndex={keyboard && !isStatic ? 0 : undefined}
      onKeyDown={onKeyDown}
      onBlur={() => index != null && show(null)}
      className={cn("relative w-full rounded-medium focus-visible:outline-offset-inset", className)}
      style={style}
    >
      <div ref={el} aria-hidden className={cn("size-full", isStatic && "pointer-events-none")} />
      <span className="sr-only" aria-live="polite">
        {keyboard && index != null ? keyboard.describe(index) : ""}
      </span>
    </div>
  );
}
