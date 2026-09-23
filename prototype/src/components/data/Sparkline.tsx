import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import { cn, formatNumber, formatShortDate } from "@/lib/utils";
import { TOOLTIP_CONTENT_CLASS } from "@/components/ui/Tooltip";

interface SparklineProps {
  values: number[];
  /** Meta diária: barras acima dela usam a cor da marca; abaixo, neutra */
  threshold: number;
  endDate: Date;
  label: string;
}

/**
 * Sparkline de barras (14 dias). Uma série só → sem legenda; o título da
 * coluna nomeia a série. Linha tracejada = meta diária. Passar o mouse
 * sobre uma barra mostra data e valor.
 */
export function Sparkline({ values, threshold, endDate, label }: SparklineProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...values, threshold) * 1.08;
  const above = values.filter((v) => v >= threshold).length;
  const dateAt = (i: number) =>
    new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (values.length - 1 - i));

  return (
    <RadixTooltip.Root open={active != null}>
      <RadixTooltip.Trigger asChild>
        <span
          role="img"
          aria-label={`${label}: ${above} de ${values.length} dias acima da meta diária de ${formatNumber(threshold)}`}
          onPointerLeave={() => setActive(null)}
          className="relative flex h-sparkline-height items-end"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-bold opacity-disabled"
            style={{ bottom: `${(threshold / max) * 100}%` }}
          />
          {values.map((v, i) => (
            <span key={i} aria-hidden onPointerEnter={() => setActive(i)} className="flex h-full items-end px-px">
              <span
                className={cn(
                  "w-sparkline-bar rounded-t-xsmall transition-opacity duration-hover ease-out",
                  v >= threshold ? "bg-chart-brand" : "bg-chart-neutral",
                  active != null && active !== i && "opacity-disabled",
                )}
                style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
              />
            </span>
          ))}
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side="top" sideOffset={6} className={TOOLTIP_CONTENT_CLASS}>
          {active != null && (
            <span className="flex flex-col">
              <span className="font-semibold tabular-nums">
                {formatShortDate(dateAt(active))} · {formatNumber(values[active])}
              </span>
              <span>{values[active] >= threshold ? "Acima" : "Abaixo"} da meta diária</span>
            </span>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
