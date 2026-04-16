import { useState, useMemo, useRef } from "react";
import { Save, Check, MessageSquare, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth, type OrdemProducao } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { TURNOS, today, api, pctColor } from "@/lib/api";
import { toast } from "sonner";
import { DatePickerInput } from "@/components/DatePickerInput";
import { SelectDropdown } from "@/components/SelectDropdown";
import OrdemProducaoInput from "@/components/OrdemProducaoInput";

interface EntryData { machineId: number; ordens: OrdemProducao[]; obs: string; }

// Static machine grouping — matched case-insensitively against backend names
const MACHINE_GROUPS: { id: string; label: string; names: string[] }[] = [
  { id: "horizontais", label: "Horizontais",           names: ["HORIZONTAL 1", "HORIZONTAL 2"] },
  { id: "verticais",   label: "Verticais",              names: ["VERTICAL PLACAS / SUP. 1", "VERTICAL PLACAS / SUP. 2", "VERTICAL MÓDULOS 1", "VERTICAL MÓDULOS 2"] },
  { id: "granel",      label: "Granel & Interruptores", names: ["A GRANEL", "MÁQUINA INTERRUPTOR", "TESTE INTERRUPTORES", "MANUAL INTERRUPTOR", "INSERÇÃO DOS CONTATOS INTERRUPTOR", "FECHAMENTO TECLA INTERRUPTORES"] },
  { id: "montagem",    label: "Montagem",               names: ["MONTAGEM DIVERSOS", "MONTAGEM PLACA REFINATTO", "MONTAGEM TOMADAS MANUAL", "MÁQUINA DE TOMADAS AUTOMÁTICA"] },
  { id: "kits",        label: "Kits & Retrabalho",      names: ["KIT 1 PARAFUSO", "KIT 2 PARAFUSO", "RETRABALHO GERAL"] },
];

