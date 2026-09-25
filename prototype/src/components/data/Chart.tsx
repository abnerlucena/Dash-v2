import { BarChart3, Table2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Feedback";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/* ---------- Medição do container (gráficos SVG em px reais) ---------- */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Escala "limpa" para eixos: 0, 500 mil, 1 mi, 1,5 mi… */
export function niceScale(max: number, count = 4) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/**
 * Índices do eixo X que recebem rótulo: o primeiro, o último e os do meio
 * espaçados pelo menos --dash-chart-label-gap (nunca se sobrepõem).
 */
export function tickIndices(count: number, pxPerIndex: number, minGap: number) {
  if (count <= 1 || pxPerIndex <= 0) return new Set([0]);
  const stride = Math.max(1, Math.ceil(minGap / pxPerIndex));
  const out = new Set<number>([0, count - 1]);
  for (let i = stride; i < count - 1; i += stride) if ((count - 1 - i) * pxPerIndex >= minGap) out.add(i);
  return out;
}

/** Retângulo com cantos arredondados só no topo (ponta de dado 4px, base reta) */
export function topRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/* ---------- Legenda: o formato espelha a marca (barra = bloco, linha = traço) ---------- */
export interface LegendItem {
  label: string;
  shape: "rect" | "line" | "dashed";
  /** classe de fundo (rect/line) ou de borda (dashed) */
  colorClass: string;
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-200 gap-y-050", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-075 font-body-small text-subtle">
          {item.shape === "rect" && <span aria-hidden className={cn("size-100 rounded-xsmall", item.colorClass)} />}
          {item.shape === "line" && <span aria-hidden className={cn("h-splitter-line w-250 rounded-full", item.colorClass)} />}
          {item.shape === "dashed" && <span aria-hidden className={cn("w-250 border-t-thick border-dashed", item.colorClass)} />}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Tooltip de gráfico: valor em destaque, rótulo depois ---------- */
export interface TooltipRow {
  key: string;
  value: ReactNode;
  label: string;
  swatch?: LegendItem;
}

export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: ReactNode;
  rows: TooltipRow[];
}) {
  // Vira para a esquerda na metade direita do gráfico, para não sair da área
  const flip = x > containerWidth / 2;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-tooltip w-chart-tooltip rounded-medium bg-surface-overlay p-150 shadow-overlay"
      style={{ left: x, top: y, transform: `translate(${flip ? "calc(-100% - var(--ds-space-150))" : "var(--ds-space-150)"}, -50%)` }}
    >
      <p className="pb-075 font-body-small text-subtlest">{title}</p>
      <ul className="flex flex-col gap-050">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-100">
            {r.swatch && (
              <span
                aria-hidden
                className={cn(
                  "w-150 shrink-0",
                  r.swatch.shape === "dashed" ? "border-t-thick border-dashed" : "h-splitter-line rounded-full",
                  r.swatch.colorClass,
                )}
              />
            )}
            <span className="font-semibold tabular-nums text-default">{r.value}</span>
            <span className="truncate font-body-small text-subtle">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Tabela simples (visão acessível de cada gráfico) ---------- */
export function MiniTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Array<{ header: string; align?: "start" | "end" }>;
  rows: ReactNode[][];
}) {
  return (
    <div className="scrollbar-thin max-h-chart-large overflow-auto rounded-large border">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-raised">
          <tr className="h-row-header">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-150 font-body-small font-medium text-subtlest",
                  c.align === "end" ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="h-row border-t">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "whitespace-nowrap px-150 tabular-nums",
                    columns[i].align === "end" ? "text-right" : "text-left",
                    i === 0 ? "text-default" : "text-subtle",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Cartão de gráfico ---------- */
interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table: ReactNode;
  isLoading?: boolean;
  /** Recarregando: mantém o quadro anterior com opacidade reduzida (sem skeleton, sem salto) */
  isRefetching?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, legend, table, isLoading, isRefetching, className, children }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col gap-200 rounded-large bg-surface-raised p-250 shadow-raised", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-150">
        <div className="min-w-0">
          <h3 id={titleId} className="font-heading-small text-default">
            {title}
          </h3>
          {subtitle && <p className="mt-025 font-body-small text-subtlest">{subtitle}</p>}
        </div>
        <SegmentedControl
          label={`Modo de exibição: ${title}`}
          value={view}
          onChange={(v) => setView(v as "chart" | "table")}
          options={[
            { value: "chart", label: "Gráfico", icon: BarChart3 },
            { value: "table", label: "Tabela", icon: Table2 },
          ]}
        />
      </header>
      {legend && view === "chart" && !isLoading && <Legend items={legend} />}
      {isLoading ? (
        <Skeleton className="h-chart w-full rounded-medium" />
      ) : (
        <div
          aria-busy={isRefetching || undefined}
          className={cn("transition-opacity duration-menu ease-out", isRefetching && "opacity-refetch")}
        >
          {view === "chart" ? children : table}
        </div>
      )}
    </section>
  );
}
