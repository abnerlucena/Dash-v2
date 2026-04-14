import { useState, useMemo } from "react";
import { Pencil, Trash2, Check, X, Loader } from "lucide-react";
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
      toast.success("Observação atualizada!");
      setEditingKey(null);
      setEditText("");
      await silentRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
    setSavingKey(null);
  }

  async function handleDelete(r: ProdRecord) {
    const key = recordKey(r);
    setSavingKey(key);
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
      toast.success("Observação removida.");
      setDeletingKey(null);
      await silentRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
    setSavingKey(null);
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-end gap-3" style={{ borderRadius: 12 }}>
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
          <span className="text-xs font-bold px-4 py-2 rounded-md border" style={{ borderColor: "#0066B3", color: "#0066B3", borderRadius: 6 }}>
            {observations.length} {observations.length === 1 ? "observação" : "observações"}
          </span>
        </div>
      </div>

      {/* Cards de observações */}
      {observations.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center" style={{ borderRadius: 12 }}>
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
                className="bg-card rounded-xl border-l-4 border border-border p-4 flex flex-col justify-between"
                style={{ borderLeftColor: "#0066B3", borderRadius: 12, background: "#F8FCFF" }}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="text-xs font-extrabold text-foreground uppercase">{r.machineName}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Apontamento: {dispD(r.date)} · {r.turno}
                      </p>
                    </div>
                    <span
                      className="text-xs font-extrabold px-2 py-0.5 rounded-full"
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
                      style={{ borderRadius: 8 }}
                    />
                  ) : (
                    <div
                      className="mt-3 mb-3 px-3 py-2 rounded-lg text-sm text-foreground"
                      style={{ background: "#EFF6FF", borderRadius: 8 }}
                    >
                      {r.obs}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
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
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md text-white transition-colors disabled:opacity-50"
                            style={{ background: "#0066B3", borderRadius: 6 }}
                          >
                            {isSaving ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                            Salvar
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                            style={{ borderRadius: 6 }}
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
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md text-white transition-colors disabled:opacity-50"
                            style={{ background: "#EF4444", borderRadius: 6 }}
                          >
                            {isSaving ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeletingKey(null)}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                            style={{ borderRadius: 6 }}
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
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md transition-colors hover:bg-primary/10"
                            style={{ color: "#0066B3", borderRadius: 6 }}
                          >
                            <Pencil size={11} />
                            Editar
                          </button>
                          <button
                            onClick={() => { setEditingKey(null); setDeletingKey(key); }}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-md transition-colors hover:bg-red-50"
                            style={{ color: "#EF4444", borderRadius: 6 }}
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
