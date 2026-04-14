import { useState, useMemo } from "react";
import { Save, Check, MessageSquare, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { TURNOS, today, api, num, pctColor } from "@/lib/api";
import { toast } from "sonner";
import { DatePickerInput } from "@/components/DatePickerInput";
import { SelectDropdown } from "@/components/SelectDropdown";

interface EntryData { machineId: number; producao: string; obs: string; }

const ProductionEntry = () => {
  const isMobile = useIsMobile();
  const { user, machines, metas, silentRefresh } = useAuth();
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedTurno, setSelectedTurno] = useState(TURNOS[0]);
  const [entries, setEntries] = useState<Record<number, EntryData>>(() => {
    const init: Record<number, EntryData> = {};
    machines.forEach(m => { init[m.id] = { machineId: m.id, producao: "", obs: "" }; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [obsOpen, setObsOpen] = useState<number | null>(null);

  const filledCount = useMemo(() =>
    Object.values(entries).filter(e => e.producao.trim() !== "").length,
    [entries]
  );

  const hasChanges = filledCount > 0;

  function updateEntry(machineId: number, field: "producao" | "obs", value: string) {
    setEntries(prev => ({ ...prev, [machineId]: { ...prev[machineId], [field]: value } }));
    setSaved(false);
  }

  function getPct(machineId: number): number | null {
    const prod = num(entries[machineId]?.producao);
    const metaVal = metas[machineId] || 0;
    if (!prod || !metaVal) return null;
    return Math.round((prod / metaVal) * 100);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const nowBR = new Date().toLocaleString("pt-BR");
      const records = Object.values(entries)
        .filter(e => e.producao.trim() !== "")
        .map(e => {
          const machine = machines.find(m => m.id === e.machineId);
          return {
            date: selectedDate,
            turno: selectedTurno,
            machineId: e.machineId,
            machineName: machine?.name || "",
            meta: metas[e.machineId] ?? machine?.defaultMeta ?? 0,
            producao: num(e.producao),
            savedBy: user?.nome || "",
            savedAt: nowBR,
            obs: e.obs || "",
          };
        });

      await api("upsert", { records }, user);
      setSaved(true);
      toast.success("Apontamento salvo com sucesso!");
      await silentRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
    setSaving(false);
  }

  function handleClear() {
    const init: Record<number, EntryData> = {};
    machines.forEach(m => { init[m.id] = { machineId: m.id, producao: "", obs: "" }; });
    setEntries(init);
    setSaved(false);
  }

  return (
    <div className="space-y-3">
      {/* Sticky controls */}
      <div className="sticky top-[60px] z-30 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-3 border-b border-border">
        <div className="flex flex-col gap-2">
          <div className="flex-1">
            <DatePickerInput
              label="Data"
              value={selectedDate}
              onChange={v => { setSelectedDate(v); setSaved(false); }}
              displayFormat="dd 'de' MMMM 'de' yyyy"
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <SelectDropdown
              label="Turno"
              value={selectedTurno}
              onChange={v => { setSelectedTurno(v); setSaved(false); }}
              options={TURNOS.map(t => ({ value: t, label: t }))}
            />
          </div>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(filledCount / machines.length) * 100}%` }} />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">{filledCount}/{machines.length}</span>
        </div>
      </div>

      {/* Machine entries */}
      <div className="space-y-2">
        {machines.map((machine) => {
          const pct = getPct(machine.id);
          const entry = entries[machine.id];
          if (!entry) return null;
          const hasObs = entry.obs.trim() !== "";
          const metaVal = metas[machine.id] || machine.defaultMeta;

          return (
            <div key={machine.id}
              className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-colors ${entry.producao.trim() ? "border-primary/20" : "border-border"}`}
              style={{ borderRadius: 12 }}>
              <div className="p-3.5">
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-2">{machine.name}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Meta: <strong>{metaVal > 0 ? metaVal.toLocaleString("pt-BR") : "—"}</strong>
                    </p>
                  </div>
                  {pct !== null && (
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full shrink-0 ml-2"
                      style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15`, borderRadius: 20 }}>
                      {pct}%
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <input type="number" inputMode="numeric" placeholder="Produção" value={entry.producao}
                      onChange={e => updateEntry(machine.id, "producao", e.target.value)}
                      className={`w-full px-3.5 ${isMobile ? "py-3.5 text-base" : "py-2.5 text-sm"} rounded-md border bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 ${entry.producao.trim() ? "border-primary/30" : "border-border"}`}
                      style={{ borderRadius: 6 }}
                    />
                  </div>
                  <button onClick={() => setObsOpen(obsOpen === machine.id ? null : machine.id)}
                    className={`shrink-0 ${isMobile ? "w-12 h-12" : "w-10 h-10"} rounded-md flex items-center justify-center transition-colors ${hasObs ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground border border-border"}`}
                    style={{ borderRadius: 6 }}>
                    <MessageSquare size={isMobile ? 18 : 16} />
                  </button>
                </div>

                {obsOpen === machine.id && (
                  <div className="mt-2.5 relative">
                    <textarea value={entry.obs} onChange={e => updateEntry(machine.id, "obs", e.target.value)}
                      placeholder="Observação (ex: parada para manutenção)" rows={2}
                      className="w-full px-3.5 py-3 rounded-md border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 resize-none"
                      style={{ borderRadius: 6 }} />
                    <button onClick={() => setObsOpen(null)} className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {pct !== null && (
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-2.5">
                    <div className="h-full rounded-full transition-all duration-400" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-24" />

      {/* Floating save bar */}
      {hasChanges && (
        <div className={`fixed ${isMobile ? "bottom-20" : "bottom-6"} left-4 right-4 z-40 max-w-lg mx-auto`}>
          <div className="rounded-xl p-3 shadow-2xl shadow-black/30 flex items-center gap-3" style={{ background: '#003366', borderRadius: 12 }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">
                {saved ? "Salvo com sucesso!" : `${filledCount} máquina${filledCount > 1 ? "s" : ""} preenchida${filledCount > 1 ? "s" : ""}`}
              </p>
              <p className="text-[10px] text-white/50">{selectedDate} - {selectedTurno}</p>
            </div>
            {!saved && (
              <button onClick={handleClear} className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold text-white/60 hover:text-white/90 transition-colors">
                Limpar
              </button>
            )}
            <button onClick={handleSave} disabled={saving || saved}
              className={`shrink-0 px-5 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${saved ? "bg-green-500 text-white" : "bg-white text-[#003366] active:scale-95"} disabled:opacity-70`}
              style={{ borderRadius: 8 }}>
              {saving ? <Save size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionEntry;
