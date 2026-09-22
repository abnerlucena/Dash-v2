import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { getAttainmentStatus, STATUS_TOKEN } from "./status";

/**
 * O ECharts desenha em <canvas> e não entende var(--x). Este módulo lê os
 * tokens CSS já resolvidos (claro/escuro) e entrega cores prontas.
 */
export interface ChartTheme {
  text: string;
  muted: string;
  grid: string;
  reference: string;
  surface: string;
  border: string;
  series: [string, string, string, string];
  critical: string;
  attention: string;
  near: string;
  met: string;
  fontFamily: string;
  reducedMotion: boolean;
}

/**
 * Lê os tokens já resolvidos. `scope` permite ler de um container com tema
 * próprio (ex: Modo TV, sempre .dark) em vez do <html>.
 */
export function readChartTheme(scope: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(scope);
  const hsl = (name: string, alpha = 1) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `hsl(${v} / ${alpha})` : "gray";
  };
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return {
    text: hsl("--foreground"),
    muted: hsl("--muted-foreground"),
    grid: hsl("--chart-grid"),
    reference: hsl("--chart-reference"),
    surface: hsl("--popover"),
    border: hsl("--border"),
    series: [hsl("--chart-1"), hsl("--chart-2"), hsl("--chart-3"), hsl("--chart-4")],
    critical: hsl(STATUS_TOKEN.critical),
    attention: hsl(STATUS_TOKEN.attention),
    near: hsl(STATUS_TOKEN.near),
    met: hsl(STATUS_TOKEN.met),
    fontFamily: '"Geist Variable", system-ui, sans-serif',
    reducedMotion: !!reducedMotion,
  };
}

/** Cor de status (escala única) para um % de atingimento. */
export function statusColor(t: ChartTheme, pct: number | null | undefined): string {
  const s = getAttainmentStatus(pct);
  return s === "none" ? t.muted : t[s];
}

/** Reexecuta quando o tema muda, para os gráficos trocarem de cor junto. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());
  useEffect(() => {
    // Espera o next-themes aplicar a classe .dark no <html> antes de ler.
    const id = requestAnimationFrame(() => setTheme(readChartTheme()));
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);
  return theme;
}
