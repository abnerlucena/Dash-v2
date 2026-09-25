import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn, readToken } from "@/lib/utils";

// Só os módulos usados entram no pacote (tree-shaking). SVG: texto nítido e leve.
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, AriaComponent, SVGRenderer]);

/** Cores e medidas do tema atual, lidas do tokens.css (o ECharts não entende var()). */
export interface ChartTheme {
  brand: string;
  neutral: string;
  gridline: string;
  target: string;
  text: string;
  textSubtle: string;
  textSubtlest: string;
  status: { critical: string; attention: string; near: string; achieved: string };
  areaOpacity: number;
  line: number;
  marker: number;
  radius: number;
  fontFamily: string;
  fontSize: number;
  dash: number[];
  duration: number;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
    // tamanho do font.body.small ("400 0.75rem / 1rem Inter…")
    fontSize: parseFloat(css("--ds-font-body-small").match(/([\d.]+)rem/)?.[1] ?? "0") *
      parseFloat(getComputedStyle(document.documentElement).fontSize),
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

/** Base comum: fonte, animação e descrição acessível gerada pelo ECharts. */
export function baseOption(t: ChartTheme) {
  return {
    animationDuration: t.duration,
    animationDurationUpdate: t.duration,
    animationEasing: "cubicOut" as const,
    textStyle: { fontFamily: t.fontFamily, fontSize: t.fontSize, color: t.textSubtlest },
    aria: { enabled: true },
  };
}

/**
 * Tooltip no visual do protótipo. O container do ECharts fica transparente
 * (ele existe mesmo escondido); a caixa vem no HTML, com as classes do ChartTooltip.
 */
export const tooltipBase = {
  backgroundColor: "transparent",
  borderWidth: 0,
  padding: 0,
  extraCssText: "box-shadow: none;",
  transitionDuration: 0,
};

/** Eixos no padrão dos gráficos próprios: sem traços, grade sutil, rótulos subtlest. */
export function axisStyle(t: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: t.gridline } },
    axisTick: { show: false },
    // primeiro/último rótulo alinhados para dentro: não cortam na borda
    axisLabel: { color: t.textSubtlest, hideOverlap: true, alignMinLabel: "left" as const, alignMaxLabel: "right" as const },
    splitLine: { lineStyle: { color: t.gridline } },
  };
}

/** Linha do tooltip: valor em destaque, rótulo depois (mesmo padrão do ChartTooltip). */
export function tooltipHtml(title: string, rows: Array<{ value: string; label: string; swatch?: string; dashed?: boolean }>) {
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

interface EChartProps {
  option: EChartsCoreOption;
  className?: string;
  label: string;
  onClick?: (params: { dataIndex: number }) => void;
  /** altura calculada (ex.: proporcional ao número de linhas) */
  style?: CSSProperties;
}

/** Monta o ECharts num div, acompanha o tamanho do container e libera ao desmontar. */
export function EChart({ option, className, label, onClick, style }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.current = c;
    c.on("click", (p) => clickRef.current?.(p as { dataIndex: number }));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={el} role="img" aria-label={label} style={style} className={cn("w-full", onClick && "cursor-pointer", className)} />;
}
