import { useState, useMemo } from "react";
import { Pencil, Trash2, Check, X, Loader, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { pctColor, fmt, dispD, today, api, type ProdRecord } from "@/lib/api";
import { DatePickerInput } from "@/components/DatePickerInput";
import { SelectDropdown } from "@/components/SelectDropdown";

const recordKey = (r: ProdRecord) => `${r.date}-${r.machineId}-${r.turno}`;

const FeedbacksTab = () => {
  const { user, records, machines, silentRefresh } = useAuth();
  const isMobile = useIsMobile();

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return fmt(d);
  });
  const [dateTo, setDateTo] = useState(today);
  const [machineFilter, setMachineFilter] = useState("TODAS");

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Delete confirm state
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // Which key is currently being saved/deleted
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Expanded ordens state
  const [ordensExpanded, setOrdernsExpanded] = useState<Set<string>>(new Set());

  const canEdit = (_r: ProdRecord) => !!user;

  const observations = useMemo(() => {
    return records.filter(r => {
      if (!r.obs || !r.obs.trim()) return false;
      if (r.date < dateFrom || r.date > dateTo) return false;
      if (machineFilter !== "TODAS" && r.machineName !== machineFilter) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, dateFrom, dateTo, machineFilter]);

  function startEdit(r: ProdRecord) {
    setDeletingKey(null);
    setEditingKey(recordKey(r));
    setEditText(r.obs || "");
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditText("");
  }

  async function handleSaveEdit(r: ProdRecord) {
    const key = recordKey(r);
    setSavingKey(key);
    let ok = false;
    try {
      const nowBR = new Date().toLocaleString("pt-BR");
      await api("upsert", {
        records: [{
          date: r.date,
          turno: r.turno,
          machineId: r.machineId,
          machineName: r.machineName,
          meta: r.meta,
          producao: r.producao,
          savedBy: r.savedBy,
          savedAt: r.savedAt || "",
          obs: editText.trim(),
          editUser: user?.nome || "",
          editTime: nowBR,
        }],
      }, user);
      ok = true;
      toast.success("Observação atualizada!");
      setEditingKey(null);
      setEditText("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      // Spinner some assim que o api() retorna — silentRefresh roda em background
      setSavingKey(null);
    }
    if (ok) silentRefresh().catch(() => {});
  }

  async function handleDelete(r: ProdRecord) {
    const key = recordKey(r);
    setSavingKey(key);
    let ok = false;
    try {
      const nowBR = new Date().toLocaleString("pt-BR");
      await api("upsert", {
        records: [{
          date: r.date,
          turno: r.turno,
          machineId: r.machineId,
          machineName: r.machineName,
          meta: r.meta,
          producao: r.producao,
          savedBy: r.savedBy,
          savedAt: r.savedAt || "",
          obs: "",
          editUser: user?.nome || "",
          editTime: nowBR,
        }],
      }, user);
      ok = true;
      toast.success("Observação removida.");
      setDeletingKey(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setSavingKey(null);
    }
    if (ok) silentRefresh().catch(() => {});
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-card rounded-lg border border-border p-4 flex flex-wrap items-end gap-3">
        <DatePickerInput label="De" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
        <DatePickerInput label="Até" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
        <SelectDropdown
          label="Máquina"
          value={machineFilter}
          onChange={setMachineFilter}
          options={[
            { value: "TODAS", label: "TODAS" },
            ...machines.map(m => ({ value: m.name, label: m.name })),
          ]}
        />
        <div className="ml-auto self-end">
          <span className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-muted-foreground tabular-nums">
            {observations.length} {observations.length === 1 ? "observação" : "observações"}
          </span>
        </div>
      </div>

      {/* Cards de observações */}
      {observations.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma observação encontrada no período selecionado.</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {observations.map((r, i) => {
            const pct = r.meta > 0 ? Math.round((r.producao / r.meta) * 100) : 0;
            const key = recordKey(r);
            const isEditing = editingKey === key;
            const isDeleting = deletingKey === key;
            const isSaving = savingKey === key;
            const editable = canEdit(r);

            return (
              <div
                key={`${r.date}-${r.machineId}-${r.turno}-${i}`}
                className="flex flex-col justify-between rounded-lg border bg-card p-4"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase">{r.machineName}</h4>
                      <p className="text-caption text-muted-foreground">
                        Apontamento: {dispD(r.date)} · {r.turno}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-1.5 py-px rounded-sm"
                      style={{
                        color: pctColor(pct),
                        backgroundColor: `${pctColor(pct)}15`,
                        borderRadius: 20,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Obs body — textarea in edit mode, static in view mode */}
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                      className="mt-3 mb-3 w-full px-3 py-2 rounded-lg text-sm text-foreground border border-primary/40 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  ) : (
                    <div
                      className="my-3 rounded-md bg-surface-2 px-3 py-2 text-sm"
                    >
                      {r.obs}
                    </div>
                  )}

                  {/* Ordens de Produção — collapsible */}
                  {(r.ordensProducao?.length ?? 0) > 0 && (
                    <div className="mb-2">
                      <button
                        onClick={() => setOrdernsExpanded(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                        className="flex items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ClipboardList size={11} />
                        Ordens de Produção ({r.ordensProducao!.length})
                        {ordensExpanded.has(key) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {ordensExpanded.has(key) && (
                        <div className="mt-1.5 pl-2 border-l-2 border-primary/20 space-y-0.5">
                          {r.ordensProducao!.map((o, oi) => (
                            <p key={oi} className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              {o.retrabalho && (
                                <span className="text-caption font-semibold px-1.5 py-px rounded-sm border border-warning/30 bg-warning/10 text-warning">Retrabalho</span>
                              )}
                              <span className="font-semibold text-foreground">#{o.ordemId}</span>
                              <span>— {o.quantidade.toLocaleString("pt-BR")} pç</span>
                              {o.obs && <span className="text-muted-foreground">({o.obs})</span>}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <p className="text-caption text-muted-foreground">
                    Registrado por <strong>{r.savedBy}</strong> em {r.savedAt || dispD(r.date)}
                  </p>

                  {editable && (
                    <div className="flex gap-2 shrink-0 ml-2">
                      {isEditing ? (
                        /* Edit mode: Save / Cancel */
                        <>
                          <button
                            onClick={() => handleSaveEdit(r)}
                            disabled={isSaving || !editText.trim()}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast bg-primary text-primary-foreground hover:bg-weg-700 disabled:opacity-50"
                          >
                            {isSaving ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                            Salvar
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast border text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <X size={12} />
                            Cancelar
                          </button>
                        </>
                      ) : isDeleting ? (
                        /* Delete confirm mode */
                        <>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={isSaving}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                          >
                            {isSaving ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeletingKey(null)}
                            disabled={isSaving}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast border text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <X size={12} />
                            Cancelar
                          </button>
                        </>
                      ) : (
                        /* Default: Edit / Delete */
                        <>
                          <button
                            onClick={() => startEdit(r)}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast text-brand-text hover:bg-accent"
                          >
                            <Pencil size={11} />
                            Editar
                          </button>
                          <button
                            onClick={() => { setEditingKey(null); setDeletingKey(key); }}
                            className="press inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-fast text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={11} />
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedbacksTab;
