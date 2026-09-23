import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Feedback";

export interface KpiItem {
  id: string;
  label: string;
  value: ReactNode;
  /** Complemento ao lado do valor (ex.: "de 6", lozenge de status) */
  aside?: ReactNode;
  footer?: ReactNode;
}

/**
 * Faixa de KPIs em uma superfície elevada (raised + shadow), células
 * divididas por linhas de 1px. Valores em font.metric.medium, tabular-nums.
 */
export function KpiStrip({ items, isLoading }: { items: KpiItem[]; isLoading?: boolean }) {
  return (
    <section aria-label="Indicadores do período" className="overflow-hidden rounded-large bg-surface-raised shadow-raised">
      {/* gap de 1px sobre o fundo da borda = divisórias; flex-wrap segue o espaço real, não a viewport */}
      <dl className="flex flex-wrap gap-px bg-border" aria-busy={isLoading || undefined}>
        {items.map((item) => (
          <div key={item.id} className="flex min-w-0 flex-1 basis-kpi-min flex-col gap-050 bg-surface-raised px-250 py-200">
            <dt className="font-body text-subtle">{item.label}</dt>
            {isLoading ? (
              <dd className="flex flex-col gap-100 pt-050">
                <Skeleton className="h-300 w-1/2" />
                <Skeleton className="h-150 w-2/3" />
              </dd>
            ) : (
              <>
                <dd className="flex flex-wrap items-center gap-100">
                  <span className="font-metric-medium tabular-nums text-default">{item.value}</span>
                  {item.aside}
                </dd>
                {item.footer && <dd className="font-body-small text-subtlest">{item.footer}</dd>}
              </>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
