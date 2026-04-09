import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Check, AlertCircle, ChevronDown, MessageSquare, X, CalendarDays } from "lucide-react";
import { MACHINES, TURNOS } from "@/lib/mock-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EntryData {
  machineId: number;
  producao: string;
  obs: string;
}

interface EntryTabProps {
  onSaved?: () => void;
}

const EntryTab = ({ onSaved }: EntryTabProps) => {
  const isMobile = useIsMobile();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTurno, setSelectedTurno] = useState(TURNOS[0]);
  const [entries, setEntries] = useState<Record<number, EntryData>>(() => {
    const init: Record<number, EntryData> = {};
    MACHINES.forEach(m => {
      init[m.id] = { machineId: m.id, producao: "", obs: "" };
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [obsOpen, setObsOpen] = useState<number | null>(null);

  const filledCount = useMemo(() =>
    Object.values(entries).filter(e => e.producao.trim() !== "").length,
    [entries]
  );

  const hasChanges = filledCount > 0;

  function updateEntry(machineId: number, field: "producao" | "obs", value: string) {
    setEntries(prev => ({
      ...prev,
      [machineId]: { ...prev[machineId], [field]: value },
    }));
    setSaved(false);
  }

  function getPct(machineId: number) {
    const machine = MACHINES.find(m => m.id === machineId);
    const prod = parseInt(entries[machineId]?.producao || "0");
    if (!machine || !prod) return null;
    return Math.round((prod / machine.defaultMeta) * 100);
  }

  function pctColor(pct: number) {
    return pct >= 100 ? "#22C55E" : pct >= 80 ? "#F59E0B" : "#EF4444";
  }

  async function handleSave() {
    setSaving(true);
    // Simulate API save
    await new Promise(r => setTimeout(r, 1500));
    setSaving(false);
    setSaved(true);
    onSaved?.();
  }

  function handleClear() {
    const init: Record<number, EntryData> = {};
    MACHINES.forEach(m => {
      init[m.id] = { machineId: m.id, producao: "", obs: "" };
    });
    setEntries(init);
    setSaved(false);
  }

  return (
    <div className="space-y-3">
      {/* Sticky header with date & turno selectors */}
      <div className="sticky top-[57px] z-30 bg-background/95 backdrop-blur-sm -mx-4 px-4 py-3 border-b border-border">
        <div className="gap-2 flex flex-col">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Data</label>
            <div className="relative">
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
              <div
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground flex items-center justify-between cursor-pointer"
              >
                <span>{format(parseISO(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                <CalendarDays size={16} className="text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Turno</label>
            <select
              value={selectedTurno}
              onChange={e => setSelectedTurno(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            >
              {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${(filledCount / MACHINES.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">
            {filledCount}/{MACHINES.length}
          </span>
        </div>
      </div>

      {/* Machine entries */}
      <div className="space-y-2">
        {MACHINES.map((machine, i) => {
          const pct = getPct(machine.id);
          const entry = entries[machine.id];
          const hasObs = entry.obs.trim() !== "";

          return (
            <motion.div
              key={machine.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-colors ${
                entry.producao.trim() ? "border-primary/20" : "border-border"
              }`}
            >
              <div className="p-3.5">
                {/* Machine name & meta */}
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                      {machine.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Meta: <strong>{machine.defaultMeta.toLocaleString("pt-BR")}</strong>
                    </p>
                  </div>
                  {pct !== null && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-xs font-extrabold px-2.5 py-1 rounded-full shrink-0 ml-2"
                      style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15` }}
                    >
                      {pct}%
                    </motion.span>
                  )}
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Produção"
                      value={entry.producao}
                      onChange={e => updateEntry(machine.id, "producao", e.target.value)}
                      className={`w-full px-3.5 ${isMobile ? "py-3.5 text-base" : "py-2.5 text-sm"} rounded-xl border bg-background font-semibold
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                        transition-all placeholder:text-muted-foreground/40
                        ${entry.producao.trim() ? "border-primary/30" : "border-border"}`}
                    />
                  </div>
                  <button
                    onClick={() => setObsOpen(obsOpen === machine.id ? null : machine.id)}
                    className={`shrink-0 ${isMobile ? "w-12 h-12" : "w-10 h-10"} rounded-xl flex items-center justify-center transition-colors ${
                      hasObs
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    <MessageSquare size={isMobile ? 18 : 16} />
                  </button>
                </div>

                {/* Observation input */}
                <AnimatePresence>
                  {obsOpen === machine.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 relative">
                        <textarea
                          value={entry.obs}
                          onChange={e => updateEntry(machine.id, "obs", e.target.value)}
                          placeholder="Observação (ex: parada para manutenção)"
                          rows={2}
                          className={`w-full px-3.5 py-3 rounded-xl border border-border bg-background text-sm font-medium
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                            transition-all placeholder:text-muted-foreground/40 resize-none`}
                        />
                        <button
                          onClick={() => setObsOpen(null)}
                          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mini progress bar when filled */}
                {pct !== null && (
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.4 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: pctColor(pct) }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Spacer for floating button */}
      <div className="h-24" />

      {/* Floating save button */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed ${isMobile ? "bottom-20" : "bottom-6"} left-4 right-4 z-40 max-w-lg mx-auto`}
          >
            <div className="bg-[hsl(var(--weg-navy))] rounded-2xl p-3 shadow-2xl shadow-black/30 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">
                  {saved ? "Salvo com sucesso!" : `${filledCount} máquina${filledCount > 1 ? "s" : ""} preenchida${filledCount > 1 ? "s" : ""}`}
                </p>
                <p className="text-[10px] text-white/50">
                  {selectedDate} • {selectedTurno}
                </p>
              </div>
              {!saved && (
                <button
                  onClick={handleClear}
                  className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white/90 transition-colors"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`shrink-0 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  saved
                    ? "bg-green-500 text-white"
                    : "bg-white text-[hsl(var(--weg-navy))] active:scale-95"
                } disabled:opacity-70`}
              >
                {saving ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Save size={16} />
                  </motion.div>
                ) : saved ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
                {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EntryTab;
