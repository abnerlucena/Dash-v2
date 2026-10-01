import { ChevronDown, Info, Pencil, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ACTIVE_SHIFTS,
  DATA_END,
  TARGET_MACHINES,
  META_CHANGES,
  META_EFFECTIVE_FROM,
  STATUS_META,
  WORKING_DAYS,
  groupOf,
  metaPerShift,
  statusFor,
  toIsoDate,
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
import { useAccess } from "@/features/access/AccessContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { Avatar } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/Menu";
import type { BaseDaMeta } from "../../../../src/lib/metas";
import { BASE_OPTIONS, baseLabel, baselineCapacity, crewOf, initialBaseOf, saveBases, shiftMeta, useBases, type Capacity } from "./metaBase";

/** Capacidade por turno que o simulador mandou para comparar (nunca grava sozinha — nota de 01/10, § 5) */
export interface CapacityProposal {
  values: Record<string, Capacity>;
  at: Date;
}

const initialValues = () => Object.fromEntries(TARGET_MACHINES.map((m) => [m.id, String(metaPerShift(m))]));
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Vigência mínima: dia seguinte à data de referência (metas nunca mudam o passado) */
const MIN_EFFECTIVE = toIsoDate(new Date(DATA_END.getFullYear(), DATA_END.getMonth(), DATA_END.getDate() + 1));

interface CurrentMetasProps {
  notify: Notify;
  proposal: CapacityProposal | null;
  onDismissProposal: () => void;
  history: MetaChange[];
  setHistory: React.Dispatch<React.SetStateAction<MetaChange[]>>;
}

/** Aba "Metas vigentes": meta por turno de cada máquina, edição manual com vigência e histórico */
function CurrentMetas({ notify, history, setHistory, proposal, onDismissProposal }: CurrentMetasProps) {
  const { can, session } = useAccess();
  // Ver metas é targets.view (rota); alterar é targets.manage
  const canManage = can("targets.manage");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(initialValues);
  const [values, setValues] = useState(initialValues);
  const [shifts, setShifts] = useState(ACTIVE_SHIFTS);
  const [savedShifts, setSavedShifts] = useState(ACTIVE_SHIFTS);
  const [effective, setEffective] = useState("2026-04-01");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  // Base da meta (D53): a vigente vem do estado compartilhado; a editada fica no rascunho
  const savedBases = useBases();
  const [draftBases, setDraftBases] = useState<Record<string, BaseDaMeta>>({});
  const baseOfDraft = (id: string): BaseDaMeta => draftBases[id] ?? savedBases[id] ?? "per_shift";
  const savedBaseOf = (id: string): BaseDaMeta => savedBases[id] ?? "per_shift";
  const baseChanged = TARGET_MACHINES.filter((m) => baseOfDraft(m.id) !== savedBaseOf(m.id));
  /** Meta de UM turno com a lotação padrão — a conta é a de src/lib/metas.ts */
  const turnOf = (m: Machine) => shiftMeta(m.id, perShift(m.id), baseOfDraft(m.id)).valor;
  /** Capacidade (teto) para comparar: a do cenário simulado, ou a da planilha */
  const capacityOf = (m: Machine) => proposal?.values[m.id] ?? baselineCapacity(m.id);

  const perShift = (id: string) => Number(values[id]) || 0;
  const errorOf = (id: string) => {
    const v = values[id].trim();
    if (!v) return "Informe a meta";
    if (!/^\d+$/.test(v) || Number(v) <= 0) return "Use um número inteiro maior que zero";
    return null;
  };
  const changed = TARGET_MACHINES.filter((m) => values[m.id] !== saved[m.id]);
  const anyChange = changed.length > 0 || baseChanged.length > 0;
  const shiftsChanged = shifts !== savedShifts;
  const hasErrors = TARGET_MACHINES.some((m) => errorOf(m.id));
  const effectiveError = effective < MIN_EFFECTIVE ? "A vigência precisa ser a partir de 28/03/2026" : null;

  const original = useMemo(initialValues, []);
  // Sem edição, vale a meta mensal original (evita o arredondamento da meta por turno)
  // Cada máquina roda no seu regime (2 ou 3 turnos); "turnos ativos" é um teto para todas
  const shiftsOf = (m: Machine) => Math.min(m.regime, shifts);
  const monthOf = (m: Machine) =>
    values[m.id] === original[m.id] && shifts === ACTIVE_SHIFTS && baseOfDraft(m.id) === initialBaseOf(m.id)
      ? m.target
      : turnOf(m) * shiftsOf(m) * WORKING_DAYS;
  const plantMonth = TARGET_MACHINES.reduce((s, m) => s + monthOf(m), 0);
  const plantProduced = TARGET_MACHINES.reduce((s, m) => s + m.produced, 0);

  const kpis: KpiItem[] = [
    { id: "month", label: "Meta do mês · fábrica", value: formatNumber(plantMonth), footer: `${WORKING_DAYS} dias úteis` },
    { id: "day", label: "Meta por dia", value: formatNumber(Math.round(plantMonth / WORKING_DAYS)), footer: shifts === ACTIVE_SHIFTS ? "Cada máquina no seu regime de turnos" : `Até ${shifts} ${shifts === 1 ? "turno" : "turnos"} por máquina` },
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
    { id: "machines", label: "Máquinas com meta", value: TARGET_MACHINES.length, footer: `Vigente desde ${dateOnly.format(META_EFFECTIVE_FROM)}` },
  ];

  const columns: Column<Machine>[] = useMemo(
    () => [
      {
        // Linha embaixo do nome: a tabela cabe sem rolagem lateral
        id: "name",
        header: "Máquina",
        cell: (m) => (
          <span className="flex w-column-name flex-col whitespace-normal py-075">
            <span className="font-medium text-default">{m.name}</span>
            <span className="font-body-small text-subtlest">{groupOf(m.id).label}</span>
          </span>
        ),
      },
      {
        id: "perShift",
        header: "Meta por turno",
        align: "end",
        cell: (m) =>
          editing ? (
            <span className="flex flex-col items-end gap-050 py-075">
              <TextField
                label={`Meta por turno de ${m.name}`}
                hideLabel
                inputMode="numeric"
                value={values[m.id]}
                onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value.replace(/[^\d]/g, "") }))}
                error={errorOf(m.id)}
                inputClassName="text-right tabular-nums"
                spacing="compact"
                className="w-1000"
              />
              {values[m.id] !== saved[m.id] && !errorOf(m.id) && <Lozenge appearance="discovery">Alterada</Lozenge>}
            </span>
          ) : (
            <span className="font-medium tabular-nums text-default">{formatNumber(perShift(m.id))}</span>
          ),
      },
      {
        id: "base",
        header: "Base da meta",
        cell: (m) => {
          const crew = crewOf(m.id);
          const base = baseOfDraft(m.id);
          return editing ? (
            <BaseSelect machine={m.name} value={base} changed={base !== savedBaseOf(m.id)} onChange={(b) => setDraftBases((d) => ({ ...d, [m.id]: b }))} />
          ) : (
            <span className="flex flex-col">
              <span className="text-default">{baseLabel(base)}</span>
              {base !== "per_shift" && crew && <span className="font-body-small text-subtlest">lotação padrão {crew}</span>}
            </span>
          );
        },
      },
      {
        id: "perDay",
        header: "Meta por dia",
        align: "end",
        cell: (m) => (
          <span className="tabular-nums text-subtle" title={`${shiftsOf(m)} turnos, com a lotação padrão`}>
            {formatNumber(turnOf(m) * shiftsOf(m))}
          </span>
        ),
        footer: <span className="tabular-nums">{formatNumber(Math.round(plantMonth / WORKING_DAYS))}</span>,
      },
      {
        // Teto técnico do simulador ao lado da meta acordada: alarme, não fonte (D40)
        id: "capacity",
        header: "Capacidade",
        align: "end",
        cell: (m) => {
          const cap = capacityOf(m);
          if (!cap) return <span className="text-subtlest">sem taxa</span>;
          // Alarme só acima da capacidade TÉCNICA: aí a meta é fisicamente impossível
          const pct = Math.round((turnOf(m) / cap.technical) * 100);
          return (
            <span className="flex flex-col items-end py-075" title={`Com a eficiência do simulador: ${formatNumber(cap.withEfficiency)} por turno`}>
              <span className="tabular-nums text-subtle">{formatNumber(cap.technical)}</span>
              {pct > 100 ? (
                <Lozenge appearance="danger">
                  <TriangleAlert aria-hidden className="size-icon-small" />
                  Acima do teto
                </Lozenge>
              ) : (
                <span className="font-body-small text-subtlest">meta = {pct}%</span>
              )}
            </span>
          );
        },
      },
      {
        id: "perMonth",
        header: "Meta do mês",
        align: "end",
        cell: (m) => <span className="tabular-nums text-default">{formatNumber(monthOf(m))}</span>,
        footer: <span className="font-semibold tabular-nums text-default">{formatNumber(plantMonth)}</span>,
      },
      {
        id: "produced",
        header: "Produção",
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
    [editing, values, saved, shifts, draftBases, savedBases, proposal],
  );

  const startEdit = () => {
    setValues(saved);
    setShifts(savedShifts);
    setDraftBases({});
    setEditing(true);
  };
  const cancel = () => {
    setValues(saved);
    setShifts(savedShifts);
    setDraftBases({});
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
      // Só as bases ALTERADAS vão para o banco: máquina fora do mapa mantém a sua (§ 4.1).
      // Com o backend: data.targets.saveMetas(metas, vigência, session, bases)
      saveBases(Object.fromEntries(baseChanged.map((m) => [m.id, baseOfDraft(m.id)])));
      setDraftBases({});
      const when = dateOnly.format(new Date(`${effective}T12:00:00`));
      const parts = [
        ...changed.map((m) => `${m.name}: ${formatNumber(Number(saved[m.id]))} → ${formatNumber(Number(values[m.id]))} por turno`),
        ...baseChanged.map((m) => `${m.name}: base ${baseLabel(savedBaseOf(m.id)).toLowerCase()} → ${baseLabel(baseOfDraft(m.id)).toLowerCase()}`),
        ...(shiftsChanged ? [`Turnos ativos: ${savedShifts} → ${shifts}`] : []),
      ];
      setHistory((h) => [
        { id: `c${Date.now()}`, date: new Date(), author: session?.nome ?? "", summary: `${parts.join("; ")} (vigência ${when})` },
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
            Meta por dia = meta do turno (pela base, com a lotação padrão) × turnos da máquina. Meta do mês = meta por dia × dias úteis.
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
                isDisabled={(!anyChange && !shiftsChanged) || hasErrors || !!effectiveError}
                onClick={() => setConfirming(true)}
              >
                Revisar e salvar
              </Button>
            </>
          ) : canManage ? (
            <Button appearance="primary" iconBefore={Pencil} onClick={startEdit}>
              Editar metas
            </Button>
          ) : (
            <Lozenge>Somente leitura</Lozenge>
          )}
        </PageActions>
      </div>

      <PageBody>
        <KpiStrip items={kpis} label="Resumo das metas" />

        {proposal && (
          <div role="status" className="flex flex-wrap items-start gap-150 rounded-large bg-warning p-200">
            <TriangleAlert aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-heading-xsmall text-default">Capacidade do cenário simulado, para comparar</p>
              <p className="mt-050 text-default">
                A coluna de capacidade agora mostra o cenário do simulador (peças/min × tempo útil; passe o mouse para ver com eficiência). Capacidade não é
                meta, e nada foi alterado. O alarme só aparece quando a meta passa da capacidade técnica. Para mudar alguma meta, edite e salve com a vigência.
              </p>
            </div>
            <Button appearance="subtle" spacing="compact" onClick={onDismissProposal}>
              Voltar à capacidade da planilha
            </Button>
          </div>
        )}

        {editing && (
          <div className="flex flex-wrap items-end gap-300 rounded-large bg-information p-200">
            <div className="flex min-w-0 flex-1 gap-150">
              <Info aria-hidden className="mt-025 size-icon-small shrink-0 text-icon-information" />
              <div>
                <p className="font-heading-xsmall text-default">Revise as metas por turno</p>
                <p className="mt-050 text-default">
                  Os valores do mês e o atingimento se recalculam enquanto você edita; cada máquina conta só os turnos em que roda. As novas metas não mudam os números já
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
          rows={TARGET_MACHINES}
          getRowId={(m) => m.id}
          getRowLabel={(m) => `${m.name}, meta por turno ${formatNumber(perShift(m.id))}`}
          selectable={false}
          footerLead={`${TARGET_MACHINES.length} máquinas`}
        />

        <section aria-labelledby="meta-history" className="flex flex-col gap-150">
          <h2 id="meta-history" className="font-heading-small text-default">
            Histórico de alterações
          </h2>
          <ol className="flex flex-col overflow-hidden rounded-xlarge border">
            {history.map((c) => (
              <li key={c.id} className="flex items-start gap-150 border-t px-200 py-150 first:border-t-0">
                <Avatar name={c.author} accent={c.author === session?.nome ? "teal" : "purple"} />
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
          {baseChanged.map((m) => (
            <li key={`b-${m.id}`} className="flex flex-wrap items-center justify-between gap-100 rounded-medium bg-neutral px-150 py-100">
              <span className="font-medium">{m.name}</span>
              <span className="text-subtle">
                {baseLabel(savedBaseOf(m.id))} → <strong className="font-semibold text-default">{baseLabel(baseOfDraft(m.id))}</strong>
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
        {baseChanged.length > 0 && (
          <p className="mt-150 font-body-small text-subtle">
            Mudar a base cria um degrau novo a partir da vigência. Os apontamentos antigos guardam a base do dia deles.
          </p>
        )}
      </Modal>
    </>
  );
}

/** Escolha da base da meta numa linha da tabela (menu com as três opções) */
function BaseSelect({ machine, value, changed, onChange }: { machine: string; value: BaseDaMeta; changed: boolean; onChange: (b: BaseDaMeta) => void }) {
  return (
    <span className="flex flex-col items-start gap-050 py-075">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`Base da meta de ${machine}: ${baseLabel(value)}`}
            className="ds-pressable flex h-control-compact items-center gap-050 rounded-medium border border-input bg-input px-100 text-default hover:bg-input-hovered"
          >
            {baseLabel(value)}
            <ChevronDown aria-hidden className="size-icon-small text-icon-subtle" />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>Base da meta</MenuLabel>
          <MenuRadioGroup value={value} onValueChange={(v) => onChange(v as BaseDaMeta)}>
            {BASE_OPTIONS.map((o) => (
              <MenuRadioItem key={o.value} value={o.value}>
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  <span className="font-body-small text-subtlest">{o.hint}</span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
      {changed && <Lozenge appearance="discovery">Alterada</Lozenge>}
    </span>
  );
}

const TAB_CLASS =
  "flex shrink-0 items-center gap-075 whitespace-nowrap border-b-thick border-transparent pb-100 pt-050 font-body font-medium text-subtle transition-colors duration-hover ease-out hover:text-default data-[state=active]:border-selected data-[state=active]:text-selected";

/**
 * Metas: a aba "Metas vigentes" mostra e edita a meta por turno de cada máquina;
 * o "Simulador de capacidade" calcula a capacidade (teto técnico) a partir da
 * planilha. O simulador não publica metas: ele manda a capacidade para a aba de
 * metas, onde o gestor compara com a meta acordada e decide (nota de 01/10, § 5).
 */
export function MetasPage({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState("vigentes");
  const [history, setHistory] = useState<MetaChange[]>(META_CHANGES);
  const [proposal, setProposal] = useState<CapacityProposal | null>(null);

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
        <CurrentMetas notify={notify} history={history} setHistory={setHistory} proposal={proposal} onDismissProposal={() => setProposal(null)} />
      </Tabs.Content>
      {/* forceMount: o cenário simulado continua ao trocar de aba */}
      <Tabs.Content value="capacidade" forceMount className="outline-none data-[state=inactive]:hidden">
        {/* O simulador PROPÕE: manda a capacidade para comparar na aba de metas; não grava nada (§ 5) */}
        <CapacitySimulator
          notify={notify}
          onCompare={(values) => {
            setProposal({ values, at: new Date() });
            setTab("vigentes");
          }}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}
