import * as Tabs from "@radix-ui/react-tabs";
import { ArrowUp, BarChart3, Download, FilterX, LayoutList, Plus, RefreshCw, SearchX, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MACHINES,
  PREVIOUS_MONTH_PRODUCED,
  STATUS_META,
  aggregate,
  statusFor,
  type Machine,
  type Status,
} from "@/data/machines";
import { formatDecimal, formatNumber, readToken } from "@/lib/utils";
import { DataTable, type SortState, type TableState } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { FilterPill, type FilterOption } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { machineColumns } from "./machineColumns";
import { MachinePanel } from "./MachinePanel";

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
const SHIFTS: FilterOption[] = [
  { value: "all", label: "Todos" },
  { value: "1", label: "Turno 1", hint: "06h–14h" },
  { value: "2", label: "Turno 2", hint: "14h–22h" },
  { value: "3", label: "Turno 3", hint: "22h–06h" },
];
const STATUSES: FilterOption[] = [
  { value: "all", label: "Qualquer" },
  ...(Object.keys(STATUS_META) as Status[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    hint: STATUS_META[s].range,
  })),
];

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
  const [panelMachine, setPanelMachine] = useState<Machine | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Troca de período simula uma busca (skeleton no formato final)
  useEffect(() => {
    if (!periodLoading) return;
    const t = window.setTimeout(() => setPeriodLoading(false), readToken("--ds-motion-duration-skeleton") / 2);
    return () => window.clearTimeout(t);
  }, [periodLoading]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = MACHINES.filter(
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
  }, [filters, search, sort]);

  const totals = aggregate(rows);
  const all = aggregate(MACHINES);
  const growth = ((all.produced - PREVIOUS_MONTH_PRODUCED) / PREVIOUS_MONTH_PRODUCED) * 100;
  const filtersActive = Object.entries(DEFAULT_FILTERS).some(([k, v]) => filters[k as keyof typeof filters] !== v);

  const tableState: TableState =
    demoState === "loading" || periodLoading
      ? "loading"
      : demoState === "error"
        ? "error"
        : demoState === "empty" || rows.length === 0
          ? "empty"
          : "ready";
  const kpiLoading = tableState === "loading";
  const noData = demoState === "error" || demoState === "empty";

  const setFilter = (key: keyof typeof DEFAULT_FILTERS) => (value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    if (key === "period") setPeriodLoading(true);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onClearSearch();
    if (demoState === "empty") onDemoStateChange("live");
  };

  const openPanel = (m: Machine) => {
    if (activeId === m.id) {
      setActiveId(null);
      return;
    }
    setPanelMachine(m);
    setActiveId(m.id);
  };

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

  const kpis: KpiItem[] = [
    {
      id: "produced",
      label: "Produção",
      value: noData ? "—" : formatNumber(all.produced),
      footer: noData ? (
        "Sem dados no período"
      ) : (
        <span className="flex items-center gap-050">
          <span className="flex items-center gap-025 font-medium text-success">
            <ArrowUp aria-hidden className="size-icon-small" />
            {formatDecimal(growth)}%
          </span>
          vs fevereiro
        </span>
      ),
    },
    {
      id: "percent",
      label: "Atingimento da meta",
      value: noData ? "—" : `${all.percent}%`,
      aside: noData ? undefined : (
        <Lozenge appearance={STATUS_META[statusFor(all.percent)].appearance}>
          {STATUS_META[statusFor(all.percent)].label}
        </Lozenge>
      ),
      footer: noData ? "Sem dados no período" : `Meta do mês: ${formatNumber(all.target)}`,
    },
    {
      id: "rate",
      label: "Taxa de apontamento",
      value: noData ? "—" : `${all.entryRate}%`,
      footer: noData ? "Sem dados no período" : "Dias com apontamento sobre dias úteis",
    },
    {
      id: "active",
      label: "Máquinas ativas",
      value: noData ? "—" : all.count,
      aside: noData ? undefined : <span className="font-body-large text-subtle">de {MACHINES.length}</span>,
      footer: noData ? "Sem dados no período" : "Todas com apontamento no mês",
    },
  ];

  return (
    <>
      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-full flex-col">
        {/* ---------- Cabeçalho da página ---------- */}
        <div className="px-200 pt-300 m:px-400">
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
          <Tabs.List aria-label="Visões da página" className="mt-200 flex gap-300 overflow-x-auto overflow-y-hidden border-b">
            {[
              ["overview", "Visão geral"],
              ["detailed", "Detalhado"],
              ["shifts", "Turnos"],
              ["charts", "Gráficos"],
            ].map(([value, label]) => (
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

        {/* ---------- Visão geral ---------- */}
        <Tabs.Content value="overview" className="flex flex-col gap-300 px-200 py-300 outline-none m:px-400">
          <div role="toolbar" aria-label="Filtros" className="flex flex-wrap items-center gap-100">
            <FilterPill label="Período" value={filters.period} defaultValue={DEFAULT_FILTERS.period} options={PERIODS} onChange={setFilter("period")} />
            <FilterPill label="Máquina" value={filters.machine} defaultValue="all" options={MACHINE_OPTIONS} onChange={setFilter("machine")} />
            <FilterPill label="Turno" value={filters.shift} defaultValue="all" options={SHIFTS} onChange={setFilter("shift")} />
            <FilterPill label="Status" value={filters.status} defaultValue="all" options={STATUSES} onChange={setFilter("status")} />
            {(filtersActive || search) && (
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

          <KpiStrip items={kpis} isLoading={kpiLoading} />

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
            emptyState={
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
                  hint={search ? `Nada corresponde a "${search}" com os filtros atuais.` : "Nenhuma máquina corresponde aos filtros selecionados."}
                  action={{ label: "Limpar filtros", icon: FilterX, onClick: clearFilters }}
                />
              )
            }
            errorState={
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
            }
          />
        </Tabs.Content>

        {[
          ["detailed", LayoutList, "Visão detalhada"],
          ["shifts", Users, "Comparativo por turno"],
          ["charts", BarChart3, "Gráficos"],
        ].map(([value, Icon, title]) => (
          <Tabs.Content key={value as string} value={value as string} className="px-200 py-300 outline-none m:px-400">
            <EmptyState
              icon={Icon as typeof LayoutList}
              title={title as string}
              hint="Esta visão ainda não faz parte do protótipo. A navegação e os estados já seguem o sistema."
              action={{ label: "Voltar para a visão geral", onClick: () => setTab("overview") }}
            />
          </Tabs.Content>
        ))}
      </Tabs.Root>

      <MachinePanel
        machine={panelMachine}
        open={activeId != null && tab === "overview"}
        shift={filters.shift}
        onClose={() => {
          // devolve o foco à linha que abriu o painel
          document.querySelector<HTMLElement>(`tr[aria-current="true"]`)?.focus();
          setActiveId(null);
        }}
        onAction={onAction}
      />
    </>
  );
}

