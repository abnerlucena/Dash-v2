import { ChevronDown, MessageSquarePlus, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LINE_ACCENT,
  MACHINE_GROUPS,
  MACHINES,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  machineById,
  metaPerShift,
  statusFor,
  type Shift,
} from "@/data/machines";
import { cn, formatNumber, readToken, type Notify } from "@/lib/utils";
import { useOps } from "@/features/ops/OpsStore";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { SegmentedBar } from "@/components/data/SegmentedBar";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TagGroup } from "@/components/ui/Tag";
import { TextArea, TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";

/* ---------- Modelo do formulário ---------- */
interface OpRow {
  key: string;
  op: string;
  qty: string;
  rework: boolean;
}
interface MachineEntry {
  rows: OpRow[];
  note: string;
  noteOpen: boolean;
  /** já existia apontamento salvo para esta data/turno */
  existing: boolean;
}
type Form = Record<string, MachineEntry>;

let rowSeq = 0;
const newRow = (op = "", qty = "", rework = false): OpRow => ({ key: `r${rowSeq++}`, op, qty, rework });

/** Carrega o que já foi apontado para a data/turno (edição) ou um formulário vazio */
function loadForm(date: string, shift: Shift): Form {
  const day = Number(date.slice(8, 10));
  const sameMonth = date.startsWith("2026-03");
  const form: Form = {};
  for (const m of MACHINES) {
    const orders = sameMonth ? m.orders.filter((o) => o.date.getDate() === day && o.shift === shift) : [];
    form[m.id] = {
      rows: orders.length
        ? orders.map((o) => newRow(o.opId.replace("OP ", ""), String(o.quantity), o.rework))
        : [newRow()],
      note: orders.find((o) => o.note)?.note?.text ?? "",
      noteOpen: orders.some((o) => o.note),
      existing: orders.length > 0,
    };
  }
  return form;
}

const OP_PATTERN = /^\d{7}$/;
const qtyOf = (r: OpRow) => (r.qty.trim() === "" ? 0 : Number(r.qty));

function rowErrors(r: OpRow) {
  const qty = r.qty.trim();
  const errors: { op?: string; qty?: string } = {};
  if (qty !== "" && (!Number.isInteger(Number(qty)) || Number(qty) < 0)) errors.qty = "Use um número inteiro";
  if (qtyOf(r) > 0 && !r.op.trim()) errors.op = "Informe o número da OP";
  else if (r.op.trim() && !OP_PATTERN.test(r.op.trim())) errors.op = "Use 7 dígitos (ex.: 4501234)";
  return errors;
}

interface EntryPageProps {
  notify: Notify;
}

export function EntryPage({ notify }: EntryPageProps) {
  const [date, setDate] = useState("2026-03-27");
  const [shift, setShift] = useState<Shift>(1);
  const [form, setForm] = useState<Form>(() => loadForm("2026-03-27", 1));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ date: string; shift: Shift } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const switchContext = (next: { date: string; shift: Shift }) => {
    // Trocar data/turno com alterações não salvas pede confirmação
    if (dirty) return setPending(next);
    applyContext(next);
  };
  const applyContext = (next: { date: string; shift: Shift }) => {
    setDate(next.date);
    setShift(next.shift);
    setForm(loadForm(next.date, next.shift));
    setDirty(false);
    setSavedAt(null);
    setShowErrors(false);
    setPending(null);
  };

  const update = (machineId: string, fn: (e: MachineEntry) => MachineEntry) => {
    setForm((f) => ({ ...f, [machineId]: fn(f[machineId]) }));
    setDirty(true);
    setSavedAt(null);
  };

  const totals = useMemo(
    () => Object.fromEntries(Object.entries(form).map(([id, e]) => [id, e.rows.reduce((s, r) => s + qtyOf(r), 0)])),
    [form],
  );
  const filled = Object.values(totals).filter((t) => t > 0).length;
  const errorCount = Object.values(form)
    .flatMap((e) => e.rows)
    .reduce((n, r) => n + Object.keys(rowErrors(r)).length, 0);

  const save = useCallback(() => {
    if (saving) return;
    if (errorCount > 0) {
      setShowErrors(true);
      notify(
        "Corrija os campos destacados",
        `${errorCount} ${errorCount === 1 ? "campo precisa" : "campos precisam"} de ajuste antes de salvar.`,
        "error",
      );
      // leva o foco ao primeiro campo inválido
      window.setTimeout(() => bodyRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setDirty(false);
      setShowErrors(false);
      setSavedAt(new Date());
      const [y, mo, d] = date.split("-");
      notify("Apontamento salvo", `${filled} ${filled === 1 ? "máquina" : "máquinas"} · ${SHIFT_META[shift].label} · ${d}/${mo}/${y}`);
    }, readToken("--ds-motion-duration-skeleton") / 2);
  }, [saving, errorCount, notify, date, filled, shift]);

  // Ctrl+S salva
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const q = search.trim().toLowerCase();
  const groups = MACHINE_GROUPS.map((g) => ({
    ...g,
    machines: g.machineIds.map(machineById).filter((m) => !q || m.name.toLowerCase().includes(q)),
  })).filter((g) => g.machines.length > 0);

  const status = savedAt ? (
    <Lozenge appearance="success">
      Salvo às {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </Lozenge>
  ) : dirty ? (
    <Lozenge appearance="warning">Alterações não salvas</Lozenge>
  ) : null;

  return (
    <>
      <PageHeader
        title="Apontamento"
        lozenge={status}
        description="Registre a produção de cada máquina por turno. Uma máquina pode ter várias ordens de produção (OP)."
        actions={
          <>
            <Button
              appearance="subtle"
              iconBefore={RotateCcw}
              isDisabled={!dirty}
              onClick={() => applyContext({ date, shift })}
            >
              Descartar alterações
            </Button>
            <Button appearance="primary" iconBefore={Save} isLoading={saving} onClick={save} title="Ctrl+S">
              Salvar apontamento
            </Button>
          </>
        }
      />

      <PageBody>
        {/* ---------- Contexto: data, turno, busca, progresso ---------- */}
        <div className="flex flex-wrap items-start gap-x-300 gap-y-200 rounded-large bg-surface-sunken p-200">
          <DateField
            label="Data"
            value={date}
            min="2026-03-01"
            max="2026-03-31"
            today="2026-03-27"
            onChange={(d) => switchContext({ date: d, shift })}
            className="w-1000 min-w-column-name"
          />
          <div className="flex flex-col gap-050">
            <span id="entry-shift" className="font-body-small font-semibold text-subtle">
              Turno <span className="font-normal text-subtlest">· {SHIFT_META[shift].hours}</span>
            </span>
            <SegmentedControl
              label="Turno"
              size="control"
              iconOnly={false}
              value={String(shift)}
              onChange={(v) => switchContext({ date, shift: Number(v) as Shift })}
              options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
            />
          </div>
          <TextField
            label="Filtrar máquinas"
            placeholder="Nome da máquina"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            elemAfter={<Search aria-hidden className="size-icon-small" />}
            className="min-w-column-name flex-1"
          />
          <div className="flex min-w-column-name flex-col gap-050" aria-live="polite">
            <span className="font-body-small font-semibold text-subtle">Máquinas com produção</span>
            <span className="flex h-control flex-col justify-center gap-050">
              <span className="font-body-small text-subtle">
                <span className="font-semibold tabular-nums text-default">{filled}</span> de {MACHINES.length}
              </span>
            <span
              role="progressbar"
              aria-label="Máquinas com produção"
              aria-valuenow={filled}
              aria-valuemin={0}
              aria-valuemax={MACHINES.length}
              className="flex h-075 overflow-hidden rounded-full bg-neutral"
            >
              <span className="h-full rounded-full bg-brand-bold" style={{ width: `${(filled / MACHINES.length) * 100}%` }} />
              </span>
            </span>
          </div>
        </div>

        {/* ---------- Máquinas por linha ---------- */}
        <div ref={bodyRef} className="flex flex-col gap-300">
          {groups.length === 0 && (
            <div className="rounded-xlarge border">
              <EmptyState
                icon={Search}
                title="Nenhuma máquina encontrada"
                hint={`Nada corresponde a "${search}".`}
                action={{ label: "Limpar filtro", onClick: () => setSearch("") }}
              />
            </div>
          )}
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            const groupFilled = g.machines.filter((m) => totals[m.id] > 0).length;
            return (
              <section key={g.id} aria-labelledby={`grp-${g.id}`}>
                <h2>
                  <button
                    id={`grp-${g.id}`}
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`grp-body-${g.id}`}
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c);
                        if (n.has(g.id)) n.delete(g.id);
                        else n.add(g.id);
                        return n;
                      })
                    }
                    className="ds-pressable -mx-100 flex items-center gap-100 rounded-medium px-100 py-050 hover:bg-neutral-subtle-hovered"
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn("size-icon-small text-icon-subtle transition-transform duration-menu ease-out", isCollapsed && "-rotate-90")}
                    />
                    <span className="font-heading-small text-default">{g.label}</span>
                    <span className="font-body-small tabular-nums text-subtlest">
                      {groupFilled} de {g.machines.length} preenchidas
                    </span>
                  </button>
                </h2>
                {!isCollapsed && (
                  <ul id={`grp-body-${g.id}`} className="mt-100 flex flex-col overflow-hidden rounded-xlarge border">
                    {g.machines.map((m) => (
                      <MachineEntryRow
                        key={m.id}
                        machineId={m.id}
                        entry={form[m.id]}
                        total={totals[m.id]}
                        showErrors={showErrors}
                        onChange={(fn) => update(m.id, fn)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </PageBody>

      <Modal
        open={pending != null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Descartar alterações?"
        primary={{ label: "Descartar e trocar", appearance: "danger", onClick: () => pending && applyContext(pending) }}
        cancelLabel="Continuar editando"
      >
        Há apontamentos não salvos para {SHIFT_META[shift].label.toLowerCase()} de {date.split("-").reverse().join("/")}. Se
        trocar a data ou o turno agora, eles serão perdidos.
      </Modal>
    </>
  );
}

/* ---------- Uma máquina: OPs, total, % da meta do turno, observação ---------- */
function MachineEntryRow({
  machineId,
  entry,
  total,
  showErrors,
  onChange,
}: {
  machineId: string;
  entry: MachineEntry;
  total: number;
  showErrors: boolean;
  onChange: (fn: (e: MachineEntry) => MachineEntry) => void;
}) {
  const m = machineById(machineId);
  const { ops } = useOps();
  // OPs liberadas para esta máquina: o campo sugere os números
  const openOps = ops.filter((op) => op.machineId === m.id && (op.stage === "running" || op.stage === "paused"));
  const listId = `ops-${m.id}`;
  const meta = m.hasTarget ? metaPerShift(m) : 0;
  const percent = meta ? Math.round((total / meta) * 100) : 0;
  const status = statusFor(percent);
  const tooHigh = m.hasTarget && total > meta * 2;

  const setRow = (key: string, patch: Partial<OpRow>) =>
    onChange((e) => ({ ...e, rows: e.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  return (
    <li className="flex flex-col gap-200 border-t p-200 first:border-t-0 l:flex-row">
      {/* Identificação e resultado */}
      <div className="flex min-w-0 flex-col gap-100 l:w-column-name l:shrink-0">
        <div className="flex flex-wrap items-center gap-100">
          <h3 className="font-heading-xsmall text-default">{m.name}</h3>
          {entry.existing && <Lozenge appearance="information">Já apontado</Lozenge>}
        </div>
        <TagGroup items={m.lines} accentFor={(l) => LINE_ACCENT[l] ?? "gray"} />
        {m.hasTarget ? (
          <>
            <div className="mt-050 flex flex-wrap items-center gap-100">
              <SegmentedBar percent={percent} status={status} label={`${m.name}: ${percent}% da meta do turno`} />
              <span className="font-medium tabular-nums text-default">{percent}%</span>
              {total > 0 && <Lozenge appearance={STATUS_META[status].appearance}>{STATUS_META[status].label}</Lozenge>}
            </div>
            <p className="font-body-small text-subtlest">
              <span className="font-semibold tabular-nums text-default">{formatNumber(total)}</span> de{" "}
              <span className="tabular-nums">{formatNumber(meta)}</span> (meta do turno)
            </p>
          </>
        ) : (
          <p className="mt-050 font-body-small text-subtlest">
            <span className="font-semibold tabular-nums text-default">{formatNumber(total)}</span> peças no turno · centro por
            demanda, sem meta
          </p>
        )}
        {openOps.length > 0 && (
          <p className="font-body-small text-subtle">
            {openOps.length === 1 ? "OP liberada: " : "OPs liberadas: "}
            {openOps.map((op, i) => (
              <span key={op.id}>
                {i > 0 && ", "}
                <a href={`#/feedbacks/${op.id.replace("OP ", "")}`} className="font-code text-link hover:underline">
                  {op.id.replace("OP ", "")}
                </a>
              </span>
            ))}
          </p>
        )}
        <datalist id={listId}>
          {openOps.map((op) => (
            <option key={op.id} value={op.id.replace("OP ", "")}>
              {op.product}
            </option>
          ))}
        </datalist>
        {tooHigh && (
          <p className="font-body-small text-warning">Acima de 2× a meta do turno. Confira as quantidades.</p>
        )}
      </div>

      {/* OPs */}
      <div className="flex min-w-0 flex-1 flex-col gap-100">
        {entry.rows.map((r, i) => {
          const errors = showErrors || r.op || r.qty ? rowErrors(r) : {};
          return (
            <div key={r.key} className="flex flex-wrap items-start gap-100">
              <TextField
                label="Nº da OP"
                hideLabel={i > 0}
                aria-label={`Nº da OP, linha ${i + 1}, ${m.name}`}
                inputMode="numeric"
                placeholder="Ex.: 4501234"
                list={listId}
                value={r.op}
                onChange={(e) => setRow(r.key, { op: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                error={showErrors || r.op.length >= 7 || (r.qty && !r.op) ? errors.op : null}
                inputClassName="font-code"
                className="w-field-op flex-1 basis-field-op s:flex-none"
              />
              <TextField
                label="Quantidade"
                hideLabel={i > 0}
                aria-label={`Quantidade, linha ${i + 1}, ${m.name}`}
                inputMode="numeric"
                placeholder="0"
                value={r.qty}
                onChange={(e) => setRow(r.key, { qty: e.target.value.replace(/[^\d]/g, "") })}
                error={errors.qty}
                elemAfter="un."
                inputClassName="text-right tabular-nums"
                className="w-field-quantity flex-1 basis-field-quantity s:flex-none"
              />
              <label className={cn("flex h-control items-center gap-075 font-body text-subtle", i === 0 && "s:mt-250")}>
                <Checkbox
                  label={`Retrabalho, linha ${i + 1}, ${m.name}`}
                  checked={r.rework}
                  onChange={(e) => setRow(r.key, { rework: e.target.checked })}
                />
                <span aria-hidden>Retrabalho</span>
              </label>
              <IconButton
                icon={Trash2}
                label={`Remover OP da linha ${i + 1}`}
                isDisabled={entry.rows.length === 1}
                onClick={() =>
                  entry.rows.length > 1 && onChange((e) => ({ ...e, rows: e.rows.filter((x) => x.key !== r.key) }))
                }
                className={cn(i === 0 && "s:mt-250")}
              />
            </div>
          );
        })}
        <div className="flex flex-wrap gap-100">
          <Button
            appearance="subtle"
            spacing="compact"
            iconBefore={Plus}
            onClick={() => onChange((e) => ({ ...e, rows: [...e.rows, newRow()] }))}
          >
            Adicionar OP
          </Button>
          {!entry.noteOpen && (
            <Button
              appearance="subtle"
              spacing="compact"
              iconBefore={MessageSquarePlus}
              onClick={() => onChange((e) => ({ ...e, noteOpen: true }))}
            >
              Adicionar observação
            </Button>
          )}
        </div>
        {entry.noteOpen && (
          <TextArea
            label="Observação do turno"
            placeholder="Paradas, falta de material, ajustes… vira um feedback para a gestão."
            maxLength={500}
            value={entry.note}
            onChange={(e) => onChange((x) => ({ ...x, note: e.target.value }))}
          />
        )}
      </div>
    </li>
  );
}
