import * as Tabs from "@radix-ui/react-tabs";
import { ArrowUp, Download, FilterX, LayoutList, Plus, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MACHINES,
  PREVIOUS_MONTH_PRODUCED,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  aggregate,
  scopeToShift,
  statusFor,
  type Machine,
  type Shift,
  type Status,
} from "@/data/machines";
import { formatDecimal, formatNumber, readToken } from "@/lib/utils";
import { DataTable, type SortState, type TableState } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { FilterPill, type FilterOption } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { ChartsView } from "./ChartsView";
import { DetailedView } from "./DetailedView";
import { machineColumns } from "./machineColumns";
import { MachinePanel } from "./MachinePanel";
import { ShiftsView } from "./ShiftsView";

export type DemoState = "live" | "loading" | "empty" | "error";

interface MachinesPageProps {
  search: string;
  onClearSearch: () => void;
  demoState: DemoState;
  onDemoStateChange: (s: DemoState) => void;
  notify: (title: string, description?: string) => void;
}

const PERIODS: FilterOption[] = [
  { value: "2026-03", label: "Março de 2026", short: "Março 2026" },
  { value: "2026-02", label: "Fevereiro de 2026", short: "Fevereiro 2026" },
  { value: "2026-01", label: "Janeiro de 2026", short: "Janeiro 2026" },
  { value: "90d", label: "Últimos 90 dias" },
];
const MACHINE_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todas" },
  ...MACHINES.map((m) => ({ value: m.id, label: m.name })),
];
const SHIFT_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todos" },
  ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label, hint: SHIFT_META[s].hours })),
];
const STATUSES: FilterOption[] = [
  { value: "all", label: "Qualquer" },
  ...(Object.keys(STATUS_META) as Status[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    hint: STATUS_META[s].range,
  })),
];

const TABS = [
  ["overview", "Visão geral"],
  ["detailed", "Detalhado"],
  ["shifts", "Turnos"],
  ["charts", "Gráficos"],
] as const;

const DEFAULT_FILTERS = { period: "2026-03", machine: "all", shift: "all", status: "all" };
const SORT_VALUE: Record<string, (m: Machine) => number | string> = {
  name: (m) => m.name,
  days: (m) => m.days,
  produced: (m) => m.produced,
  target: (m) => m.target,
  percent: (m) => m.percent,
};

