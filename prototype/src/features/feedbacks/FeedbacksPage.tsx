import { CheckCheck, Circle, CircleCheck, History, MoreHorizontal, Pencil, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  FEEDBACKS,
  MACHINES,
  SHIFTS,
  SHIFT_META,
  machineById,
  type Accent,
  type ProductionOrder,
  type Shift,
} from "@/data/machines";
import { cn, formatLongDate, type Notify } from "@/lib/utils";
import { SHIFT_FILL } from "@/components/data/StackedBar";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { FilterPill } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Avatar } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextArea } from "@/components/ui/TextField";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const AVATAR_BY_SHIFT: Record<Shift, Accent> = { 1: "blue", 2: "teal", 3: "magenta" };

interface FeedbacksPageProps {
  unread: Set<string>;
  onReadChange: (ids: string[], read: boolean) => void;
  notify: Notify;
}

/**
 * Feedbacks = observações que os operadores deixam no apontamento.
 * Não lidos ficam marcados com ponto e "Novo"; o contador do menu acompanha.
 */
export function FeedbacksPage({ unread, onReadChange, notify }: FeedbacksPageProps) {
  const [items, setItems] = useState<ProductionOrder[]>(FEEDBACKS);
  const [view, setView] = useState<"all" | "unread">("all");
  const [machine, setMachine] = useState("all");
  const [shift, setShift] = useState("all");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [deleting, setDeleting] = useState<ProductionOrder | null>(null);

  const visible = items.filter(
    (o) =>
      (view === "all" || unread.has(o.note!.id)) &&
      (machine === "all" || o.machineId === machine) &&
      (shift === "all" || String(o.shift) === shift),
  );
  const groups = new Map<number, ProductionOrder[]>();
  for (const o of visible) groups.set(o.date.getDate(), [...(groups.get(o.date.getDate()) ?? []), o]);
  const unreadCount = items.filter((o) => unread.has(o.note!.id)).length;
  const filtersActive = machine !== "all" || shift !== "all";

  const saveEdit = () => {
    if (!editing || !editing.text.trim()) return;
    setItems((list) => list.map((o) => (o.note!.id === editing.id ? { ...o, note: { ...o.note!, text: editing.text.trim() } } : o)));
    setEditing(null);
    notify("Feedback atualizado");
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const previous = items;
    const target = deleting;
    setItems((list) => list.filter((o) => o !== target));
    onReadChange([target.note!.id], true);
    setDeleting(null);
    notify("Feedback excluído", `${machineById(target.machineId).name} · ${formatLongDate(target.date)}`, "success", {
      label: "Desfazer",
      onClick: () => setItems(previous),
    });
  };

  return (
    <>
      <PageHeader
        title="Feedbacks"
        lozenge={unreadCount > 0 ? <Lozenge appearance="discovery">{unreadCount} novos</Lozenge> : <Lozenge>Tudo lido</Lozenge>}
        description="Observações que os operadores registram no apontamento: paradas, falta de material, ajustes."
        actions={
          <Button
            appearance="subtle"
            iconBefore={CheckCheck}
            isDisabled={unreadCount === 0}
            onClick={() => {
              const ids = items.filter((o) => unread.has(o.note!.id)).map((o) => o.note!.id);
              onReadChange(ids, true);
              notify(`${ids.length} feedbacks marcados como lidos`, undefined, "success", {
                label: "Desfazer",
                onClick: () => onReadChange(ids, false),
              });
            }}
          >
            Marcar todos como lidos
          </Button>
        }
      />
      <PageBody>
        <div role="toolbar" aria-label="Filtros" className="flex flex-wrap items-center gap-100">
          <SegmentedControl
            label="Mostrar"
            iconOnly={false}
            value={view}
            onChange={(v) => setView(v as "all" | "unread")}
            options={[
              { value: "all", label: `Todos (${items.length})` },
              { value: "unread", label: `Não lidos (${unreadCount})` },
            ]}
          />
          <FilterPill
            label="Máquina"
            value={machine}
            defaultValue="all"
            onChange={setMachine}
            options={[{ value: "all", label: "Todas" }, ...MACHINES.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <FilterPill
            label="Turno"
            value={shift}
            defaultValue="all"
            onChange={setShift}
            options={[{ value: "all", label: "Todos" }, ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label, hint: SHIFT_META[s].hours }))]}
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xlarge border">
            {view === "unread" && !filtersActive ? (
              <EmptyState icon={CircleCheck} title="Tudo em dia" hint="Não há feedbacks novos. Eles aparecem aqui assim que um operador registra uma observação." />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Nenhum feedback encontrado"
                hint="Nada corresponde aos filtros selecionados."
                action={{
                  label: "Limpar filtros",
                  onClick: () => {
                    setMachine("all");
                    setShift("all");
                    setView("all");
                  },
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-300">
            {[...groups.entries()].map(([day, list]) => (
              <section key={day} aria-labelledby={`fb-day-${day}`}>
                <h2 id={`fb-day-${day}`} className="pb-100 font-heading-xsmall text-subtle first-letter:uppercase">
                  {formatLongDate(list[0].date)}
                </h2>
                <ul className="flex flex-col overflow-hidden rounded-xlarge border">
                  {list.map((o) => {
                    const note = o.note!;
                    const isUnread = unread.has(note.id);
                    const isEditing = editing?.id === note.id;
                    return (
                      <li
                        key={note.id}
                        className={cn("flex gap-150 border-t px-200 py-150 first:border-t-0", isUnread && "bg-brand-subtlest")}
                      >
                        <Avatar name={note.author} size="medium" accent={AVATAR_BY_SHIFT[o.shift]} />
                        <article className="min-w-0 flex-1" aria-label={`${isUnread ? "Novo. " : ""}${note.author}, ${machineById(o.machineId).name}`}>
                          <p className="flex flex-wrap items-center gap-x-100 gap-y-025">
                            {isUnread && <span aria-hidden className="size-dot rounded-full bg-icon-brand" />}
                            <span className="font-semibold text-default">{note.author}</span>
                            <span className="flex items-center gap-050 font-body-small text-subtle">
                              <span aria-hidden className={cn("size-status-dot rounded-full", SHIFT_FILL[o.shift])} />
                              {SHIFT_META[o.shift].label}
                            </span>
                            <span className="font-body-small text-subtlest">{time.format(o.recordedAt)}</span>
                            {isUnread && <Lozenge appearance="discovery">Novo</Lozenge>}
                          </p>
                          <p className="mt-025 font-body-small text-subtle">
                            {machineById(o.machineId).name} · <span className="font-code">{o.id}</span>
                            {o.rework && (
                              <>
                                {" "}
                                · <span className="text-warning">retrabalho ({o.reworkReason})</span>
                              </>
                            )}
                          </p>
                          {isEditing ? (
                            <div className="mt-100 flex flex-col gap-100">
                              <TextArea
                                label="Editar feedback"
                                hideLabel
                                autoFocus
                                maxLength={500}
                                value={editing.text}
                                onChange={(e) => setEditing({ id: note.id, text: e.target.value })}
                                error={editing.text.trim() ? null : "O feedback não pode ficar vazio"}
                              />
                              <span className="flex gap-100">
                                <Button appearance="primary" spacing="compact" onClick={saveEdit}>
                                  Salvar
                                </Button>
                                <Button appearance="subtle" spacing="compact" onClick={() => setEditing(null)}>
                                  Cancelar
                                </Button>
                              </span>
                            </div>
                          ) : (
                            <p className={cn("mt-075 text-default", isUnread && "font-medium")}>{note.text}</p>
                          )}
                        </article>
                        <div className="flex shrink-0 items-start gap-050">
                          <IconButton
                            icon={isUnread ? Circle : CircleCheck}
                            label={isUnread ? "Marcar como lido" : "Marcar como não lido"}
                            spacing="compact"
                            onClick={() => onReadChange([note.id], isUnread)}
                          />
                          <Menu>
                            <MenuTrigger asChild>
                              <IconButton icon={MoreHorizontal} label="Mais ações" spacing="compact" showTooltip={false} />
                            </MenuTrigger>
                            <MenuContent align="end">
                              <MenuItem icon={Pencil} onSelect={() => setEditing({ id: note.id, text: note.text })}>
                                Editar
                              </MenuItem>
                              <MenuItem icon={History} onSelect={() => (window.location.hash = "/historico")}>
                                Ver apontamento no histórico
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem icon={Trash2} onSelect={() => setDeleting(o)}>
                                Excluir
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageBody>

      <Modal
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir feedback?"
        primary={{ label: "Excluir", appearance: "danger", onClick: confirmDelete }}
      >
        A observação sai do apontamento {deleting?.id}. A produção registrada não muda.
      </Modal>
    </>
  );
}
