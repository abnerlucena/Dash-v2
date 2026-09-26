import { MessageSquare, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LINE_ACCENT, LINES, MACHINES, machineById, type WorkOrder } from "@/data/machines";
import { cn, formatNumber, plural, type Notify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { FilterPill } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { TextField } from "@/components/ui/TextField";
import { Tooltip } from "@/components/ui/Tooltip";
import { useOpActions } from "./OpActions";
import { formatWhen, lastActivity, opNumber, stageView, useOps } from "./OpsStore";

type StageFilter = "all" | "open" | "waiting" | "running" | "ready" | "paused" | "done";

const STAGE_OPTIONS: Array<{ value: StageFilter; label: string }> = [
  { value: "open", label: "Abertas" },
  { value: "waiting", label: "Aguardando liberação" },
  { value: "running", label: "Em produção" },
  { value: "ready", label: "Prontas para concluir" },
  { value: "paused", label: "Pausadas" },
  { value: "done", label: "Concluídas" },
  { value: "all", label: "Todas" },
];

const openChat = (op: WorkOrder) => (window.location.hash = `/feedbacks/${opNumber(op.id)}`);

/** Barra de progresso da OP: apontado sobre a quantidade pedida */
export function OpProgress({ op, className }: { op: WorkOrder; className?: string }) {
  const pct = Math.min(100, Math.round((op.produced / op.planned) * 100));
  return (
    <span className={cn("flex min-w-0 flex-col gap-050", className)}>
      <span className="whitespace-nowrap font-body-small tabular-nums text-subtle">
        <span className="font-semibold text-default">{formatNumber(op.produced)}</span> de {formatNumber(op.planned)}
      </span>
      <span
        role="progressbar"
        aria-label={`${op.id}: ${pct}% da quantidade`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="flex h-050 overflow-hidden rounded-full bg-neutral"
      >
        <span className={cn("h-full rounded-full", op.stage === "done" ? "bg-success-bold" : "bg-brand-bold")} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

/**
 * OPs: toda ordem que entra no sistema, da liberação à conclusão.
 * O panorama responde "o que está aberto, parado ou esperando ir para a
 * produção"; cada OP abre a sua conversa na aba Feedbacks.
 */
export function OpsPage({ notify }: { notify: Notify }) {
  const { ops, unreadIn, create } = useOps();
  const { actionsFor, dialogs } = useOpActions(notify);
  const [stage, setStage] = useState<StageFilter>("open");
  const [line, setLine] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ number: "", machineId: MACHINES[0].id, material: "", product: "", planned: "" });
  const [tried, setTried] = useState(false);

  const count = (fn: (op: WorkOrder) => boolean) => ops.filter(fn).length;
  const kpis: KpiItem[] = [
    { id: "waiting", label: "Aguardando liberação", value: count((o) => o.stage === "waiting"), footer: "Cadastradas, ainda não foram para a máquina" },
    { id: "running", label: "Em produção", value: count((o) => stageView(o).key === "running"), footer: "Recebendo apontamentos" },
    {
      id: "ready",
      label: "Prontas para concluir",
      value: count((o) => stageView(o).key === "ready"),
      aside: <Lozenge appearance="discovery">Confirmar</Lozenge>,
      footer: "Atingiram a quantidade pedida",
    },
    { id: "paused", label: "Pausadas", value: count((o) => o.stage === "paused"), footer: "Paradas com motivo registrado" },
    { id: "done", label: "Concluídas no mês", value: count((o) => o.stage === "done"), footer: "Conversa encerrada" },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ops
      .filter((op) => {
        const key = stageView(op).key;
        const byStage = stage === "all" || (stage === "open" ? op.stage !== "done" : key === stage);
        const m = machineById(op.machineId);
        return (
          byStage &&
          (line === "all" || m.line === line) &&
          (!q || op.id.toLowerCase().includes(q) || op.material.includes(q) || op.product.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => lastActivity(b).getTime() - lastActivity(a).getTime());
  }, [ops, stage, line, query]);

  const columns: Column<WorkOrder>[] = [
    { id: "op", header: "OP", cell: (op) => <span className="font-code text-default">{opNumber(op.id)}</span> },
    {
      id: "product",
      header: "Material e máquina",
      cell: (op) => {
        const m = machineById(op.machineId);
        return (
          <span className="flex min-w-0 flex-col">
            <span className="flex items-baseline gap-100 truncate">
              <span className="font-code text-subtle">{op.material}</span>
              <span className="truncate font-medium text-default">{op.product}</span>
            </span>
            <span className="flex items-center gap-075 truncate font-body-small text-subtle">
              <Tag accent={LINE_ACCENT[m.line]}>{m.line}</Tag>
              <span className="truncate">{m.name}</span>
            </span>
          </span>
        );
      },
    },
    {
      id: "stage",
      header: "Etapa",
      cell: (op) => {
        const view = stageView(op);
        const lozenge = <Lozenge appearance={view.appearance}>{view.label}</Lozenge>;
        return op.stage === "paused" && op.pauseReason ? (
          <Tooltip content={op.pauseReason}>
            <span tabIndex={0} aria-label={`${view.label}: ${op.pauseReason}`}>
              {lozenge}
            </span>
          </Tooltip>
        ) : (
          lozenge
        );
      },
    },
    { id: "progress", header: "Quantidade", className: "w-1000", cell: (op) => <OpProgress op={op} /> },
    {
      id: "activity",
      header: "Última atividade",
      cell: (op) => <span className="whitespace-nowrap font-body-small text-subtle">{formatWhen(lastActivity(op))}</span>,
    },
    {
      id: "chat",
      header: "Conversa",
      cell: (op) => {
        const unread = unreadIn(op);
        const talk = op.messages.filter((m) => m.role !== "system").length;
        return (
          <a
            href={`#/feedbacks/${opNumber(op.id)}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Abrir conversa da ${op.id}: ${plural(talk, "mensagem", "mensagens")}${unread ? `, ${unread} não lidas` : ""}`}
            className="ds-pressable inline-flex items-center gap-075 rounded-medium px-075 py-050 text-subtle hover:bg-neutral-subtle-hovered"
          >
            <MessageSquare aria-hidden className="size-icon-small" />
            <span className="tabular-nums">{talk}</span>
            {unread > 0 && <Lozenge appearance="information" isBold>{`${unread} nova${unread > 1 ? "s" : ""}`}</Lozenge>}
          </a>
        );
      },
    },
    {
      id: "actions",
      header: "Ações",
      srHeader: "Ações",
      align: "end",
      cell: (op) => (
        <Menu>
          <MenuTrigger asChild>
            <IconButton icon={MoreHorizontal} label={`Ações para ${op.id}`} spacing="compact" showTooltip={false} onClick={(e) => e.stopPropagation()} />
          </MenuTrigger>
          <MenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={MessageSquare} onSelect={() => openChat(op)}>
              Abrir conversa
            </MenuItem>
            {actionsFor(op).length > 0 && <MenuSeparator />}
            {actionsFor(op).map((a) => (
              <MenuItem key={a.id} icon={a.icon} onSelect={a.run}>
                {a.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ),
    },
  ];

  const number = draft.number.trim();
  const planned = Number(draft.planned);
  const errors = {
    number: !/^\d{7}$/.test(number) ? "Use os 7 dígitos da OP" : ops.some((o) => o.id === `OP ${number}`) ? "Essa OP já está no sistema" : null,
    material: /^d{8}$/.test(draft.material) ? null : "Use os 8 dígitos do material",
    product: draft.product.trim() ? null : "Informe a descrição do material",
    planned: Number.isInteger(planned) && planned > 0 ? null : "Informe a quantidade pedida",
  };
  const valid = !errors.number && !errors.material && !errors.product && !errors.planned;

  return (
    <>
      <PageHeader
        title="OPs"
        description="Ordens de produção que entraram no sistema, da liberação à conclusão. Cada OP tem uma conversa em Feedbacks, que se encerra quando ela é concluída."
        actions={
          <Button
            appearance="primary"
            iconBefore={Plus}
            onClick={() => {
              setDraft({ number: "", machineId: MACHINES[0].id, material: "", product: "", planned: "" });
              setTried(false);
              setCreating(true);
            }}
          >
            Nova OP
          </Button>
        }
      />
      <PageBody>
        <KpiStrip items={kpis} label="OPs por etapa" />

        <div className="flex flex-wrap items-center gap-100">
          <FilterPill label="Etapa" value={stage} defaultValue="open" options={STAGE_OPTIONS} onChange={(v) => setStage(v as StageFilter)} />
          <FilterPill
            label="Linha"
            value={line}
            defaultValue="all"
            options={[{ value: "all", label: "Todas" }, ...LINES.map((l) => ({ value: l, label: l }))]}
            onChange={setLine}
          />
          <TextField
            label="Buscar OP"
            hideLabel
            placeholder="OP, material ou máquina"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            elemAfter={<Search aria-hidden className="size-icon-small" />}
            className="w-full s:w-column-name"
          />
          <p aria-live="polite" className="ml-auto font-body-small text-subtlest">
            {plural(rows.length, "OP", "OPs")}
          </p>
        </div>

        <DataTable
          caption="Ordens de produção"
          columns={columns}
          rows={rows}
          getRowId={(op) => op.id}
          getRowLabel={(op) => `${op.id}, material ${op.material} ${op.product}, ${stageView(op).label}`}
          selectable={false}
          onRowActivate={openChat}
          emptyState={
            <EmptyState
              icon={Search}
              title="Nenhuma OP neste recorte"
              hint="Troque a etapa ou a linha, ou limpe a busca."
              action={{
                label: "Ver todas",
                onClick: () => {
                  setStage("all");
                  setLine("all");
                  setQuery("");
                },
              }}
            />
          }
          state={rows.length ? "ready" : "empty"}
        />
      </PageBody>

      {dialogs}

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="Nova OP"
        primary={{
          label: "Cadastrar OP",
          onClick: () => {
            setTried(true);
            if (!valid) return;
            const id = create({ number, machineId: draft.machineId, material: draft.material, product: draft.product.trim(), planned });
            setCreating(false);
            setStage("waiting");
            notify(`${id} cadastrada`, "Ela aguarda liberação para a produção.", "success", {
              label: "Abrir conversa",
              onClick: () => (window.location.hash = `/feedbacks/${number}`),
            });
          },
        }}
      >
        <div className="flex flex-col gap-200">
          <p className="text-subtle">
            A OP entra como <strong className="text-default">Aguardando liberação</strong>. Quando for para a máquina, libere-a
            aqui ou na conversa.
          </p>
          <TextField
            label="Número da OP"
            isRequired
            inputMode="numeric"
            placeholder="Ex.: 4519876"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            error={tried ? errors.number : null}
            className="w-column-name"
          />
          <div className="flex flex-col gap-050">
            <label htmlFor="new-op-machine" className="font-body-small font-semibold text-subtle">
              Máquina <span aria-hidden className="text-danger">*</span>
            </label>
            <select
              id="new-op-machine"
              value={draft.machineId}
              onChange={(e) => setDraft({ ...draft, machineId: e.target.value })}
              className="h-control rounded-medium border border-input bg-input px-100 text-default hover:bg-input-hovered focus:border-focused"
            >
              {LINES.map((l) => (
                <optgroup key={l} label={l}>
                  {MACHINES.filter((m) => m.line === l).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {/* O material anda junto com a OP: código + descrição */}
          <div className="flex flex-wrap items-start gap-200">
            <TextField
              label="Material"
              isRequired
              inputMode="numeric"
              placeholder="Ex.: 12345678"
              value={draft.material}
              onChange={(e) => setDraft({ ...draft, material: e.target.value.replace(/D/g, "").slice(0, 8) })}
              error={tried ? errors.material : null}
              inputClassName="font-code"
              className="w-column-name"
            />
            <TextField
              label="Descrição do material"
              isRequired
              placeholder="Ex.: Tomada 10A"
              value={draft.product}
              onChange={(e) => setDraft({ ...draft, product: e.target.value })}
              error={tried ? errors.product : null}
              className="min-w-column-name flex-1"
            />
          </div>
          <TextField
            label="Quantidade pedida"
            isRequired
            inputMode="numeric"
            value={draft.planned}
            onChange={(e) => setDraft({ ...draft, planned: e.target.value.replace(/\D/g, "") })}
            elemAfter="peças"
            error={tried ? errors.planned : null}
            className="w-column-name"
          />
        </div>
      </Modal>
    </>
  );
}
