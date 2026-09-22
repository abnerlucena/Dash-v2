/**
 * Escala única de status de atingimento da meta (docs/ui/UI-SPEC.md §4.1).
 * Substitui as regras antigas (pctColor, cor da barra, heatmap) na interface.
 * A cor NUNCA aparece sozinha: use sempre `label` junto (WCAG 1.4.1).
 */
export type AttainmentStatus = "critical" | "attention" | "near" | "met" | "none";

export const STATUS_THRESHOLDS = { attention: 70, near: 90, met: 100 } as const;

export function getAttainmentStatus(pct: number | null | undefined): AttainmentStatus {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "none";
  if (pct >= STATUS_THRESHOLDS.met) return "met";
  if (pct >= STATUS_THRESHOLDS.near) return "near";
  if (pct >= STATUS_THRESHOLDS.attention) return "attention";
  return "critical";
}

export const STATUS_LABEL: Record<AttainmentStatus, string> = {
  critical: "Crítico",
  attention: "Atenção",
  near: "Próximo",
  met: "Atingido",
  none: "Sem meta",
};

/** Nome do token CSS (sem hsl()) de cada status — para gráficos e estilos inline. */
export const STATUS_TOKEN: Record<AttainmentStatus, string> = {
  critical: "--destructive",
  attention: "--warning",
  near: "--info",
  met: "--success",
  none: "--muted-foreground",
};

/** Classes Tailwind de texto por status. */
export const STATUS_TEXT_CLASS: Record<AttainmentStatus, string> = {
  critical: "text-destructive",
  attention: "text-warning",
  near: "text-info",
  met: "text-success",
  none: "text-muted-foreground",
};

/** Classes Tailwind de preenchimento por status. */
export const STATUS_BG_CLASS: Record<AttainmentStatus, string> = {
  critical: "bg-destructive",
  attention: "bg-warning",
  near: "bg-info",
  met: "bg-success",
  none: "bg-muted-foreground",
};

/** Estilo inline (cor + fundo translúcido) do status — para chips que usam `style`. */
export function statusStyle(pct: number | null | undefined): { color: string; backgroundColor: string } {
  const token = STATUS_TOKEN[getAttainmentStatus(pct)];
  return { color: `hsl(var(${token}))`, backgroundColor: `hsl(var(${token}) / 0.1)` };
}

/** Aplica transparência a qualquer cor CSS (inclusive hsl(var(--x))). */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
