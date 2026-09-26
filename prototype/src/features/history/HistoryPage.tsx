import { CalendarPlus, ChevronLeft, ChevronRight, ClipboardList, MessageSquare, MoreHorizontal, Pencil, Repeat, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ALL_ORDERS,
  MACHINES,
  REFERENCE_DAY,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  WORKING_DAYS,
  machineById,
  statusFor,
  type ProductionOrder,
  type Shift,
} from "@/data/machines";
import { cn, formatCompactShort, formatLongDate, formatNumber, type Notify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { MonthCalendar } from "@/components/data/MonthCalendar";
import { SHIFT_FILL, StackedBar } from "@/components/data/StackedBar";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextArea, TextField } from "@/components/ui/TextField";
import { DateField } from "@/components/ui/DateField";
import { Tooltip } from "@/components/ui/Tooltip";

const PLANT_TARGET = MACHINES.reduce((s, m) => s + m.target, 0);
const DAILY_TARGET = PLANT_TARGET / WORKING_DAYS;
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const isWeekend = (day: number) => [0, 6].includes(new Date(2026, 2, day).getDay());

type Dialog =
  | { kind: "delete"; ids: string[] }
  | { kind: "move"; ids: string[]; day: string }
  | { kind: "edit"; order: ProductionOrder; draft: { qty: string; shift: Shift; rework: boolean; note: string } }
  | null;