const ProductionEntry = () => {
  const isMobile = useIsMobile();
  const { user, machines, metas, silentRefresh } = useAuth();

  const [selectedDate, setSelectedDate]     = useState(today());
  const [selectedTurno, setSelectedTurno]   = useState(TURNOS[0]);
  const [entries, setEntries]               = useState<Record<number, EntryData>>(() => {
    const init: Record<number, EntryData> = {};
    machines.forEach(m => { init[m.id] = { machineId: m.id, ordens: [{ ordemId: "", quantidade: 0 }], obs: "" }; });
    return init;
  });
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [obsOpen, setObsOpen]               = useState<number | null>(null);
  const [search, setSearch]                 = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [warningInputs, setWarningInputs]   = useState<Set<number>>(new Set());

  // P3: debounce ref — prevents duplicate saves within 800 ms
  const lastSaveTimeRef = useRef<number>(0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filledCount = useMemo(() =>
    Object.values(entries).filter(e => e.ordens.some(o => o.quantidade > 0)).length,
  [entries]);

  const hasChanges = filledCount > 0;

  // ── Grouping ──────────────────────────────────────────────────────────────
  const groupedMachines = useMemo(() => {
    const assigned = new Set<number>();
    const result: { id: string; label: string; machines: typeof machines }[] = [];
    for (const g of MACHINE_GROUPS) {
      const gm = machines.filter(m => g.names.includes(m.name.toUpperCase()));
      if (gm.length > 0) {
        result.push({ id: g.id, label: g.label, machines: gm });
        gm.forEach(m => assigned.add(m.id));
      }
    }
    const others = machines.filter(m => !assigned.has(m.id));
    if (others.length > 0) result.push({ id: "outros", label: "Outros", machines: others });
    return result;
  }, [machines]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupedMachines;
    return groupedMachines
      .map(g => ({ ...g, machines: g.machines.filter(m => m.name.toLowerCase().includes(q)) }))
      .filter(g => g.machines.length > 0);
  }, [groupedMachines, search]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  function updateObs(machineId: number, value: string) {
    setEntries(prev => ({ ...prev, [machineId]: { ...prev[machineId], obs: value } }));
    setSaved(false);
  }

  // P2: XSS guard on obs
  function handleObsChange(machineId: number, value: string) {
    if (/(<script|javascript:|on\w+=)/i.test(value)) {
      toast.error("Observação contém caracteres não permitidos.");
      updateObs(machineId, "");
      return;
    }
    updateObs(machineId, value.slice(0, 500));
  }

  function updateOrdens(machineId: number, ordens: OrdemProducao[]) {
    setEntries(prev => ({ ...prev, [machineId]: { ...prev[machineId], ordens } }));
    setSaved(false);
  }

  // P1: sanitise quantity — integers only, warn if > 10× meta
  function handleQuantityChange(machineId: number, rawValue: string) {
    const sanitized = rawValue.replace(/[^0-9]/g, "");
    const qty = parseInt(sanitized) || 0;
    const entry = entries[machineId];
    if (!entry) return;
    const newOrdens = [...entry.ordens];
    newOrdens[0] = { ...newOrdens[0], quantidade: qty };
    updateOrdens(machineId, newOrdens);

    const meta = metas[machineId] || 0;
    if (meta > 0 && qty > meta * 10) {
      if (!warningInputs.has(machineId)) {
        toast.warning("Valor muito acima da meta. Confirme antes de salvar.");
      }
      setWarningInputs(prev => new Set([...prev, machineId]));
    } else {
      setWarningInputs(prev => { const n = new Set(prev); n.delete(machineId); return n; });
    }
  }

  function getOrdemTotal(machineId: number): number {
    return (entries[machineId]?.ordens || []).reduce((s, o) => s + (o.quantidade || 0), 0);
  }

  function getPct(machineId: number): number | null {
    const prod = getOrdemTotal(machineId);
    const metaVal = metas[machineId] || 0;
    if (!prod || !metaVal) return null;
    return Math.round((prod / metaVal) * 100);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    // P3: debounce
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 800) return;
    lastSaveTimeRef.current = now;

    // P4: date range validation
    const dateObj = new Date(selectedDate + "T12:00:00");
    if (isNaN(dateObj.getTime())) { toast.error("Data inválida."); return; }
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateObj > tomorrow) { toast.error("Data inválida."); return; }
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    if (dateObj < yearAgo) toast.warning("Data muito antiga. Confirme se está correto.");

    setSaving(true);
    try {
      const nowBR = new Date().toLocaleString("pt-BR");
      const records = Object.values(entries)
        .filter(e => e.ordens.some(o => o.quantidade > 0))
        .map(e => {
          const machine = machines.find(m => m.id === e.machineId);
          const producao = e.ordens.reduce((s, o) => s + (o.quantidade || 0), 0);
          return {
            date: selectedDate,
            turno: selectedTurno,
            machineId: e.machineId,
            machineName: machine?.name || "",
            meta: metas[e.machineId] ?? machine?.defaultMeta ?? 0,
            producao,
            ordensProducao: e.ordens.filter(o => o.quantidade > 0),
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
    } finally {
      setSaving(false); // P5: always reset, even on session expiry
    }
  }

  function handleClear() {
    const init: Record<number, EntryData> = {};
    machines.forEach(m => { init[m.id] = { machineId: m.id, ordens: [{ ordemId: "", quantidade: 0 }], obs: "" }; });
    setEntries(init);
    setSaved(false);
    setWarningInputs(new Set());
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Sticky controls (DATA, TURNO, barra de progresso) — UNCHANGED ── */}
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
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(filledCount / Math.max(machines.length, 1)) * 100}%` }} />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground shrink-0">{filledCount}/{machines.length}</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar máquina..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40"
          style={{ borderRadius: 8 }}
        />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Grouped machine list ── */}
      <div className="space-y-3">
        {visibleGroups.map(group => {
          const isSearching = search.trim() !== "";
          const isCollapsed = !isSearching && collapsedGroups.has(group.id);
          const filled = group.machines.filter(m => entries[m.id]?.ordens.some(o => o.quantidade > 0)).length;
          const total  = group.machines.length;
          const allFilled  = filled === total && total > 0;
          const someFilled = filled > 0 && !allFilled;

          const badgeStyle = allFilled
            ? { backgroundColor: "#22C55E", color: "white" }
            : someFilled
            ? { backgroundColor: "#0066B315", color: "#0066B3" }
            : undefined;
          const badgeBase = "text-xs font-bold px-2 py-0.5 rounded-full";
          const badgeClass = allFilled || someFilled
            ? badgeBase
            : `${badgeBase} bg-muted text-muted-foreground`;

          return (
            <div key={group.id} className="space-y-1.5">

              {/* Group header */}
              <button
                onClick={() => !isSearching && toggleGroup(group.id)}
                disabled={isSearching}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/50 transition-colors hover:bg-muted/60"
                style={{ borderRadius: 8 }}
              >
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">{group.label}</span>
                <div className="flex items-center gap-2">
                  <span className={badgeClass} style={badgeStyle}>{filled}/{total}</span>
                  {!isSearching && (
                    isCollapsed
                      ? <ChevronDown size={13} className="text-muted-foreground" />
                      : <ChevronUp   size={13} className="text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Machine cards */}
              {!isCollapsed && (
                <div className="space-y-2">
                  {group.machines.map(machine => {
                    const pct        = getPct(machine.id);
                    const entry      = entries[machine.id];
                    if (!entry) return null;
                    const hasObs     = entry.obs.trim() !== "";
                    const metaVal    = metas[machine.id] || machine.defaultMeta;
                    const isFilled   = entry.ordens.some(o => o.quantidade > 0);
                    const isExpanded = entry.ordens.length > 1;
                    const hasWarn    = warningInputs.has(machine.id);

                    const qtyInput = (mobile: boolean) => (
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Quantidade"
                        value={entry.ordens[0]?.quantidade || ""}
                        onChange={e => handleQuantityChange(machine.id, e.target.value)}
                        className={`w-full px-3 ${mobile ? "py-3.5 text-base" : "py-2 text-sm"} font-bold rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center ${hasWarn ? "border-red-400" : "border-border"}`}
                        style={{ borderRadius: 6 }}
                      />
                    );

                    const addOrdemLink = (
                      <button
                        onClick={() => updateOrdens(machine.id, [...entry.ordens, { ordemId: "", quantidade: 0 }])}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}
                      >
                        + Adicionar Ordem
                      </button>
                    );

                    const obsButton = (size: number) => (
                      <button
                        onClick={() => setObsOpen(obsOpen === machine.id ? null : machine.id)}
                        className={`${size === 9 ? "w-9 h-9" : "w-8 h-8"} rounded-md flex items-center justify-center transition-colors ${hasObs ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground border border-border"}`}
                        style={{ borderRadius: 6 }}
                        title="Observação"
                      >
                        <MessageSquare size={14} />
                      </button>
                    );

                    return (
                      <div key={machine.id}
                        className={`bg-card rounded-xl border shadow-sm overflow-hidden transition-colors ${isFilled ? "border-primary/20" : "border-border"}`}
                        style={{ borderRadius: 12 }}>
                        <div className="p-3.5">

                          {isMobile ? (
                            /* ── Mobile: 1 coluna ── */
                            <>
                              <div className="flex items-center justify-between mb-1.5">
                                <h4 className="text-xs font-bold text-foreground leading-tight truncate flex-1 min-w-0 mr-2">
                                  {machine.name}
                                </h4>
                                {pct !== null && (
                                  <span className="shrink-0 text-xs font-extrabold px-2.5 py-1 rounded-full"
                                    style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15`, borderRadius: 20 }}>
                                    {pct}%
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-2.5">
                                Meta: <strong>{metaVal > 0 ? metaVal.toLocaleString("pt-BR") : "—"}</strong>
                              </p>

                              {isExpanded
                                ? <OrdemProducaoInput ordens={entry.ordens} onChange={o => updateOrdens(machine.id, o)} />
                                : qtyInput(true)
                              }

                              <div className="flex items-center justify-between mt-2">
                                {obsButton(9)}
                                {!isExpanded && addOrdemLink}
                              </div>
                            </>
                          ) : (
                            /* ── Desktop: 2 colunas ── */
                            <div className="flex gap-4 items-start">
                              {/* Left 55% */}
                              <div className="flex flex-col justify-center" style={{ flex: "0 0 55%", minWidth: 0 }}>
                                <h4 className="text-xs font-bold text-foreground leading-tight truncate">{machine.name}</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Meta: <strong>{metaVal > 0 ? metaVal.toLocaleString("pt-BR") : "—"}</strong>
                                </p>
                                {pct !== null && (
                                  <span className="mt-1.5 self-start text-xs font-extrabold px-2.5 py-0.5 rounded-full"
                                    style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15`, borderRadius: 20 }}>
                                    {pct}%
                                  </span>
                                )}
                              </div>

                              {/* Right 45% */}
                              <div className="flex flex-col gap-2" style={{ flex: 1, minWidth: 0 }}>
                                {isExpanded
                                  ? <OrdemProducaoInput ordens={entry.ordens} onChange={o => updateOrdens(machine.id, o)} />
                                  : qtyInput(false)
                                }
                                <div className="flex items-center justify-between">
                                  {obsButton(8)}
                                  {!isExpanded && addOrdemLink}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Obs textarea — inline, unchanged behaviour */}
                          {obsOpen === machine.id && (
                            <div className="mt-2.5 relative">
                              <textarea
                                value={entry.obs}
                                onChange={e => handleObsChange(machine.id, e.target.value)}
                                placeholder="Observação geral (ex: parada para manutenção)"
                                rows={2}
                                maxLength={500}
                                className="w-full px-3.5 py-3 rounded-md border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 resize-none"
                                style={{ borderRadius: 6 }}
                              />
                              <button onClick={() => setObsOpen(null)}
                                className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground">
                                <X size={14} />
                              </button>
                              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{entry.obs.length}/500</p>
                            </div>
                          )}

                          {/* Per-machine progress bar */}
                          {pct !== null && (
                            <div className="h-1 bg-muted rounded-full overflow-hidden mt-2.5">
                              <div className="h-full rounded-full transition-all duration-400"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }} />
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
        })}
      </div>

      <div className="h-24" />

      {/* ── Floating save bar — UNCHANGED ── */}
      {hasChanges && (
        <div className={`fixed ${isMobile ? "bottom-20" : "bottom-6"} left-4 right-4 z-40 max-w-lg mx-auto`}>
          <div className="rounded-xl p-3 shadow-2xl shadow-black/30 flex items-center gap-3"
            style={{ background: "#003366", borderRadius: 12 }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">
                {saved ? "Salvo com sucesso!" : `${filledCount} máquina${filledCount > 1 ? "s" : ""} preenchida${filledCount > 1 ? "s" : ""}`}
              </p>
              <p className="text-[10px] text-white/50">{selectedDate} - {selectedTurno}</p>
            </div>
            {!saved && (
              <button onClick={handleClear}
                className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold text-white/60 hover:text-white/90 transition-colors">
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
