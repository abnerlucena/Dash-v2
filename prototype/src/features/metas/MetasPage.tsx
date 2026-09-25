import { Info, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ACTIVE_SHIFTS,
  MACHINES,
  META_CHANGES,
  META_EFFECTIVE_FROM,
  STATUS_META,
  WORKING_DAYS,
  groupOf,
  metaPerShift,
  statusFor,
  type Machine,
  type MetaChange,
} from "@/data/machines";
import { formatNumber, readToken, type Notify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { SegmentedBar } from "@/components/data/SegmentedBar";
import * as Tabs from "@radix-ui/react-tabs";
import { PageActions, PageBody, PageHeader, PAGE_GUTTER } from "@/components/layout/PageHeader";
import { CapacitySimulator } from "@/features/capacity/CapacitySimulator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { Avatar } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";

const initialValues = () => Object.fromEntries(MACHINES.map((m) => [m.id, String(metaPerShift(m))]));
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Vigência mínima: dia seguinte à data de referência (metas nunca mudam o passado) */
const MIN_EFFECTIVE = "2026-03-28";

interface CurrentMetasProps {
  notify: Notify;
  history: MetaChange[];
  setHistory: React.Dispatch<React.SetStateAction<MetaChange[]>>;
}

/** Aba "Metas vigentes": meta por turno de cada máquina, edição manual com vigência e histórico */
function CurrentMetas({ notify, history, setHistory }: CurrentMetasProps) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(initialValues);
  const [values, setValues] = useState(initialValues);
  const [shifts, setShifts] = useState(ACTIVE_SHIFTS);
  const [savedShifts, setSavedShifts] = useState(ACTIVE_SHIFTS);
  const [effective, setEffective] = useState("2026-04-01");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const perShift = (id: string) => Number(values[id]) || 0;
  const errorOf = (id: string) => {
    const v = values[id].trim();
    if (!v) return "Informe a meta";
    if (!/^\d+$/.test(v) || Number(v) <= 0) return "Use um número inteiro maior que zero";
    return null;
  };
  const changed = MACHINES.filter((m) => values[m.id] !== saved[m.id]);
  const shiftsChanged = shifts !== savedShifts;
  const hasErrors = MACHINES.some((m) => errorOf(m.id));
  const effectiveError = effective < MIN_EFFECTIVE ? "A vigência precisa ser a partir de 28/03/2026" : null;

  const original = useMemo(initialValues, []);
  // Sem edição, vale a meta mensal original (evita o arredondamento da meta por turno)
  const monthOf = (m: Machine) =>
    values[m.id] === original[m.id] && shifts === ACTIVE_SHIFTS ? m.target : perShift(m.id) * shifts * WORKING_DAYS;
  const plantMonth = MACHINES.reduce((s, m) => s + monthOf(m), 0);
  const plantProduced = MACHINES.reduce((s, m) => s + m.produced, 0);

  const kpis: KpiItem[] = [
    { id: "month", label: "Meta do mês · fábrica", value: formatNumber(plantMonth), footer: `${WORKING_DAYS} dias úteis` },
    { id: "day", label: "Meta por dia", value: formatNumber(Math.round(plantMonth / WORKING_DAYS)), footer: `${shifts} ${shifts === 1 ? "turno ativo" : "turnos ativos"}` },
    {
      id: "pct",
      label: "Atingimento com estas metas",
      value: `${Math.round((plantProduced / plantMonth) * 100)}%`,
      aside: (
        <Lozenge appearance={STATUS_META[statusFor(Math.round((plantProduced / plantMonth) * 100))].appearance}>
          {STATUS_META[statusFor(Math.round((plantProduced / plantMonth) * 100))].label}
        </Lozenge>
      ),
      footer: "Produção de março contra a meta mensal",
    },
    { id: "machines", label: "Máquinas com meta", value: MACHINES.length, footer: `Vigente desde ${dateOnly.format(META_EFFECTIVE_FROM)}` },
  ];

  const columns: Column<Machine>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Máquina",
        className: "min-w-column-name",
        cell: (m) => <span className="font-medium text-default">{m.name}</span>,
      },
      {
        id: "group",
        header: "Linha",
        cell: (m) => <span className="text-subtle">{groupOf(m.id).label}</span>,
      },
      {
        id: "perShift",
        header: "Meta por turno",
        align: "end",
        cell: (m) =>
          editing ? (
            <span className="flex items-center justify-end gap-100">
              {values[m.id] !== saved[m.id] && !errorOf(m.id) && <Lozenge appearance="discovery">Alterada</Lozenge>}
              <TextField
                label={`Meta por turno de ${m.name}`}
                hideLabel
                inputMode="numeric"
                value={values[m.id]}
                onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value.replace(/[^\d]/g, "") }))}
                error={errorOf(m.id)}
                inputClassName="text-right tabular-nums"
                spacing="compact"
                className="w-field-quantity"
              />
            </span>
          ) : (
            <span className="font-medium tabular-nums text-default">{formatNumber(perShift(m.id))}</span>
          ),
      },
      {
        id: "perDay",
        header: "Meta por dia",
        align: "end",
        cell: (m) => <span className="tabular-nums text-subtle">{formatNumber(perShift(m.id) * shifts)}</span>,
        footer: <span className="tabular-nums">{formatNumber(Math.round(plantMonth / WORKING_DAYS))}</span>,
      },
      {
        id: "perMonth",
        header: `Meta do mês (${WORKING_DAYS} dias)`,
        align: "end",
        cell: (m) => <span className="tabular-nums text-default">{formatNumber(monthOf(m))}</span>,
        footer: <span className="font-semibold tabular-nums text-default">{formatNumber(plantMonth)}</span>,
      },
      {
        id: "produced",
        header: "Produção em março",
        align: "end",
        cell: (m) => <span className="tabular-nums text-subtle">{formatNumber(m.produced)}</span>,
        footer: <span className="tabular-nums">{formatNumber(plantProduced)}</span>,
      },
      {
        id: "pct",
        header: "Atingimento",
        className: "pr-200",
        cell: (m) => {
          const month = monthOf(m);
          const pct = month ? Math.round((m.produced / month) * 100) : 0;
          const st = statusFor(pct);
          return (
            <span className="flex items-center gap-100">
              <SegmentedBar percent={pct} status={st} label={`Atingimento de ${m.name}`} />
              <span aria-hidden className="w-400 text-right font-medium tabular-nums text-default">
                {pct}%
              </span>
              <Lozenge appearance={STATUS_META[st].appearance}>{STATUS_META[st].label}</Lozenge>
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, values, saved, shifts],
  );

  const startEdit = () => {
    setValues(saved);
    setShifts(savedShifts);
    setEditing(true);
  };
  const cancel = () => {
    setValues(saved);
    setShifts(savedShifts);
    setEditing(false);
  };
  const confirmSave = () => {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setConfirming(false);
      setEditing(false);
      setSaved(values);
      setSavedShifts(shifts);
      const when = dateOnly.format(new Date(`${effective}T12:00:00`));
      const parts = [
        ...changed.map((m) => `${m.name}: ${formatNumber(Number(saved[m.id]))} → ${formatNumber(Number(values[m.id]))} por turno`),
        ...(shiftsChanged ? [`Turnos ativos: ${savedShifts} → ${shifts}`] : []),
      ];
      setHistory((h) => [
        { id: `c${Date.now()}`, date: new Date(), author: "Rafael Souza", summary: `${parts.join("; ")} (vigência ${when})` },
        ...h,
      ]);
      notify("Metas salvas", `${parts.length} ${parts.length === 1 ? "alteração passa" : "alterações passam"} a valer em ${when}.`);
    }, readToken("--ds-motion-duration-skeleton") / 2);
  };

  return (
    <>
      <div className={cn(PAGE_GUTTER, "flex flex-wrap items-center justify-between gap-200 pt-300")}>
        <span className="flex min-w-0 flex-1 basis-kpi-min flex-wrap items-center gap-100">
          {editing ? (
            <Lozenge appearance="discovery">Editando</Lozenge>
          ) : (
            <Lozenge>Vigente desde {dateOnly.format(META_EFFECTIVE_FROM)}</Lozenge>
          )}
          <span className="text-subtle">
            Meta por dia = meta por turno × turnos ativos. Meta do mês = meta por dia × dias úteis.
          </span>
        </span>
        <PageActions>
          {editing ? (
            <>
              <Button appearance="subtle" onClick={cancel}>
                Cancelar
              </Button>
              <Button
                appearance="primary"
                isDisabled={(!changed.length && !shiftsChanged) || hasErrors || !!effectiveError}
                onClick={() => setConfirming(true)}
              >
                Revisar e salvar
              </Button>
            </>
          ) : (
            <Button appearance="primary" iconBefore={Pencil} onClick={startEdit}>
              Editar metas
            </Button>
          )}
        </PageActions>
      </div>

      <PageBody>
        <KpiStrip items={kpis} label="Resumo das metas" />

        {editing && (
          <div className="flex flex-wrap items-end gap-300 rounded-large bg-information p-200">
            <div className="flex min-w-0 flex-1 gap-150">
              <Info aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-information" />
              <div>
                <p className="font-heading-xsmall text-default">Revise as metas por turno</p>
                <p className="mt-050 text-default">
                  Os valores do mês e o atingimento se recalculam enquanto você edita. As novas metas não mudam os números já
                  fechados de março.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-050">
              <span className="font-body-small font-semibold text-subtle">Turnos ativos</span>
              <SegmentedControl
                label="Turnos ativos"
                iconOnly={false}
                value={String(shifts)}
                onChange={(v) => setShifts(Number(v))}
                options={[1, 2, 3].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "turno" : "turnos"}` }))}
              />
            </div>
            <DateField
              label="Vale a partir de"
              value={effective}
              min={MIN_EFFECTIVE}
              onChange={setEffective}
              error={effectiveError}
              isRequired
              className="w-column-name"
            />
          </div>
        )}

        <DataTable
          caption="Metas por máquina"
          columns={columns}
          rows={MACHINES}
          getRowId={(m) => m.id}
          getRowLabel={(m) => `${m.name}, meta por turno ${formatNumber(perShift(m.id))}`}
          selectable={false}
          footerLead={`${MACHINES.length} máquinas`}
        />

        <section aria-labelledby="meta-history" className="flex flex-col gap-150">
          <h2 id="meta-history" className="font-heading-small text-default">
            Histórico de alterações
          </h2>
          <ol className="flex flex-col overflow-hidden rounded-xlarge border">
            {history.map((c) => (
              <li key={c.id} className="flex items-start gap-150 border-t px-200 py-150 first:border-t-0">
                <Avatar name={c.author} accent={c.author === "Rafael Souza" ? "teal" : "purple"} />
                <div className="min-w-0 flex-1">
                  <p className="text-default">{c.summary}</p>
                  <p className="mt-025 font-body-small text-subtlest">
                    {c.author} · {dateTime.format(c.date)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </PageBody>

      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title="Salvar novas metas?"
        primary={{ label: "Salvar metas", onClick: confirmSave, isLoading: saving }}
        cancelLabel="Voltar"
      >
        <p>
          As alterações valem a partir de{" "}
          <strong className="font-semibold">{dateOnly.format(new Date(`${effective}T12:00:00`))}</strong> para todos os
          usuários.
        </p>
        <ul className="mt-150 flex flex-col gap-075">
          {changed.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-100 rounded-medium bg-neutral px-150 py-100">
              <span className="font-medium">{m.name}</span>
              <span className="tabular-nums text-subtle">
                {formatNumber(Number(saved[m.id]))} → <strong className="font-semibold text-default">{formatNumber(Number(values[m.id]))}</strong> por turno
              </span>
            </li>
          ))}
          {shiftsChanged && (
            <li className="flex justify-between rounded-medium bg-neutral px-150 py-100">
              <span className="font-medium">Turnos ativos</span>
              <span className="tabular-nums text-subtle">
                {savedShifts} → <strong className="font-semibold text-default">{shifts}</strong>
              </span>
            </li>
          )}
        </ul>
      </Modal>
    </>
  );
}

const TAB_CLASS =
  "flex shrink-0 items-center gap-075 whitespace-nowrap border-b-thick border-transparent pb-100 pt-050 font-body font-medium text-subtle transition-colors duration-hover ease-out hover:text-default data-[state=active]:border-selected data-[state=active]:text-selected";

/**
 * Metas: a aba "Metas vigentes" mostra e edita a meta por turno de cada máquina;
 * o "Simulador de capacidade" recalcula metas a partir da planilha de capacidade.
 * Publicar no simulador registra a alteração no histórico das metas vigentes.
 */
export function MetasPage({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState("vigentes");
  const [history, setHistory] = useState<MetaChange[]>(META_CHANGES);

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <PageHeader title="Metas" description="Metas por turno de cada máquina e a capacidade que as sustenta.">
        <Tabs.List aria-label="Visões de metas" className="mt-200 flex gap-300 overflow-x-auto overflow-y-hidden border-b">
          <Tabs.Trigger value="vigentes" className={TAB_CLASS}>
            Metas vigentes
          </Tabs.Trigger>
          <Tabs.Trigger value="capacidade" className={TAB_CLASS}>
            Simulador de capacidade
          </Tabs.Trigger>
        </Tabs.List>
      </PageHeader>
      <Tabs.Content value="vigentes" className="outline-none data-[state=inactive]:hidden">
        <CurrentMetas notify={notify} history={history} setHistory={setHistory} />
      </Tabs.Content>
      {/* forceMount: o cenário simulado continua ao trocar de aba */}
      <Tabs.Content value="capacidade" forceMount className="outline-none data-[state=inactive]:hidden">
        <CapacitySimulator
          notify={notify}
          onPublished={(summary, when) =>
            setHistory((h) => [
              { id: `cap-${Date.now()}`, date: new Date(), author: "Rafael Souza", summary: `${summary} · vigência ${when}` },
              ...h,
            ])
          }
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
