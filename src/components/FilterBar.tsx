import { useState } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { type Machine, TURNOS, dispD } from "@/lib/api";

interface FilterBarProps {
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  machine: string;
  setMachine: (v: string) => void;
  turno: string;
  setTurno: (v: string) => void;
  machines: Machine[];
  showTurno?: boolean;
  extra?: React.ReactNode;
}

const FilterBar = ({
  dateFrom, setDateFrom, dateTo, setDateTo,
  machine, setMachine, turno, setTurno,
  machines, showTurno = true, extra,
}: FilterBarProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);

  const summary = [
    dateFrom && dateFrom !== dateTo ? `${dispD(dateFrom)} – ${dispD(dateTo)}` : dispD(dateFrom),
    machine === "TODAS" ? "Todas" : machine,
    turno === "TODOS" ? "Todos os turnos" : turno,
  ].join(" · ");

  const inputCls = "text-sm font-medium bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px]";

  return (
    <div className="bg-card rounded-xl p-3 border border-border shadow-sm" style={{ borderRadius: 12 }}>
      {isMobile && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
          <Calendar size={14} className="text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground flex-1">Filtros</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{summary}</span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {(!isMobile || open) && (
        <div className={`flex flex-wrap gap-3 items-end ${isMobile ? 'mt-3' : ''}`}>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Até</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Máquina</label>
            <select value={machine} onChange={e => setMachine(e.target.value)} className={inputCls}>
              <option value="TODAS">TODAS</option>
              {machines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          {showTurno && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Turno</label>
              <select value={turno} onChange={e => setTurno(e.target.value)} className={inputCls}>
                <option value="TODOS">TODOS</option>
                {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {extra}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
