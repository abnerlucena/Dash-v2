import { lazy, Suspense, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Feedback";
import type { LegendItem } from "@/components/data/Chart";

/*
 * Porta de entrada dos gráficos. O ECharts (~180 KB comprimido) fica num
 * pedaço separado do app e só é baixado quando o primeiro gráfico aparece;
 * enquanto isso, um skeleton do mesmo tamanho segura o lugar.
 */
const load = () => import("./Charts");
const LazyBurnup = lazy(() => load().then((m) => ({ default: m.BurnupChart })));
const LazyDaily = lazy(() => load().then((m) => ({ default: m.DailyColumns })));
const LazyAttainment = lazy(() => load().then((m) => ({ default: m.AttainmentBars })));

type BurnupProps = ComponentProps<typeof LazyBurnup>;

export function BurnupChart(props: BurnupProps) {
  return (
    <Suspense fallback={<Skeleton className={cn("w-full rounded-medium", props.heightClass ?? "h-chart-large")} />}>
      <LazyBurnup {...props} />
    </Suspense>
  );
}

export function DailyColumns(props: ComponentProps<typeof LazyDaily>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyDaily {...props} />
    </Suspense>
  );
}

export function AttainmentBars(props: ComponentProps<typeof LazyAttainment>) {
  return (
    <Suspense fallback={<Skeleton className="h-chart w-full rounded-medium" />}>
      <LazyAttainment {...props} />
    </Suspense>
  );
}

/* Legendas em HTML (acima do gráfico): o formato espelha a marca */
export const BURNUP_LEGEND: LegendItem[] = [
  { label: "Realizado acumulado", shape: "line", colorClass: "bg-chart-brand" },
  { label: "Meta acumulada", shape: "dashed", colorClass: "border-chart-target" },
];

export const DAILY_LEGEND: LegendItem[] = [
  { label: "Acima da meta diária", shape: "rect", colorClass: "bg-chart-brand" },
  { label: "Abaixo da meta diária", shape: "rect", colorClass: "bg-chart-neutral" },
  { label: "Meta diária", shape: "dashed", colorClass: "border-chart-target" },
];
