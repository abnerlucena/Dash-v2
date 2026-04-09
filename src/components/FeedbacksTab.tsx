import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { pctColor } from "@/lib/api";

const FeedbacksTab = () => {
  const { records, machines } = useAuth();
  const isMobile = useIsMobile();

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(fmt(weekAgo));
  const [dateTo, setDateTo] = useState(fmt(today));
  const [machineFilter, setMachineFilter] = useState("TODAS");

  const observations = useMemo(() => {
    return records.filter(r => {
      if (!r.obs || !r.obs.trim()) return false;
      if (r.date < dateFrom || r.date > dateTo) return false;
      if (machineFilter !== "TODAS" && r.machineName !== machineFilter) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, dateFrom, dateTo, machineFilter]);

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border p-5 flex flex-wrap items-end gap-4" style={{ borderRadius: 12 }}>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm font-medium bg-background border border-border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ borderRadius: 6 }}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm font-medium bg-background border border-border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ borderRadius: 6 }}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Máquina</label>
          <select
            value={machineFilter}
            onChange={e => setMachineFilter(e.target.value)}
            className="text-sm font-medium bg-background border border-border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{ borderRadius: 6 }}
          >
            <option value="TODAS">TODAS</option>
            {machines.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <span
            className="text-xs font-bold px-4 py-2 rounded-md border"
            style={{ borderColor: "#0066B3", color: "#0066B3", borderRadius: 6 }}
          >
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
            return (
              <div
                key={`${r.date}-${r.machineId}-${r.turno}-${i}`}
                className="bg-card rounded-xl border-l-4 border border-border p-4 flex flex-col justify-between"
                style={{ borderLeftColor: "#0066B3", borderRadius: 12, background: "#F8FCFF" }}
              >
                <div>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="text-xs font-extrabold text-foreground uppercase">{r.machineName}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Apontamento: {fmtDate(r.date)} · {r.turno}
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

                  <div
                    className="mt-3 mb-3 px-3 py-2 rounded-lg text-sm text-foreground"
                    style={{ background: "#EFF6FF", borderRadius: 8 }}
                  >
                    {r.obs}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Registrado por <strong>{r.savedBy}</strong> em {r.savedAt || fmtDate(r.date)}
                  </p>
                  <div className="flex gap-2">
                    <button className="text-[11px] font-bold px-3 py-1 rounded-md transition-colors" style={{ color: "#0066B3", borderRadius: 6 }}>
                      Editar
                    </button>
                    <button className="text-[11px] font-bold px-3 py-1 rounded-md transition-colors" style={{ color: "#EF4444", borderRadius: 6 }}>
                      Excluir
                    </button>
                  </div>
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
