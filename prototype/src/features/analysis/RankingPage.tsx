import { ArrowDown, ArrowUp, Equal, Medal } from "lucide-react";
import { useMemo, useState } from "react";
import {
  MACHINES,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  WORKING_DATES,
  WORKING_DAYS,
  groupOf,
  scopeToShift,
  statusFor,
  type Machine,
  type Shift,
} from "@/data/machines";
import { cn, formatDecimal, formatNumber } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { FilterPill } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

type Metric = "percent" | "produced" | "entries" | "rework";

const METRICS: Record<Metric, { label: string; hint: string; higherIsBetter: boolean }> = {
  percent: { label: "Atingimento", hint: "Produção sobre a meta do mês", higherIsBetter: true },
  produced: { label: "Produção", hint: "Unidades produzidas no mês", higherIsBetter: true },
  entries: { label: "Apontamento", hint: "Dias com apontamento sobre dias úteis", higherIsBetter: true },
  rework: { label: "Retrabalho", hint: "Peças retrabalhadas sobre a produção — menor é melhor", higherIsBetter: false },
};

/** "Semana passada" = dados até sexta, 20/03 */
const PREVIOUS_CUTOFF = 20;
const DAYS_UNTIL_CUTOFF = WORKING_DATES.filter((d) => d.getDate() <= PREVIOUS_CUTOFF).length;

function valueOf(m: Machine, metric: Metric, cutoff?: number) {
  const orders = cutoff ? m.orders.filter((o) => o.date.getDate() <= cutoff) : m.orders;
  const produced = orders.reduce((s, o) => s + o.quantity, 0);
  const workingDays = cutoff ? DAYS_UNTIL_CUTOFF : WORKING_DAYS;
  switch (metric) {
    case "percent":
      // na semana passada, compara contra a meta proporcional aos dias úteis até ali
      return produced / (m.target * (workingDays / WORKING_DAYS)) * 100;
    case "produced":
      return produced;
    case "entries":
      return (new Set(orders.map((o) => o.date.getDate())).size / workingDays) * 100;
    case "rework":
      return produced ? (orders.filter((o) => o.rework).reduce((s, o) => s + o.quantity, 0) / produced) * 100 : 0;
  }
}

const display = (metric: Metric, v: number) => (metric === "produced" ? formatNumber(Math.round(v)) : `${formatDecimal(v)}%`);

interface Ranked {
  machine: Machine;
  value: number;
  position: number;
  previous: number;
}

