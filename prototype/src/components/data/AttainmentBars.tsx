import { STATUS_META, type Machine, type Status } from "@/data/machines";
import { cn } from "@/lib/utils";
import { Lozenge } from "@/components/ui/Lozenge";

const FILL: Record<Status, string> = {
  critical: "bg-danger-bold",
  attention: "bg-warning-bold",
  near: "bg-information-bold",
  achieved: "bg-success-bold",
};

/** Escala até 120% para caber quem passou da meta; a linha de 100% marca a meta. */
const SCALE_MAX = 120;

interface AttainmentBarsProps {
  machines: Machine[];
  activeId?: string | null;
  onSelect: (m: Machine) => void;
}

/**
 * Barras horizontais de atingimento por máquina, ordenadas do maior para o
 * menor. Cada linha é um botão (abre o painel de ordens). Valor e status em
 * texto na ponta da barra — a cor só reforça.
 */
export function AttainmentBars({ machines, activeId, onSelect }: AttainmentBarsProps) {
  const sorted = [...machines].sort((a, b) => b.percent - a.percent);
  const metaLeft = `${(100 / SCALE_MAX) * 100}%`;

  return (
    <div className="flex flex-col">
      {/* régua da meta */}
      <div aria-hidden className="grid grid-cols-attainment items-end pb-050">
        <span />
        <span className="relative mr-150 h-200">
          <span className="absolute -translate-x-1/2 font-body-small text-subtlest" style={{ left: metaLeft }}>
            Meta
          </span>
        </span>
        <span />
      </div>
      <ul className="relative flex flex-col">
        {sorted.map((m) => {
          const meta = STATUS_META[m.status];
          const width = `${(Math.min(m.percent, SCALE_MAX) / SCALE_MAX) * 100}%`;
          const isActive = activeId === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                aria-pressed={isActive}
                aria-label={`${m.name}: ${m.percent}% da meta, ${meta.label}. Abrir ordens de produção`}
                className={cn(
                  "ds-pressable group grid w-full grid-cols-attainment items-center rounded-medium py-075 text-left",
                  isActive ? "bg-selected" : "hover:bg-neutral-subtle-hovered active:bg-neutral-subtle-pressed",
                )}
              >
                <span className="truncate px-100 font-body text-default">{m.name}</span>
                <span className="relative mr-150 flex h-250 items-center">
                  <span aria-hidden className="absolute inset-y-0 border-l border-dashed border-chart-target" style={{ left: metaLeft }} />
                  <span aria-hidden className={cn("h-full rounded-r-small", FILL[m.status])} style={{ width }} />
                </span>
                <span className="flex items-center gap-100">
                  <span className="w-400 text-right font-medium tabular-nums text-default">{m.percent}%</span>
                  <Lozenge appearance={meta.appearance}>{meta.label}</Lozenge>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
