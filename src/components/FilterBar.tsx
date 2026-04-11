import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { type Machine, TURNOS, dispD } from "@/lib/api";
import { DatePickerInput } from "@/components/DatePickerInput";
import { FilterSelect } from "@/components/FilterSelect";

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

  return (
    <div className="bg-card rounded-xl p-3 border border-border shadow-sm" style={{ borderRadius: 12 }}>
      {isMobile && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
          <SlidersHorizontal size={14} className="text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground flex-1">Filtros</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{summary}</span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {(!isMobile || open) && (
        <div className={`flex flex-wrap gap-3 items-end ${isMobile ? 'mt-3' : ''}`}>
          <DatePickerInput label="De" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
          <DatePickerInput label="Até" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
          <FilterSelect
            label="Máquina"
            value={machine}
            onChange={setMachine}
            options={[
              { value: "TODAS", label: "TODAS" },
              ...machines.map(m => ({ value: m.name, label: m.name })),
            ]}
          />
          {showTurno && (
            <FilterSelect
              label="Turno"
              value={turno}
              onChange={setTurno}
              options={[
                { value: "TODOS", label: "TODOS" },
                ...TURNOS.map(t => ({ value: t, label: t })),
              ]}
            />
          )}
          {extra}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