export function MachinesPage({ search, onClearSearch, demoState, onDemoStateChange, notify }: MachinesPageProps) {
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState | null>({ columnId: "produced", direction: "descending" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastPanelMachine, setLastPanelMachine] = useState<Machine | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Troca de período simula uma busca
  useEffect(() => {
    if (!periodLoading) return;
    const t = window.setTimeout(() => setPeriodLoading(false), readToken("--ds-motion-duration-skeleton") / 2);
    return () => window.clearTimeout(t);
  }, [periodLoading]);

  const shift: Shift | "all" = filters.shift === "all" ? "all" : (Number(filters.shift) as Shift);
  const shiftLabel = shift === "all" ? null : SHIFT_META[shift].label;

  // O turno recorta os dados de todas as abas (exceto a comparação em "Turnos")
  const scoped = useMemo(() => MACHINES.map((m) => scopeToShift(m, shift)), [shift]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scoped.filter(
      (m) =>
        (filters.machine === "all" || m.id === filters.machine) &&
        (filters.status === "all" || m.status === filters.status) &&
        (!q || m.name.toLowerCase().includes(q) || m.lines.some((l) => l.toLowerCase().includes(q))),
    );
    if (!sort) return list;
    const get = SORT_VALUE[sort.columnId];
    const dir = sort.direction === "ascending" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number)) * dir;
    });
  }, [scoped, filters, search, sort]);

  // Aba Turnos: as mesmas máquinas filtradas, mas com todos os turnos
  const unscopedRows = useMemo(() => rows.map((r) => MACHINES.find((m) => m.id === r.id)!), [rows]);

  const totals = aggregate(rows);
  const onlyDefaults =
    Object.entries(DEFAULT_FILTERS).every(([k, v]) => filters[k as keyof typeof filters] === v) && !search;
  const growth = ((totals.produced - PREVIOUS_MONTH_PRODUCED) / PREVIOUS_MONTH_PRODUCED) * 100;

  const tableState: TableState =
    demoState === "loading" || periodLoading
      ? "loading"
      : demoState === "error"
        ? "error"
        : demoState === "empty" || rows.length === 0
          ? "empty"
          : "ready";
  const noData = demoState === "error" || demoState === "empty";

  // O painel mostra a máquina no recorte atual; mantém a última durante a animação de saída
  const panelMachine = activeId ? (scoped.find((m) => m.id === activeId) ?? null) : null;
  useEffect(() => {
    if (panelMachine) setLastPanelMachine(panelMachine);
  }, [panelMachine]);

  const setFilter = (key: keyof typeof DEFAULT_FILTERS) => (value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    if (key === "period") setPeriodLoading(true);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onClearSearch();
    if (demoState === "empty") onDemoStateChange("live");
  };

  const openPanel = (m: Machine) => setActiveId((id) => (id === m.id ? null : m.id));

  const onAction = (action: string, m: Machine) => {
    if (action === "export") notify("Exportação pronta", `${m.name} · março de 2026 (.xlsx)`);
    else if (action === "entry") notify("Novo apontamento", `O formulário para ${m.name} ainda não faz parte do protótipo.`);
    else notify("Histórico da máquina", "Esta tela ainda não faz parte do protótipo.");
  };

  const exportAll = () => {
    setExporting(true);
    window.setTimeout(() => {
      setExporting(false);
      notify("Exportação pronta", `${rows.length} máquinas · março de 2026 (.xlsx)`);
    }, readToken("--ds-motion-duration-skeleton") / 2);
  };

  /* ---------- Estados compartilhados pelas abas ---------- */
  const emptyState =
    demoState === "empty" ? (
      <EmptyState
        icon={LayoutList}
        title="Nenhum apontamento em março"
        hint="Ainda não há produção registrada neste período. Os números aparecem assim que o primeiro turno apontar."
        action={{ label: "Novo apontamento", icon: Plus, onClick: () => onDemoStateChange("live") }}
      />
    ) : (
      <EmptyState
        icon={SearchX}
        title="Nenhuma máquina encontrada"
        hint={
          search
            ? `Nada corresponde a "${search}" com os filtros atuais.`
            : "Nenhuma máquina corresponde aos filtros selecionados."
        }
        action={{ label: "Limpar filtros", icon: FilterX, onClick: clearFilters }}
      />
    );
  const errorState = (
    <ErrorMessage
      title="Não foi possível carregar a produção de março"
      actions={
        <>
          <Button iconBefore={RefreshCw} onClick={() => onDemoStateChange("loading")}>
            Tentar novamente
          </Button>
          <Button appearance="subtle" onClick={() => notify("Status do sistema", "Serviço de apontamentos: instável.")}>
            Ver status do sistema
          </Button>
        </>
      }
    >
      O serviço de apontamentos não respondeu. Tente de novo em alguns instantes; se persistir, avise o suporte.
    </ErrorMessage>
  );

  /* ---------- KPIs (seguem os filtros) ---------- */
  const status = STATUS_META[statusFor(totals.percent)];
  const kpis: KpiItem[] = [
    {
      id: "produced",
      label: "Produção",
      value: noData ? "—" : formatNumber(totals.produced),
      footer: noData ? (
        "Sem dados no período"
      ) : onlyDefaults ? (
        <span className="flex items-center gap-050">
          <span className="flex items-center gap-025 font-medium text-success">
            <ArrowUp aria-hidden className="size-icon-small" />
            {formatDecimal(growth)}%
          </span>
          vs fevereiro
        </span>
      ) : (
        `Recorte filtrado${shiftLabel ? ` · ${shiftLabel}` : ""}`
      ),
    },
    {
      id: "percent",
      label: "Atingimento da meta",
      value: noData ? "—" : `${totals.percent}%`,
      aside: noData ? undefined : <Lozenge appearance={status.appearance}>{status.label}</Lozenge>,
      footer: noData
        ? "Sem dados no período"
        : `Meta ${shiftLabel ? `do ${shiftLabel.toLowerCase()}` : "do mês"}: ${formatNumber(totals.target)}`,
    },
    {
      id: "rate",
      label: "Taxa de apontamento",
      value: noData ? "—" : `${totals.entryRate}%`,
      footer: noData ? "Sem dados no período" : "Dias com apontamento sobre dias úteis",
    },
    {
      id: "active",
      label: "Máquinas ativas",
      value: noData ? "—" : rows.filter((m) => m.days > 0).length,
      aside: noData ? undefined : <span className="font-body-large text-subtle">de {rows.length}</span>,
      footer: noData
        ? "Sem dados no período"
        : shiftLabel
          ? `Com apontamento no ${shiftLabel.toLowerCase()}`
          : "Com apontamento no mês",
    },
  ];

  const pad = "px-200 m:px-400";

  return (
    <>
      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-full flex-col">
        {/* ---------- Cabeçalho da página ---------- */}
        <div className={`${pad} pt-300`}>
          <div className="flex flex-wrap items-center justify-between gap-200">
            <div className="flex min-w-0 items-center gap-150">
              <h1 className="font-heading-large text-default">Máquinas</h1>
              <Lozenge appearance="success" withDot>
                Em produção
              </Lozenge>
            </div>
            <div className="flex items-center gap-100">
              <Button appearance="subtle" iconBefore={Download} isLoading={exporting} onClick={exportAll}>
                Exportar
              </Button>
              <Button
                appearance="primary"
                iconBefore={Plus}
                onClick={() => notify("Novo apontamento", "O formulário de apontamento ainda não faz parte do protótipo.")}
              >
                Novo apontamento
              </Button>
            </div>
          </div>
          <Tabs.List
            aria-label="Visões da página"
            className="mt-200 flex gap-300 overflow-x-auto overflow-y-hidden border-b"
          >
            {TABS.map(([value, label]) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="shrink-0 whitespace-nowrap border-b-thick border-transparent pb-100 pt-050 font-body font-medium text-subtle transition-colors duration-hover ease-out hover:text-default data-[state=active]:border-selected data-[state=active]:text-selected"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* ---------- Filtros: uma linha acima do conteúdo; valem para todas as abas ---------- */}
        <div role="toolbar" aria-label="Filtros" className={`${pad} flex flex-wrap items-center gap-100 pt-300`}>
          <FilterPill
            label="Período"
            value={filters.period}
            defaultValue={DEFAULT_FILTERS.period}
            options={PERIODS}
            onChange={setFilter("period")}
          />
          <FilterPill
            label="Máquina"
            value={filters.machine}
            defaultValue="all"
            options={MACHINE_OPTIONS}
            onChange={setFilter("machine")}
          />
          <FilterPill label="Turno" value={filters.shift} defaultValue="all" options={SHIFT_OPTIONS} onChange={setFilter("shift")} />
          <FilterPill label="Status" value={filters.status} defaultValue="all" options={STATUSES} onChange={setFilter("status")} />
          {!onlyDefaults && (
            <Button appearance="subtle" iconBefore={FilterX} onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
          {tableState === "ready" && (
            <p aria-live="polite" className="ml-auto font-body-small text-subtlest">
              {rows.length === MACHINES.length ? `${rows.length} máquinas` : `${rows.length} de ${MACHINES.length} máquinas`}
            </p>
          )}
        </div>

        {/* ---------- Visão geral ---------- */}
        <Tabs.Content value="overview" className={`${pad} flex flex-col gap-300 py-300 outline-none data-[state=inactive]:hidden`}>
          <KpiStrip items={kpis} isLoading={tableState === "loading"} />
          <DataTable
            caption="Produção por máquina em março de 2026"
            columns={machineColumns({ onOpenOrders: openPanel, onAction, totals })}
            rows={rows}
            getRowId={(m) => m.id}
            getRowLabel={(m) => `${m.name}, ${m.percent}% da meta, ${STATUS_META[m.status].label}`}
            state={tableState}
            selectedIds={selected}
            onSelectionChange={setSelected}
            activeRowId={activeId}
            onRowActivate={openPanel}
            sort={sort}
            onSortChange={setSort}
            footerLead={
              selected.size > 0 ? (
                <span className="font-medium text-selected">
                  {selected.size} de {rows.length} selecionadas
                </span>
              ) : (
                `${rows.length} máquinas`
              )
            }
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Detalhado ---------- */}
        <Tabs.Content value="detailed" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <DetailedView
            rows={rows}
            state={tableState}
            activeId={activeId}
            onRowActivate={openPanel}
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Turnos ---------- */}
        <Tabs.Content value="shifts" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <ShiftsView
            machines={unscopedRows}
            state={tableState}
            focus={shift === "all" ? null : shift}
            activeId={activeId}
            onRowActivate={openPanel}
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Gráficos ---------- */}
        <Tabs.Content value="charts" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <ChartsView
            rows={rows}
            isLoading={demoState === "loading"}
            isRefetching={periodLoading}
            activeId={activeId}
            onSelect={openPanel}
            scopeLabel={`${rows.length === MACHINES.length ? "todas as máquinas" : `${rows.length} máquinas`}${shiftLabel ? ` no ${shiftLabel.toLowerCase()}` : ""}`}
            replacement={
              demoState === "error" ? (
                errorState
              ) : demoState === "empty" || rows.length === 0 ? (
                <div className="rounded-xlarge border">{emptyState}</div>
              ) : undefined
            }
          />
        </Tabs.Content>
      </Tabs.Root>

      <MachinePanel
        machine={panelMachine ?? lastPanelMachine}
        open={panelMachine != null}
        scopeLabel={shiftLabel}
        onClose={() => {
          // devolve o foco ao que abriu o painel (linha da tabela ou barra do gráfico)
          document.querySelector<HTMLElement>('tr[aria-current="true"], button[aria-pressed="true"]')?.focus();
          setActiveId(null);
        }}
        onAction={onAction}
      />
    </>
  );
}