export function RankingPage() {
  const [metric, setMetric] = useState<Metric>("percent");
  const [shiftFilter, setShiftFilter] = useState("all");
  const shift: Shift | "all" = shiftFilter === "all" ? "all" : (Number(shiftFilter) as Shift);
  const meta = METRICS[metric];

  const ranked = useMemo<Ranked[]>(() => {
    const scoped = MACHINES.map((m) => scopeToShift(m, shift));
    const order = (cutoff?: number) =>
      [...scoped]
        .map((m) => ({ m, v: valueOf(m, metric, cutoff) }))
        .sort((a, b) => (meta.higherIsBetter ? b.v - a.v : a.v - b.v))
        .map((x) => x.m.id);
    const now = order();
    const before = order(PREVIOUS_CUTOFF);
    return now.map((id, i) => {
      const machine = scoped.find((m) => m.id === id)!;
      return { machine, value: valueOf(machine, metric), position: i + 1, previous: before.indexOf(id) + 1 };
    });
  }, [metric, shift, meta.higherIsBetter]);

  const best = Math.max(...ranked.map((r) => r.value), 1);

  const Movement = ({ r }: { r: Ranked }) => {
    const diff = r.previous - r.position;
    if (diff === 0)
      return (
        <span className="flex items-center gap-025 font-body-small text-subtlest">
          <Equal aria-hidden className="size-icon-small" />
          <span>mesma posição</span>
        </span>
      );
    const up = diff > 0;
    return (
      <span className={cn("flex items-center gap-025 font-body-small font-medium", up ? "text-success" : "text-danger")}>
        {up ? <ArrowUp aria-hidden className="size-icon-small" /> : <ArrowDown aria-hidden className="size-icon-small" />}
        {up ? "subiu" : "caiu"} {Math.abs(diff)}
      </span>
    );
  };

  const columns: Column<Ranked>[] = [
    {
      id: "pos",
      header: "Posição",
      className: "w-600",
      cell: (r) => <span className="font-metric-small tabular-nums text-default">{r.position}º</span>,
    },
    {
      id: "name",
      header: "Máquina",
      className: "min-w-column-name",
      cell: (r) => <span className="font-medium text-default">{r.machine.name}</span>,
    },
    { id: "group", header: "Linha", cell: (r) => <span className="text-subtle">{groupOf(r.machine.id).label}</span> },
    {
      id: "value",
      header: meta.label,
      cell: (r) => (
        <span className="flex items-center gap-150">
          <span aria-hidden className="flex h-150 w-stacked-bar items-center rounded-r-small bg-neutral">
            <span className="h-full rounded-r-small bg-chart-brand" style={{ width: `${(r.value / best) * 100}%` }} />
          </span>
          <span className="w-800 text-right font-medium tabular-nums text-default">{display(metric, r.value)}</span>
          {metric === "percent" && (
            <Lozenge appearance={STATUS_META[statusFor(Math.round(r.value))].appearance}>
              {STATUS_META[statusFor(Math.round(r.value))].label}
            </Lozenge>
          )}
        </span>
      ),
    },
    {
      id: "move",
      header: "Em relação à semana passada",
      className: "pr-200",
      cell: (r) => (
        <span className="flex items-center gap-100">
          <Movement r={r} />
          <span className="font-body-small text-subtlest">era {r.previous}º</span>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Ranking de máquinas"
        description="Compare as máquinas por um critério. A posição anterior usa os dados até sexta, 20 de março."
      />
      <PageBody>
        <div role="toolbar" aria-label="Critério e filtros" className="flex flex-wrap items-center gap-150">
          <SegmentedControl
            label="Critério do ranking"
            iconOnly={false}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
            options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].label }))}
          />
          <FilterPill
            label="Turno"
            value={shiftFilter}
            defaultValue="all"
            onChange={setShiftFilter}
            options={[
              { value: "all", label: "Todos" },
              ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label, hint: SHIFT_META[s].hours })),
            ]}
          />
          <p className="font-body-small text-subtlest">{meta.hint}</p>
        </div>

        {/* Pódio: os 3 primeiros */}
        <ol aria-label="Três primeiras posições" className="flex flex-wrap gap-200">
          {ranked.slice(0, 3).map((r) => (
            <li key={r.machine.id} className="flex min-w-0 flex-1 basis-kpi-min flex-col gap-100 rounded-large bg-surface-raised p-250 shadow-raised">
              <span className="flex items-center justify-between gap-100">
                <span className="flex items-center gap-075 font-heading-xsmall text-subtle">
                  <Medal aria-hidden className={cn("size-icon-small", r.position === 1 ? "text-icon-warning" : "text-icon-subtle")} />
                  {r.position}º lugar
                </span>
                <Movement r={r} />
              </span>
              <span className="truncate font-heading-small text-default">{r.machine.name}</span>
              <span className="font-metric-medium text-default">{display(metric, r.value)}</span>
              <span className="font-body-small text-subtlest">{groupOf(r.machine.id).label}</span>
            </li>
          ))}
        </ol>

        <DataTable
          caption={`Ranking por ${meta.label.toLowerCase()}`}
          columns={columns}
          rows={ranked}
          getRowId={(r) => r.machine.id}
          getRowLabel={(r) => `${r.position}º, ${r.machine.name}, ${display(metric, r.value)}`}
          selectable={false}
          footerLead={`${ranked.length} máquinas`}
        />
      </PageBody>
    </>
  );
}