export function HistoryPage({ notify }: { notify: Notify }) {
  const [orders, setOrders] = useState<ProductionOrder[]>(ALL_ORDERS);
  const [day, setDay] = useState(REFERENCE_DAY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  // Filtro de turno da tabela do dia (o resumo do dia continua com todos)
  const [shiftFilter, setShiftFilter] = useState<Shift | "all">("all");

  const byDay = useMemo(() => {
    const map = new Map<number, ProductionOrder[]>();
    for (const o of orders) map.set(o.date.getDate(), [...(map.get(o.date.getDate()) ?? []), o]);
    return map;
  }, [orders]);

  const allDayOrders = (byDay.get(day) ?? []).slice().sort((a, b) => a.shift - b.shift || a.machineId.localeCompare(b.machineId));
  const dayOrders = shiftFilter === "all" ? allDayOrders : allDayOrders.filter((o) => o.shift === shiftFilter);
  const dayTotal = allDayOrders.reduce((s, o) => s + o.quantity, 0);
  const visibleTotal = dayOrders.reduce((s, o) => s + o.quantity, 0);
  const byShift = Object.fromEntries(SHIFTS.map((sh) => [sh, allDayOrders.filter((o) => o.shift === sh).reduce((q, o) => q + o.quantity, 0)])) as Record<
    Shift,
    number
  >;
  const dayPct = Math.round((dayTotal / DAILY_TARGET) * 100);
  const date = new Date(2026, 2, day);

  const selectDay = (d: number) => {
    setDay(d);
    setSelected(new Set());
  };
  // Dia útil anterior/seguinte (pula fim de semana), dentro de março
  const stepDay = (dir: 1 | -1) => {
    let d = day + dir;
    while (d >= 1 && d <= 31 && isWeekend(d)) d += dir;
    return d >= 1 && d <= 31 ? d : null;
  };
  const prevDay = stepDay(-1);
  const nextDay = stepDay(1);

  /* ---------- Ações (estado local; "Desfazer" restaura a lista anterior) ---------- */
  const apply = (next: ProductionOrder[], title: string, description: string) => {
    const previous = orders;
    setOrders(next);
    setSelected(new Set());
    setDialog(null);
    notify(title, description, "success", { label: "Desfazer", onClick: () => setOrders(previous) });
  };
  const plural = (n: number) => `${n} ${n === 1 ? "apontamento" : "apontamentos"}`;

  const remove = (ids: string[]) => apply(orders.filter((o) => !ids.includes(o.id)), `${plural(ids.length)} ${ids.length === 1 ? "excluído" : "excluídos"}`, formatLongDate(date));
  const changeShift = (ids: string[], shift: Shift) =>
    apply(
      orders.map((o) => (ids.includes(o.id) ? { ...o, shift } : o)),
      `${plural(ids.length)} ${ids.length === 1 ? "movido" : "movidos"} para o ${SHIFT_META[shift].label.toLowerCase()}`,
      formatLongDate(date),
    );
  const moveTo = (ids: string[], target: string) => {
    const d = Number(target.slice(8, 10));
    const newDate = new Date(2026, 2, d);
    apply(
      orders.map((o) => (ids.includes(o.id) ? { ...o, date: newDate, recordedAt: new Date(2026, 2, d, o.recordedAt.getHours(), o.recordedAt.getMinutes()) } : o)),
      `${plural(ids.length)} ${ids.length === 1 ? "movido" : "movidos"} para ${formatLongDate(newDate)}`,
      `Antes em ${formatLongDate(date)}`,
    );
  };
  const saveEdit = () => {
    if (dialog?.kind !== "edit") return;
    const { order, draft } = dialog;
    apply(
      orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              quantity: Number(draft.qty),
              shift: draft.shift,
              rework: draft.rework,
              reworkReason: draft.rework ? (o.reworkReason ?? "Não informado") : null,
              note: draft.note.trim() ? { id: o.note?.id ?? `n-${o.id}`, text: draft.note.trim(), author: o.note?.author ?? o.operator } : null,
            }
          : o,
      ),
      "Apontamento atualizado",
      `${order.opId} · ${machineById(order.machineId).name}`,
    );
  };

  const moveError =
    dialog?.kind === "move"
      ? !dialog.day
        ? "Escolha uma data"
        : isWeekend(Number(dialog.day.slice(8, 10)))
          ? "Escolha um dia útil"
          : Number(dialog.day.slice(8, 10)) > REFERENCE_DAY
            ? "Não é possível apontar em datas futuras"
            : Number(dialog.day.slice(8, 10)) === day
              ? "Escolha uma data diferente da atual"
              : null
      : null;
  const editError =
    dialog?.kind === "edit" && (!/^\d+$/.test(dialog.draft.qty) || Number(dialog.draft.qty) <= 0) ? "Use um número inteiro maior que zero" : null;

  const columns: Column<ProductionOrder>[] = [
    {
      id: "machine",
      header: "Máquina",
      className: "min-w-column-name",
      cell: (o) => <span className="font-medium text-default">{machineById(o.machineId).name}</span>,
    },
    {
      id: "shift",
      header: "Turno",
      cell: (o) => (
        <span className="flex items-center gap-075">
          <span aria-hidden className={cn("size-dot rounded-full", SHIFT_FILL[o.shift])} />
          {SHIFT_META[o.shift].label}
        </span>
      ),
    },
    { id: "op", header: "OP", cell: (o) => <span className="font-code text-default">{o.opId.replace("OP ", "")}</span> },
    {
      id: "product",
      header: "Material",
      cell: (o) => (
        <span className="flex items-baseline gap-075 whitespace-nowrap" title={`${o.material} · ${o.product}`}>
          <span className="font-code text-subtle">{o.material}</span>
          <span className="max-w-column-name truncate text-subtle">{o.product}</span>
        </span>
      ),
    },
    {
      id: "qty",
      header: "Quantidade",
      align: "end",
      cell: (o) => <span className="font-medium tabular-nums text-default">{formatNumber(o.quantity)}</span>,
      footer: <span className="font-semibold tabular-nums text-default">{formatNumber(visibleTotal)}</span>,
    },
    {
      id: "rework",
      header: "Retrabalho",
      cell: (o) =>
        o.rework ? (
          <Tooltip content={`Motivo: ${o.reworkReason}`}>
            <span tabIndex={0}>
              <Lozenge appearance="warning">Retrabalho</Lozenge>
            </span>
          </Tooltip>
        ) : (
          <span className="text-subtlest">–</span>
        ),
    },
    {
      id: "note",
      header: "Observação",
      cell: (o) =>
        o.note ? (
          <Tooltip content={o.note.text}>
            <span tabIndex={0} aria-label={`Observação: ${o.note.text}`} className="flex max-w-column-name items-center gap-075 text-subtle">
              <MessageSquare aria-hidden className="size-icon-small shrink-0 text-icon-subtle" />
              <span className="truncate">{o.note.text}</span>
            </span>
          </Tooltip>
        ) : (
          <span className="text-subtlest">–</span>
        ),
    },
    {
      id: "by",
      header: "Registrado por",
      cell: (o) => (
        <span className="text-subtle">
          {o.operator} <span className="text-subtlest">· {time.format(o.recordedAt)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "w-500 pr-150",
      cell: (o) => (
        <Menu>
          <MenuTrigger asChild>
            <IconButton icon={MoreHorizontal} label={`Ações para ${o.opId}`} spacing="compact" showTooltip={false} />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              icon={Pencil}
              onSelect={() =>
                setDialog({ kind: "edit", order: o, draft: { qty: String(o.quantity), shift: o.shift, rework: o.rework, note: o.note?.text ?? "" } })
              }
            >
              Editar
            </MenuItem>
            <MenuItem icon={CalendarPlus} onSelect={() => setDialog({ kind: "move", ids: [o.id], day: "" })}>
              Mover para outra data
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} onSelect={() => setDialog({ kind: "delete", ids: [o.id] })}>
              Excluir
            </MenuItem>
          </MenuContent>
        </Menu>
      ),
    },
  ];

  const ids = [...selected];

  return (
    <>
      <PageHeader title="Histórico" description="Confira e corrija os apontamentos de cada dia. Escolha um dia no calendário ou navegue pelas setas." />
      <PageBody>
        {/* Calendário em cima, na largura toda; o dia escolhido abre embaixo, com a tabela sem rolagem lateral */}
        <div className="flex flex-col gap-400">
          <section aria-label="Calendário de março de 2026" className="rounded-large bg-surface-raised p-250 shadow-raised">
            <MonthCalendar
              year={2026}
              month={2}
              selected={day}
              today={REFERENCE_DAY}
              onSelect={selectDay}
              header={
                <div className="flex items-center gap-100">
                  <h2 className="font-heading-small text-default">Março de 2026</h2>
                  <span className="flex gap-050">
                    <IconButton icon={ChevronLeft} label="Mês anterior (sem dados no protótipo)" spacing="compact" isDisabled />
                    <IconButton icon={ChevronRight} label="Próximo mês (sem dados no protótipo)" spacing="compact" isDisabled />
                  </span>
                </div>
              }
              getDay={(d) => {
                const list = byDay.get(d) ?? [];
                const total = list.reduce((s, o) => s + o.quantity, 0);
                const weekend = isWeekend(d);
                const future = d > REFERENCE_DAY;
                const pct = Math.round((total / DAILY_TARGET) * 100);
                const st = total ? statusFor(pct) : null;
                const when = formatLongDate(new Date(2026, 2, d));
                return {
                  caption: total ? formatCompactShort(total) : undefined,
                  percent: total ? pct : undefined,
                  status: st,
                  muted: weekend || future,
                  label: total
                    ? `${when}: ${formatNumber(total)} unidades, ${pct}% da meta diária, ${STATUS_META[st!].label}`
                    : `${when}: ${weekend ? "fim de semana" : future ? "dia futuro" : "sem apontamento"}`,
                };
              }}
            />
          </section>

          {/* ---------- Apontamentos do dia ---------- */}
          <section aria-labelledby="day-title" className="flex min-w-0 flex-col gap-200">
            <div className="flex flex-wrap items-end justify-between gap-200">
              <div className="flex min-w-0 flex-col gap-050">
                <div className="flex items-center gap-100">
                  <IconButton
                    icon={ChevronLeft}
                    label="Dia útil anterior"
                    spacing="compact"
                    isDisabled={prevDay == null}
                    onClick={() => prevDay != null && selectDay(prevDay)}
                  />
                  <IconButton
                    icon={ChevronRight}
                    label="Próximo dia útil"
                    spacing="compact"
                    isDisabled={nextDay == null}
                    onClick={() => nextDay != null && selectDay(nextDay)}
                  />
                  <h2 id="day-title" aria-live="polite" className="font-heading-medium text-default first-letter:uppercase">
                    {formatLongDate(date)}
                  </h2>
                </div>
                {allDayOrders.length > 0 && (
                  <p className="flex flex-wrap items-center gap-100 text-subtle">
                    <span>
                      <span className="font-semibold tabular-nums text-default">{formatNumber(dayTotal)}</span> unidades em {plural(allDayOrders.length)}
                    </span>
                    <Lozenge appearance={STATUS_META[statusFor(dayPct)].appearance}>
                      {dayPct}% da meta diária · {STATUS_META[statusFor(dayPct)].label}
                    </Lozenge>
                  </p>
                )}
              </div>
              {allDayOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-200">
                  {/* Divisão do dia por turno; o turno filtrado fica em destaque */}
                  <span className="flex items-center gap-100">
                    <span className="font-body-small text-subtlest">Por turno</span>
                    <StackedBar values={byShift} label={`Produção de ${formatLongDate(date)} por turno`} highlight={shiftFilter === "all" ? null : shiftFilter} />
                  </span>
                  <SegmentedControl
                    label="Filtrar apontamentos por turno"
                    iconOnly={false}
                    value={String(shiftFilter)}
                    onChange={(v) => {
                      setShiftFilter(v === "all" ? "all" : (Number(v) as Shift));
                      setSelected(new Set());
                    }}
                    options={[{ value: "all", label: "Todos" }, ...SHIFTS.map((sh) => ({ value: String(sh), label: SHIFT_META[sh].label }))]}
                  />
                </div>
              )}
            </div>

            {/* Barra de ações em lote */}
            {selected.size > 0 && (
              <div role="toolbar" aria-label="Ações em lote" className="flex flex-wrap items-center gap-100 rounded-large bg-selected px-150 py-100">
                <span className="font-medium text-selected">{selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}</span>
                <span className="mx-050 h-200 border-l border-selected" aria-hidden />
                <Menu>
                  <MenuTrigger asChild>
                    <Button appearance="subtle" spacing="compact" iconBefore={Repeat}>
                      Alterar turno
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuLabel>Mover para o turno</MenuLabel>
                    <MenuRadioGroup value="" onValueChange={(v) => changeShift(ids, Number(v) as Shift)}>
                      {SHIFTS.map((s) => (
                        <MenuRadioItem key={s} value={String(s)}>
                          {SHIFT_META[s].label} · {SHIFT_META[s].hours}
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                  </MenuContent>
                </Menu>
                <Button appearance="subtle" spacing="compact" iconBefore={CalendarPlus} onClick={() => setDialog({ kind: "move", ids, day: "" })}>
                  Mover para outra data
                </Button>
                <Button appearance="subtle" spacing="compact" iconBefore={Trash2} onClick={() => setDialog({ kind: "delete", ids })}>
                  Excluir
                </Button>
                <IconButton icon={X} label="Cancelar seleção" spacing="compact" className="ml-auto" onClick={() => setSelected(new Set())} />
              </div>
            )}

            <DataTable
              caption={`Apontamentos de ${formatLongDate(date)}`}
              columns={columns}
              rows={dayOrders}
              getRowId={(o) => o.id}
              getRowLabel={(o) => `${o.opId}, ${machineById(o.machineId).name}, ${SHIFT_META[o.shift].label}, ${formatNumber(o.quantity)} unidades`}
              state={dayOrders.length ? "ready" : "empty"}
              selectedIds={selected}
              onSelectionChange={setSelected}
              footerLead={shiftFilter === "all" ? plural(dayOrders.length) : `${plural(dayOrders.length)} no ${SHIFT_META[shiftFilter].label.toLowerCase()}`}
              emptyState={
                <EmptyState
                  icon={ClipboardList}
                  title={
                    isWeekend(day)
                      ? "Fim de semana"
                      : day > REFERENCE_DAY
                        ? "Dia ainda não chegou"
                        : allDayOrders.length && shiftFilter !== "all"
                          ? `Nenhum apontamento no ${SHIFT_META[shiftFilter].label.toLowerCase()}`
                          : "Nenhum apontamento neste dia"
                  }
                  hint={
                    isWeekend(day) || day > REFERENCE_DAY
                      ? "Escolha um dia útil até 27 de março para ver os apontamentos."
                      : allDayOrders.length && shiftFilter !== "all"
                        ? "Escolha outro turno ou Todos para ver os demais apontamentos do dia."
                        : "Nenhuma máquina registrou produção neste dia."
                  }
                  action={
                    !isWeekend(day) && day <= REFERENCE_DAY
                      ? { label: "Fazer apontamento", onClick: () => (window.location.hash = "/apontamento") }
                      : undefined
                  }
                />
              }
            />
          </section>
        </div>
      </PageBody>

      {/* ---------- Diálogos ---------- */}
      <Modal
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Excluir ${dialog?.kind === "delete" ? plural(dialog.ids.length) : ""}?`}
        primary={{ label: "Excluir", appearance: "danger", onClick: () => dialog?.kind === "delete" && remove(dialog.ids) }}
      >
        A produção deixa de contar nos indicadores de {formatLongDate(date)}. Você pode desfazer logo depois pela notificação.
      </Modal>

      <Modal
        open={dialog?.kind === "move"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mover para outra data"
        primary={{
          label: "Mover",
          onClick: () => dialog?.kind === "move" && !moveError && moveTo(dialog.ids, dialog.day),
        }}
      >
        <p className="mb-200 text-subtle">
          {dialog?.kind === "move" && plural(dialog.ids.length)} de {formatLongDate(date)}. O turno e as quantidades não mudam.
        </p>
        <DateField
          label="Nova data"
          min="2026-03-01"
          max="2026-03-27"
          today="2026-03-27"
          isRequired
          value={dialog?.kind === "move" ? dialog.day : ""}
          onChange={(day) => dialog?.kind === "move" && setDialog({ ...dialog, day })}
          error={dialog?.kind === "move" && dialog.day ? moveError : null}
        />
      </Modal>

      <Modal
        open={dialog?.kind === "edit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "edit" ? `Editar ${dialog.order.opId}` : ""}
        primary={{ label: "Salvar", onClick: () => !editError && saveEdit() }}
      >
        {dialog?.kind === "edit" && (
          <div className="flex flex-col gap-200">
            <p className="text-subtle">
              {machineById(dialog.order.machineId).name} · {formatLongDate(dialog.order.date)}
            </p>
            <TextField
              label="Quantidade"
              inputMode="numeric"
              value={dialog.draft.qty}
              onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, qty: e.target.value.replace(/[^\d]/g, "") } })}
              error={editError}
              elemAfter="un."
              inputClassName="tabular-nums"
              isRequired
            />
            <div className="flex flex-col gap-050">
              <span className="font-body-small font-semibold text-subtle">Turno</span>
              <SegmentedControl
                label="Turno"
                iconOnly={false}
                value={String(dialog.draft.shift)}
                onChange={(v) => setDialog({ ...dialog, draft: { ...dialog.draft, shift: Number(v) as Shift } })}
                options={SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label }))}
              />
            </div>
            <label className="flex items-center gap-075 text-default">
              <Checkbox
                label="Retrabalho"
                checked={dialog.draft.rework}
                onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, rework: e.target.checked } })}
              />
              <span aria-hidden>OP de retrabalho</span>
            </label>
            <TextArea
              label="Observação"
              maxLength={500}
              value={dialog.draft.note}
              onChange={(e) => setDialog({ ...dialog, draft: { ...dialog.draft, note: e.target.value } })}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
