import { useState, type ReactNode } from "react";
import { STATUS_META, plantSeries, type Machine } from "@/data/machines";
import { formatNumber, formatShortDate, storageGet, storageSet } from "@/lib/utils";
import { EAttainmentBars, EBurnupChart, EDailyColumns } from "@/components/echarts/Charts";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AttainmentBars } from "@/components/data/AttainmentBars";
import { BURNUP_LEGEND, BurnupChart } from "@/components/data/BurnupChart";
import { ChartCard, MiniTable } from "@/components/data/Chart";
import { DAILY_LEGEND, DailyColumns } from "@/components/data/DailyColumns";

type Engine = "svg" | "echarts";
const ENGINE_KEY = "dash-proto.chart-engine";

interface ChartsViewProps {
  rows: Machine[];
  isLoading: boolean;
  isRefetching: boolean;
  activeId: string | null;
  onSelect: (m: Machine) => void;
  /** Estado vazio/erro substitui os gráficos inteiros */
  replacement?: ReactNode;
  scopeLabel: string;
}

/**
 * Gráficos do período. Os filtros acima valem para tudo aqui. Numa troca de
 * período os gráficos mantêm o quadro anterior esmaecido (sem skeleton);
 * o skeleton aparece só no carregamento inicial.
 */
export function ChartsView({ rows, isLoading, isRefetching, activeId, onSelect, replacement, scopeLabel }: ChartsViewProps) {
  // Teste de biblioteca: os mesmos gráficos em SVG próprio ou em Apache ECharts
  const [engine, setEngineState] = useState<Engine>(() => storageGet<Engine>(ENGINE_KEY, "svg"));
  const setEngine = (e: Engine) => {
    setEngineState(e);
    storageSet(ENGINE_KEY, e);
  };
  if (replacement) return <>{replacement}</>;
  const series = plantSeries(rows);
  const isEcharts = engine === "echarts";
  const elapsed = series.filter((p) => p.value != null);

  return (
    // flex-wrap pela largura real (painel aberto, nav redimensionada), não pela viewport
    <div className="flex flex-wrap gap-300">
      <div className="flex basis-full flex-wrap items-center gap-150">
        <span id="chart-engine" className="font-body-small font-semibold text-subtle">
          Biblioteca de gráficos
        </span>
        <SegmentedControl
          label="Biblioteca de gráficos"
          iconOnly={false}
          value={engine}
          onChange={(v) => setEngine(v as Engine)}
          options={[
            { value: "svg", label: "SVG próprio" },
            { value: "echarts", label: "Apache ECharts" },
          ]}
        />
        <span className="font-body-small text-subtlest">Teste do protótipo: mesmos dados e cores nos dois.</span>
      </div>
      <ChartCard
        className="basis-full"
        title="Produção acumulada vs meta"
        subtitle={`Soma de ${scopeLabel}, dias úteis de março de 2026`}
        legend={BURNUP_LEGEND}
        isLoading={isLoading}
        isRefetching={isRefetching}
        table={
          <MiniTable
            caption="Produção acumulada e meta acumulada por dia útil"
            columns={[
              { header: "Dia" },
              { header: "Realizado acumulado", align: "end" },
              { header: "Meta acumulada", align: "end" },
              { header: "% da meta", align: "end" },
            ]}
            rows={series.map((p) => [
              formatShortDate(p.date),
              p.cumulative != null ? formatNumber(p.cumulative) : "—",
              formatNumber(p.targetCumulative),
              p.cumulative != null ? `${Math.round((p.cumulative / p.targetCumulative) * 100)}%` : "—",
            ])}
          />
        }
      >
        {isEcharts ? (
          <EBurnupChart series={series} label="Produção acumulada vs meta" />
        ) : (
          <BurnupChart series={series} label="Produção acumulada vs meta" />
        )}
      </ChartCard>

      <ChartCard
        className="flex-1 basis-chart-card-min"
        title="Produção diária"
        subtitle="Por dia útil, contra a meta diária"
        legend={DAILY_LEGEND}
        isLoading={isLoading}
        isRefetching={isRefetching}
        table={
          <MiniTable
            caption="Produção por dia útil"
            columns={[{ header: "Dia" }, { header: "Produção", align: "end" }, { header: "% da meta diária", align: "end" }]}
            rows={elapsed.map((p) => [
              formatShortDate(p.date),
              formatNumber(p.value!),
              `${Math.round((p.value! / p.dailyTarget) * 100)}%`,
            ])}
          />
        }
      >
        {isEcharts ? <EDailyColumns series={series} label="Produção diária" /> : <DailyColumns series={series} label="Produção diária" />}
      </ChartCard>

      <ChartCard
        className="flex-1 basis-chart-card-min"
        title="Atingimento por máquina"
        subtitle="Clique numa máquina para ver as ordens de produção"
        isLoading={isLoading}
        isRefetching={isRefetching}
        table={
          <MiniTable
            caption="Atingimento da meta por máquina"
            columns={[
              { header: "Máquina" },
              { header: "Produção", align: "end" },
              { header: "Meta", align: "end" },
              { header: "Atingimento", align: "end" },
            ]}
            rows={[...rows]
              .sort((a, b) => b.percent - a.percent)
              .map((m) => [
                m.name,
                formatNumber(m.produced),
                formatNumber(m.target),
                `${m.percent}% · ${STATUS_META[m.status].label}`,
              ])}
          />
        }
      >
        {isEcharts ? (
          <EAttainmentBars machines={rows} activeId={activeId} onSelect={onSelect} />
        ) : (
          <AttainmentBars machines={rows} activeId={activeId} onSelect={onSelect} />
        )}
      </ChartCard>
    </div>
  );
}
