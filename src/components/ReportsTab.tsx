import { useState, useMemo, Fragment } from "react";
import { Download, FileText, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp, Trash2, CalendarDays, Pencil, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import FilterBar from "@/components/FilterBar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { today, fmt, dispD, pctColor, saveCachedRecords, TURNOS, api } from "@/lib/api";
import { toast } from "sonner";
import ExportModal from "@/components/ExportModal";

type HistSubTab = "calendario" | "tabela";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const SUB_TABS: { id: HistSubTab; label: string }[] = [
  { id: "calendario", label: "Calendário" },
  { id: "tabela", label: "Tabela" },
];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ReportsTab = () => {
  const { records, machines, metas, holidays, user, setRecords, silentRefresh } = useAuth();
  const isMobile = useIsMobile();

  const [subTab, setSubTab] = useState<HistSubTab>("calendario");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [holidayPopover, setHolidayPopover] = useState<string | null>(null);
  const [exportModal, setExportModal] = useState<{ open: boolean; format: "csv" | "pdf" }>({ open: false, format: "csv" });

  // ── Bulk selection ──────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"delete" | "move" | "turno" | null>(null);
  const [bulkMoveDate, setBulkMoveDate] = useState("");
  const [bulkTurno, setBulkTurno] = useState("TURNO 1");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Calendar state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  // Filters for table view
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return fmt(d);
  });
  const [dateTo, setDateTo] = useState(today);
  const [machine, setMachine] = useState("TODAS");
  const [turno, setTurno] = useState("TODOS");

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (machine !== "TODAS" && r.machineName !== machine) return false;
      if (turno !== "TODOS" && r.turno !== turno) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || a.turno.localeCompare(b.turno));
  }, [records, dateFrom, dateTo, machine, turno]);

  // Calendar data aggregation — includes record count per turno to avoid O(n) filters in render
  const calendarData = useMemo(() => {
    const agg: Record<string, { totalProd: number; turnos: Record<string, number>; counts: Record<string, number> }> = {};
    for (const r of records) {
      const dateObj = new Date(r.date + "T12:00:00");
      if (dateObj.getMonth() !== calMonth || dateObj.getFullYear() !== calYear) continue;
      if (!agg[r.date]) agg[r.date] = { totalProd: 0, turnos: {}, counts: {} };
      agg[r.date].totalProd += r.producao;
      agg[r.date].turnos[r.turno] = (agg[r.date].turnos[r.turno] ?? 0) + r.producao;
      agg[r.date].counts[r.turno] = (agg[r.date].counts[r.turno] ?? 0) + 1;
    }
    return agg;
  }, [records, calMonth, calYear]);

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(startDow).fill(null);

    for (let day = 1; day <= totalDays; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [calMonth, calYear]);

  const todayDate = now.getDate();
  const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear();

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }
  function goToday() {
    setCalMonth(now.getMonth());
    setCalYear(now.getFullYear());
  }

  function formatNum(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return n.toString();
  }

  function handleExportCSV() {
    setExportModal({ open: true, format: "csv" });
  }

  function handleExportPDF() {
    setExportModal({ open: true, format: "pdf" });
  }

  // ── Bulk helpers ────────────────────────────────────────────
  const selectableIds = useMemo(() => filtered.slice(0, 200).filter(r => r.id).map(r => r.id!), [filtered]);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }

  async function executeBulkDelete() {
    setBulkLoading(true);
    try {
      await api("bulkDelete", { ids: [...selectedIds] }, user);
      const next = records.filter(r => !r.id || !selectedIds.has(r.id));
      setRecords(next);
      saveCachedRecords(next);
      toast.success(`${selectedIds.size} registro(s) excluído(s)`);
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir registros");
    }
    setBulkLoading(false);
  }

  async function executeBulkMove() {
    if (!bulkMoveDate) { toast.error("Selecione a data destino"); return; }
    setBulkLoading(true);
    try {
      await api("bulkMove", { ids: [...selectedIds], newDate: bulkMoveDate }, user);
      await silentRefresh();
      toast.success(`${selectedIds.size} registro(s) movido(s) para ${dispD(bulkMoveDate)}`);
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao mover registros");
    }
    setBulkLoading(false);
  }

  async function executeBulkTurno() {
    setBulkLoading(true);
    try {
      await api("bulkEditTurno", { ids: [...selectedIds], newTurno: bulkTurno }, user);
      await silentRefresh();
      toast.success(`${selectedIds.size} registro(s) atualizados para ${bulkTurno}`);
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao editar turno");
    }
    setBulkLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        {SUB_TABS.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)}
            className={`px-5 py-2 text-sm font-semibold border transition-all ${
              subTab === st.id
                ? "text-white border-transparent shadow-sm"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
            style={{
              borderRadius: 20,
              ...(subTab === st.id ? { background: "#0066B3" } : {}),
            }}>
            {st.label}
          </button>
        ))}
      </div>

      {/* CALENDÁRIO */}
      {subTab === "calendario" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          style={{ borderRadius: 12 }}
        >
          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#003366" }}>
            <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-base font-bold text-white">
                {MONTH_NAMES[calMonth]} {calYear}
              </h2>
              <button onClick={goToday}
                className="text-[11px] font-semibold px-3 py-0.5 mt-0.5 rounded-full transition-colors"
                style={{ background: "#0066B3", color: "#fff" }}>
                Hoje
              </button>
            </div>
            <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border" style={{ background: "#F8FAFC" }}>
            {WEEKDAYS.map(wd => (
              <div key={wd} className="text-center py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="divide-y divide-border">
            {calendarGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 divide-x divide-border" style={{ minHeight: isMobile ? 70 : 100 }}>
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="bg-muted/20" />;

                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const data = calendarData[dateStr];
                  const isToday = isCurrentMonth && day === todayDate;
                  const holiday = holidays.find(h => h.date === dateStr);

                  const cellBg = holiday
                    ? holiday.type === "feriado" ? "#EFF6FF" : "#FEF2F2"
                    : isToday ? undefined : undefined;

                  const holidayStyle = holiday
                    ? holiday.type === "feriado"
                      ? { bg: "#DBEAFE", color: "#1D4ED8" }
                      : { bg: "#FEE2E2", color: "#B91C1C" }
                    : null;

                  return (
                    <div key={di}
                      onClick={() => {
                        if (holidayPopover === dateStr) { setHolidayPopover(null); return; }
                        if (data) setSelectedDate(dateStr);
                      }}
                      className={`p-1.5 relative transition-colors ${data ? "cursor-pointer" : ""} ${isToday && !holiday ? "bg-primary/5" : data && !holiday ? "hover:bg-muted/30" : ""}`}
                      style={cellBg ? { background: cellBg } : {}}>
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-sm font-bold leading-none ${
                          isToday
                            ? "w-7 h-7 rounded-full flex items-center justify-center text-white"
                            : "text-foreground"
                        }`}
                          style={isToday ? { background: "#0066B3" } : {}}>
                          {day}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {holiday && (
                            <Popover
                              open={holidayPopover === dateStr}
                              onOpenChange={(open) => setHolidayPopover(open ? dateStr : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[11px] leading-none cursor-pointer hover:scale-125 transition-transform"
                                  aria-label={`Ver detalhes: ${holiday.label}`}
                                >
                                  {holiday.type === "feriado" ? "🎉" : "🚫"}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-3" side="bottom" align="end">
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xl mt-0.5">{holiday.type === "feriado" ? "🎉" : "🚫"}</span>
                                    <div>
                                      <p className="text-sm font-bold text-foreground leading-tight">{holiday.label}</p>
                                      <p className="text-[11px] text-muted-foreground mt-0.5">{dispD(dateStr)}</p>
                                    </div>
                                  </div>
                                  <span
                                    className="inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                                    style={holidayStyle ? { background: holidayStyle.bg, color: holidayStyle.color } : {}}
                                  >
                                    {holiday.type === "feriado" ? "Feriado Nacional/Local" : "Dia Anulado"}
                                  </span>
                                  {!data && (
                                    <p className="text-[10px] text-muted-foreground">Nenhum apontamento neste dia.</p>
                                  )}
                                  {data && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {Object.values(data.counts).reduce((s, v) => s + v, 0)} apontamento(s) registrado(s).
                                    </p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                          {data && (
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {formatNum(data.totalProd)}
                            </span>
                          )}
                        </div>
                      </div>
                      {holiday && !isMobile && holidayStyle && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setHolidayPopover(prev => prev === dateStr ? null : dateStr); }}
                          className="text-left w-full text-[10px] font-semibold px-1.5 py-0.5 rounded truncate mb-0.5 cursor-pointer"
                          style={{ background: holidayStyle.bg, color: holidayStyle.color }}
                        >
                          {holiday.label}
                        </button>
                      )}
                      {data && !isMobile && (
                        <div className="space-y-0.5">
                          {Object.entries(data.turnos).sort(([a], [b]) => a.localeCompare(b)).map(([turnoName]) => {
                            const turnoNum = turnoName.replace("TURNO ", "");
                            const count = data.counts[turnoName] ?? 0;
                            return (
                              <div key={turnoName}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate"
                                style={{ background: "#0066B315", color: "#0066B3" }}>
                                Turno {turnoNum} · {count} apt
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {data && isMobile && (
                        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: "#0066B3" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* TABELA */}
      {subTab === "tabela" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <FilterBar
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            machine={machine} setMachine={setMachine}
            turno={turno} setTurno={setTurno}
            machines={machines}
            extra={
              <div className="flex items-center gap-2 self-end">
                <button onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#003366,#0066B3)', borderRadius: 8 }}>
                  <Download size={14} />
                  CSV
                </button>
                <button onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: 8 }}>
                  <FileText size={14} />
                  PDF
                </button>
              </div>
            }
          />

          <div className="bg-card rounded-xl border border-border shadow-sm" style={{ borderRadius: 12 }}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Dados Detalhados ({filtered.length} registros)
              </h3>
              {selectedIds.size > 0 && (
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  <CheckSquare size={13} />
                  {selectedIds.size} selecionado(s)
                </span>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Nenhum registro encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou adicione apontamentos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[740px]">
                  <thead>
                    <tr style={{ background: '#003366', color: '#fff' }}>
                      <th className="w-8 px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-white"
                          title="Selecionar todos"
                        />
                      </th>
                      <th className="w-8 px-2 py-3" />
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Data</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">Turno</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">Máquina</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase">Meta</th>
                      <th className="text-right px-3 py-3 text-xs font-semibold uppercase">Produção</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold uppercase">%</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">Por</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((r, i) => {
                      const meta = r.meta || 0;
                      const prod = r.producao || 0;
                      const pct = meta > 0 ? Math.round(prod / meta * 100) : null;
                      const rowKey = `${r.date}-${r.turno}-${r.machineId}-${i}`;
                      const hasOrdens = (r.ordensProducao?.length ?? 0) > 0;
                      const isExpanded = expandedRow === rowKey;
                      const isChecked = r.id ? selectedIds.has(r.id) : false;
                      const rowBg = isChecked ? '#EFF6FF' : i % 2 === 0 ? '#F8FAFC' : '#fff';
                      return (
                        <Fragment key={rowKey}>
                          <tr
                            className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                            style={{ background: rowBg }}>
                            <td className="px-2 py-2.5 text-center">
                              {r.id && (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelect(r.id!)}
                                  className="w-3.5 h-3.5 rounded cursor-pointer"
                                  style={{ accentColor: '#0066B3' }}
                                />
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              {hasOrdens && (
                                <button
                                  onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title={isExpanded ? "Recolher ordens" : "Ver ordens de produção"}>
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs">{dispD(r.date)}</td>
                            <td className="px-3 py-2.5 text-xs">{r.turno}</td>
                            <td className="px-3 py-2.5 text-xs font-semibold">{r.machineName}</td>
                            <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{meta > 0 ? meta.toLocaleString("pt-BR") : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold">{prod.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2.5 text-center">
                              {pct !== null ? (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                                  style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15`, borderRadius: 20 }}>
                                  {pct}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.savedBy || ""}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[150px]">{r.obs || ""}</td>
                          </tr>
                          {isExpanded && hasOrdens && (
                            <tr key={`${rowKey}-ordens`} style={{ background: rowBg }}>
                              <td /><td />
                              <td colSpan={8} className="px-4 pb-3 pt-0">
                                <div className="flex flex-wrap gap-1.5 border-l-2 border-primary/30 pl-3">
                                  {r.ordensProducao!.map((o, oi) => (
                                    <span key={oi}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-primary/20"
                                      style={{ background: "#0066B310", color: "#0066B3" }}>
                                      <span className="text-muted-foreground font-medium">#{o.ordemId}</span>
                                      <span className="mx-0.5 text-primary/40">→</span>
                                      <span>{o.quantidade.toLocaleString("pt-BR")} pç</span>
                                      {o.obs && <span className="text-muted-foreground ml-1">· {o.obs}</span>}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* BULK ACTION BAR */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="bulk-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-white/10"
            style={{ transform: "translateX(-50%)", background: "#001D3D", minWidth: 320 }}
          >
            <span className="text-white text-xs font-bold mr-1">{selectedIds.size} selecionado(s)</span>
            <button
              onClick={() => setBulkAction("turno")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              title="Alterar turno em massa"
            >
              <Pencil size={13} />
              Turno
            </button>
            <button
              onClick={() => { setBulkMoveDate(""); setBulkAction("move"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              title="Mover para outra data"
            >
              <CalendarDays size={13} />
              Mover
            </button>
            <button
              onClick={() => setBulkAction("delete")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold rounded-lg transition-colors"
              style={{ background: "#EF4444", color: "#fff" }}
              title="Excluir selecionados"
            >
              <Trash2 size={13} />
              Excluir
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Cancelar seleção"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BULK ACTION DIALOGS */}
      <AnimatePresence>
        {bulkAction && (
          <motion.div
            key="bulk-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => !bulkLoading && setBulkAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.18 }}
              className="bg-card w-full max-w-sm rounded-xl border border-border shadow-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {bulkAction === "delete" && (
                <>
                  <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#FEE2E2" }}>
                      <Trash2 size={16} style={{ color: "#EF4444" }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Excluir registros</p>
                      <p className="text-xs text-muted-foreground">{selectedIds.size} registro(s) serão excluídos permanentemente</p>
                    </div>
                  </div>
                  <div className="px-5 py-4 flex gap-3 justify-end">
                    <button onClick={() => setBulkAction(null)} disabled={bulkLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
                      Cancelar
                    </button>
                    <button onClick={executeBulkDelete} disabled={bulkLoading}
                      className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-all disabled:opacity-60"
                      style={{ background: "#EF4444" }}>
                      {bulkLoading ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </>
              )}

              {bulkAction === "move" && (
                <>
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-sm font-bold text-foreground">Mover para outra data</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.size} registro(s) serão movidos</p>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Data destino</label>
                    <input
                      type="date"
                      value={bulkMoveDate}
                      onChange={e => setBulkMoveDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="px-5 pb-4 flex gap-3 justify-end">
                    <button onClick={() => setBulkAction(null)} disabled={bulkLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
                      Cancelar
                    </button>
                    <button onClick={executeBulkMove} disabled={bulkLoading || !bulkMoveDate}
                      className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-all disabled:opacity-60"
                      style={{ background: "#0066B3" }}>
                      {bulkLoading ? "Movendo..." : "Mover"}
                    </button>
                  </div>
                </>
              )}

              {bulkAction === "turno" && (
                <>
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-sm font-bold text-foreground">Alterar turno</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.size} registro(s) serão atualizados</p>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Novo turno</label>
                    <select
                      value={bulkTurno}
                      onChange={e => setBulkTurno(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="px-5 pb-4 flex gap-3 justify-end">
                    <button onClick={() => setBulkAction(null)} disabled={bulkLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
                      Cancelar
                    </button>
                    <button onClick={executeBulkTurno} disabled={bulkLoading}
                      className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-all disabled:opacity-60"
                      style={{ background: "#0066B3" }}>
                      {bulkLoading ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DAY DETAIL MODAL */}
      <AnimatePresence>
        {selectedDate && (() => {
          const dayRecords = records.filter(r => r.date === selectedDate).sort((a, b) => a.turno.localeCompare(b.turno));
          const totalDay = dayRecords.reduce((s, r) => s + r.producao, 0);
          const totalMeta = dayRecords.reduce((s, r) => s + (r.meta || 0), 0);
          const pctDay = totalMeta > 0 ? Math.round(totalDay / totalMeta * 100) : 0;
          const dateLabel = selectedDate.split("-").reverse().join("/");

          return (
            <motion.div
              key="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setSelectedDate(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-card w-full max-w-lg rounded-xl border border-border shadow-xl overflow-hidden"
                style={{ borderRadius: 12 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-3" style={{ background: "#003366" }}>
                  <div>
                    <h3 className="text-sm font-bold text-white">Produção do dia {dateLabel}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      {dayRecords.length} registro{dayRecords.length !== 1 ? "s" : ""} · Total: {totalDay.toLocaleString("pt-BR")} pç
                    </p>
                  </div>
                  <button onClick={() => setSelectedDate(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Summary bar */}
                <div className="px-5 py-3 border-b border-border flex items-center gap-4" style={{ background: "#F8FAFC" }}>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Produção</span>
                    <p className="text-lg font-extrabold text-foreground">{totalDay.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Meta</span>
                    <p className="text-lg font-extrabold text-foreground">{totalMeta.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Atingimento</span>
                    <p className="text-lg font-extrabold" style={{ color: pctColor(pctDay) }}>{pctDay}%</p>
                  </div>
                </div>

                {/* Records table */}
                <div className="max-h-[350px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border" style={{ background: "#F8FAFC" }}>
                        <th className="text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase">Turno</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Máquina</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Meta</th>
                        <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">Produção</th>
                        <th className="text-center px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRecords.map((r, i) => {
                        const pct = r.meta > 0 ? Math.round(r.producao / r.meta * 100) : null;
                        const hasOrdens = (r.ordensProducao?.length ?? 0) > 0;
                        const rowBg = i % 2 === 0 ? "#fff" : "#F8FAFC";
                        return (
                          <Fragment key={`${r.turno}-${r.machineId}-${i}`}>
                            <tr
                              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                              style={{ background: rowBg }}>
                              <td className="px-4 py-2.5 text-xs font-medium">{r.turno}</td>
                              <td className="px-3 py-2.5 text-xs font-semibold text-foreground">{r.machineName}</td>
                              <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                                {r.meta > 0 ? r.meta.toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-bold">{r.producao.toLocaleString("pt-BR")}</td>
                              <td className="px-3 py-2.5 text-center">
                                {pct !== null ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                                    style={{ color: pctColor(pct), backgroundColor: `${pctColor(pct)}15`, borderRadius: 20 }}>
                                    {pct}%
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                            {hasOrdens && (
                              <tr style={{ background: rowBg }}>
                                <td />
                                <td colSpan={4} className="px-3 pb-2 pt-0">
                                  <div className="flex flex-wrap gap-1 pl-1 border-l-2 border-primary/20">
                                    {r.ordensProducao!.map((o, oi) => (
                                      <span
                                        key={oi}
                                        className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/15"
                                        style={{ background: "#0066B308", color: "#0066B3" }}
                                        title={`${o.quantidade.toLocaleString("pt-BR")} pç${o.obs ? ` — ${o.obs}` : ""}`}
                                      >
                                        #{o.ordemId} → {o.quantidade.toLocaleString("pt-BR")} pç
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border flex justify-end">
                  <button onClick={() => setSelectedDate(null)}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg transition-all hover:opacity-90"
                    style={{ background: "#0066B3", borderRadius: 8 }}>
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* EXPORT MODAL */}
      <ExportModal
        open={exportModal.open}
        onClose={() => setExportModal(prev => ({ ...prev, open: false }))}
        format={exportModal.format}
        records={filtered}
        filters={{ dateFrom, dateTo, machine, turno }}
        holidays={holidays}
      />
    </div>
  );
};

export default ReportsTab;
