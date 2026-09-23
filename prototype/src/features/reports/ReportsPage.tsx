import { ClipboardList, Download, FileSpreadsheet, FileText, RotateCcw, Target, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ALL_ORDERS,
  MACHINES,
  SHIFTS,
  SHIFT_META,
  machineById,
  type ProductionOrder,
} from "@/data/machines";
import { cn, formatNumber, readToken, type Notify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/data/DataTable";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Lozenge } from "@/components/ui/Lozenge";
import { WegMark } from "@/components/ui/Misc";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";

type ReportType = "production" | "entries" | "rework" | "metas";
const TYPES: Record<ReportType, { title: string; description: string; icon: LucideIcon }> = {
  production: { title: "Produção mensal", description: "Indicadores e resumo por máquina", icon: FileText },
  entries: { title: "Apontamentos detalhados", description: "Todas as OPs, com operador e observação", icon: ClipboardList },
  rework: { title: "Retrabalho", description: "Taxas por máquina e motivos", icon: RotateCcw },
  metas: { title: "Metas e atingimento", description: "Meta por turno, dia e mês contra o realizado", icon: Target },
};
const SECTIONS = ["Indicadores", "Gráficos", "Tabela por máquina", "Observações dos operadores"] as const;

interface Generated {
  id: string;
  name: string;
  period: string;
  format: "PDF" | "CSV";
  createdAt: Date;
  size: string;
}
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const br = (iso: string) => iso.split("-").reverse().join("/");

/** Gera um CSV real (separador ";" e BOM, como o Excel em pt-BR espera) */
function downloadCsv(orders: ProductionOrder[], filename: string) {
  const header = ["Data", "Máquina", "Turno", "OP", "Produto", "Quantidade", "Retrabalho", "Motivo", "Operador", "Observação"];
  const rows = orders.map((o) => [
    o.date.toLocaleDateString("pt-BR"),
    machineById(o.machineId).name,
    SHIFT_META[o.shift].label,
    o.id.replace("OP ", ""),
    o.product,
    String(o.quantity),
    o.rework ? "Sim" : "Não",
    o.reworkReason ?? "",
    o.operator,
    o.note?.text ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage({ notify }: { notify: Notify }) {
  const [type, setType] = useState<ReportType>("production");
  const [from, setFrom] = useState("2026-03-01");
  const [to, setTo] = useState("2026-03-27");
  const [machines, setMachines] = useState<Set<string>>(new Set(MACHINES.map((m) => m.id)));
  const [shifts, setShifts] = useState<Set<number>>(new Set(SHIFTS));
  const [format, setFormat] = useState<"PDF" | "CSV">("PDF");
  const [sections, setSections] = useState<Set<string>>(new Set(SECTIONS.slice(0, 3)));
  const [generating, setGenerating] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [generated, setGenerated] = useState<Generated[]>([
    { id: "g2", name: "Produção mensal · fevereiro", period: "01/02/2026 a 27/02/2026", format: "PDF", createdAt: new Date(2026, 2, 2, 8, 30), size: "412 KB" },
    { id: "g1", name: "Apontamentos detalhados · fevereiro", period: "01/02/2026 a 27/02/2026", format: "CSV", createdAt: new Date(2026, 2, 2, 8, 31), size: "38 KB" },
  ]);

  const periodError = from > to ? "A data inicial precisa ser antes da final" : null;
  const machinesError = machines.size === 0 ? "Escolha pelo menos uma máquina" : null;
  const shiftsError = shifts.size === 0 ? "Escolha pelo menos um turno" : null;
  const hasErrors = !!(periodError || machinesError || shiftsError);

  const orders = useMemo(
    () =>
      ALL_ORDERS.filter((o) => {
        const iso = `2026-03-${String(o.date.getDate()).padStart(2, "0")}`;
        return iso >= from && iso <= to && machines.has(o.machineId) && shifts.has(o.shift);
      }),
    [from, to, machines, shifts],
  );
  const produced = orders.reduce((s, o) => s + o.quantity, 0);
  const reworkQty = orders.filter((o) => o.rework).reduce((s, o) => s + o.quantity, 0);
  const chosen = MACHINES.filter((m) => machines.has(m.id));
  const target = chosen.reduce((s, m) => s + m.target, 0) * (shifts.size / 3);
  const name = `${TYPES[type].title} · ${br(from)} a ${br(to)}`;

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const generate = () => {
    if (hasErrors) {
      setShowErrors(true);
      notify("Revise as opções do relatório", "Há campos que precisam de ajuste.", "error");
      return;
    }
    setGenerating(true);
    window.setTimeout(() => {
      setGenerating(false);
      const filename = `dash-producao-${type}-${from}-a-${to}.${format === "PDF" ? "pdf" : "csv"}`;
      const kb = format === "CSV" ? Math.max(1, Math.round((orders.length * 120) / 1024)) : 180 + sections.size * 60;
      setGenerated((g) => [
        { id: `g${Date.now()}`, name, period: `${br(from)} a ${br(to)}`, format, createdAt: new Date(), size: `${kb} KB` },
        ...g,
      ]);
      if (format === "CSV") {
        downloadCsv(orders, filename);
        notify("Planilha baixada", `${filename} · ${orders.length} OPs`);
      } else {
        notify("Relatório pronto", `${filename} (PDF simulado no protótipo)`);
      }
    }, readToken("--ds-motion-duration-skeleton") / 2);
  };

  const columns: Column<Generated>[] = [
    { id: "name", header: "Relatório", className: "min-w-column-name", cell: (g) => <span className="font-medium text-default">{g.name}</span> },
    { id: "period", header: "Período", cell: (g) => <span className="tabular-nums text-subtle">{g.period}</span> },
    { id: "format", header: "Formato", cell: (g) => <Lozenge appearance={g.format === "PDF" ? "information" : "success"}>{g.format}</Lozenge> },
    { id: "created", header: "Gerado em", cell: (g) => <span className="tabular-nums text-subtle">{dateTime.format(g.createdAt)}</span> },
    { id: "size", header: "Tamanho", align: "end", cell: (g) => <span className="tabular-nums text-subtle">{g.size}</span> },
    {
      id: "action",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "pr-150",
      cell: (g) => (
        <Button
          appearance="subtle"
          spacing="compact"
          iconBefore={Download}
          onClick={() =>
            g.format === "CSV"
              ? downloadCsv(ALL_ORDERS, `${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`)
              : notify("Download simulado", `${g.name} (PDF)`)
          }
        >
          Baixar
        </Button>
      ),
    },
  ];

  const allMachines = machines.size === MACHINES.length;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Monte um relatório com o período, as máquinas e os turnos que precisar. A pré-visualização acompanha as escolhas."
        actions={
          <Button appearance="primary" iconBefore={format === "PDF" ? FileText : FileSpreadsheet} isLoading={generating} onClick={generate}>
            {format === "PDF" ? "Gerar PDF" : "Baixar planilha"}
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-start gap-300">
          {/* ---------- Opções ---------- */}
          <form
            aria-label="Opções do relatório"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
            className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-300"
          >
            <fieldset className="flex flex-col gap-100">
              <legend className="pb-100 font-heading-small text-default">Tipo de relatório</legend>
              <div role="radiogroup" aria-label="Tipo de relatório" className="grid grid-cols-1 gap-100 xs:grid-cols-2">
                {(Object.keys(TYPES) as ReportType[]).map((k) => {
                  const t = TYPES[k];
                  const selected = type === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(k)}
                      className={cn(
                        "ds-pressable flex items-start gap-150 rounded-large border p-200 text-left",
                        selected ? "border-selected bg-selected" : "hover:bg-neutral-subtle-hovered",
                      )}
                    >
                      <t.icon aria-hidden className={cn("mt-025 size-icon-small shrink-0", selected ? "text-icon-selected" : "text-icon-subtle")} />
                      <span>
                        <span className={cn("block font-heading-xsmall", selected ? "text-selected" : "text-default")}>{t.title}</span>
                        <span className="mt-025 block font-body-small text-subtle">{t.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-wrap gap-200">
              <legend className="pb-100 font-heading-small text-default">Período</legend>
              <TextField label="De" type="date" min="2026-03-01" max="2026-03-27" value={from} onChange={(e) => setFrom(e.target.value)} className="w-column-name" />
              <TextField
                label="Até"
                type="date"
                min="2026-03-01"
                max="2026-03-27"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                error={periodError}
                className="w-column-name"
              />
            </fieldset>

            <fieldset className="flex flex-col gap-100">
              <legend className="pb-100 font-heading-small text-default">Máquinas</legend>
              <label className="flex items-center gap-100 font-medium text-default">
                <Checkbox
                  label="Todas as máquinas"
                  checked={allMachines}
                  isIndeterminate={!allMachines && machines.size > 0}
                  onChange={() => setMachines(allMachines ? new Set() : new Set(MACHINES.map((m) => m.id)))}
                />
                <span aria-hidden>Todas as máquinas</span>
              </label>
              <div className="grid grid-cols-1 gap-x-300 gap-y-100 pl-300 xs:grid-cols-2">
                {MACHINES.map((m) => (
                  <label key={m.id} className="flex items-center gap-100 text-default">
                    <Checkbox label={m.name} checked={machines.has(m.id)} onChange={() => setMachines((s) => toggle(s, m.id))} />
                    <span aria-hidden className="truncate">
                      {m.name}
                    </span>
                  </label>
                ))}
              </div>
              {showErrors && machinesError && <p className="font-body-small text-danger">{machinesError}</p>}
            </fieldset>

            <fieldset className="flex flex-col gap-100">
              <legend className="pb-100 font-heading-small text-default">Turnos</legend>
              <div className="flex flex-wrap gap-300">
                {SHIFTS.map((s) => (
                  <label key={s} className="flex items-center gap-100 text-default">
                    <Checkbox label={SHIFT_META[s].label} checked={shifts.has(s)} onChange={() => setShifts((set) => toggle(set, s))} />
                    <span aria-hidden>
                      {SHIFT_META[s].label} <span className="text-subtlest">· {SHIFT_META[s].hours}</span>
                    </span>
                  </label>
                ))}
              </div>
              {showErrors && shiftsError && <p className="font-body-small text-danger">{shiftsError}</p>}
            </fieldset>

            <fieldset className="flex flex-col gap-150">
              <legend className="pb-100 font-heading-small text-default">Formato</legend>
              <SegmentedControl
                label="Formato"
                iconOnly={false}
                value={format}
                onChange={(v) => setFormat(v as "PDF" | "CSV")}
                options={[
                  { value: "PDF", label: "PDF para imprimir", icon: FileText },
                  { value: "CSV", label: "Planilha (CSV)", icon: FileSpreadsheet },
                ]}
              />
              {format === "PDF" ? (
                <div className="flex flex-col gap-100">
                  <span className="font-body-small font-semibold text-subtle">Seções incluídas</span>
                  <div className="flex flex-wrap gap-x-300 gap-y-100">
                    {SECTIONS.map((sec) => (
                      <label key={sec} className="flex items-center gap-100 text-default">
                        <Checkbox label={sec} checked={sections.has(sec)} onChange={() => setSections((s) => toggle(s, sec))} />
                        <span aria-hidden>{sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-body-small text-subtlest">
                  A planilha traz uma linha por OP, com separador “;” para abrir direto no Excel.
                </p>
              )}
            </fieldset>
          </form>

          {/* ---------- Pré-visualização ---------- */}
          <section aria-labelledby="preview-title" className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-150">
            <h2 id="preview-title" className="font-heading-small text-default">
              Pré-visualização
            </h2>
            <div className="rounded-xlarge bg-surface-sunken p-300">
              <article className="mx-auto flex max-w-search-width flex-col gap-200 rounded-small bg-surface-raised p-300 shadow-raised">
                <header className="flex items-start justify-between gap-150 border-b pb-150">
                  <div>
                    <p className="font-heading-small text-default">{TYPES[type].title}</p>
                    <p className="mt-025 font-body-small text-subtle">
                      {br(from)} a {br(to)} · Fábrica Jaraguá do Sul
                    </p>
                  </div>
                  <WegMark className="w-500 text-brand" />
                </header>
                <p className="font-body-small text-subtle">
                  {allMachines ? "Todas as máquinas" : `${machines.size} de ${MACHINES.length} máquinas`} ·{" "}
                  {shifts.size === 3 ? "todos os turnos" : [...shifts].sort().map((s) => `Turno ${s}`).join(", ")} · {orders.length} OPs
                </p>
                {format === "PDF" ? (
                  <>
                    {sections.has("Indicadores") && (
                      <dl className="grid grid-cols-3 gap-100">
                        {[
                          ["Produção", formatNumber(produced)],
                          ["Atingimento", target ? `${Math.round((produced / target) * 100)}%` : "—"],
                          ["Retrabalho", produced ? `${Math.round((reworkQty / produced) * 100)}%` : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-medium bg-neutral p-100">
                            <dt className="font-body-small text-subtle">{k}</dt>
                            <dd className="font-metric-small text-default">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {sections.has("Gráficos") && (
                      <div aria-hidden className="flex h-800 items-end gap-050 rounded-medium bg-neutral p-100">
                        {[40, 65, 55, 80, 50, 70, 45, 90, 60, 75].map((h, i) => (
                          <span key={i} className="flex-1 rounded-t-xsmall bg-chart-brand opacity-disabled" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    )}
                    {sections.has("Tabela por máquina") && (
                      <table className="w-full font-body-small">
                        <tbody>
                          {chosen.slice(0, 4).map((m) => (
                            <tr key={m.id} className="border-t">
                              <td className="py-050 text-default">{m.name}</td>
                              <td className="py-050 text-right tabular-nums text-subtle">
                                {formatNumber(orders.filter((o) => o.machineId === m.id).reduce((s, o) => s + o.quantity, 0))}
                              </td>
                            </tr>
                          ))}
                          {chosen.length > 4 && (
                            <tr className="border-t">
                              <td colSpan={2} className="py-050 text-subtlest">
                                e mais {chosen.length - 4}…
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                    {sections.has("Observações dos operadores") && (
                      <p className="rounded-medium bg-neutral p-100 font-body-small text-subtle">
                        {orders.filter((o) => o.note).length} observações registradas no período
                      </p>
                    )}
                    {sections.size === 0 && <p className="font-body-small text-subtlest">Nenhuma seção selecionada.</p>}
                  </>
                ) : (
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full font-code">
                      <thead>
                        <tr className="text-left text-subtlest">
                          {["Data", "Máquina", "OP", "Qtd."].map((h) => (
                            <th key={h} className="pb-050 pr-150 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map((o) => (
                          <tr key={o.id} className="border-t text-default">
                            <td className="py-050 pr-150">{o.date.toLocaleDateString("pt-BR").slice(0, 5)}</td>
                            <td className="max-w-1000 truncate py-050 pr-150">{machineById(o.machineId).name}</td>
                            <td className="py-050 pr-150">{o.id.replace("OP ", "")}</td>
                            <td className="py-050 text-right">{o.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-100 font-body-small text-subtlest">
                      Mostrando 5 de {orders.length} linhas
                    </p>
                  </div>
                )}
              </article>
            </div>
          </section>
        </div>

        <section aria-labelledby="generated" className="flex flex-col gap-150">
          <h2 id="generated" className="font-heading-small text-default">
            Relatórios gerados
          </h2>
          <DataTable
            caption="Relatórios gerados"
            columns={columns}
            rows={generated}
            getRowId={(g) => g.id}
            getRowLabel={(g) => g.name}
            selectable={false}
            footerLead={`${generated.length} relatórios`}
          />
        </section>
      </PageBody>
    </>
  );
}
