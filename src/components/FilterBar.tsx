import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { type Machine, TURNOS, dispD } from "@/lib/api";
import { DatePickerInput } from "@/components/DatePickerInput";
import { SelectDropdown } from "@/components/SelectDropdown";
import { cn } from "@/lib/utils";

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

/** Barra de filtros em pílulas: rótulo apagado + valor em destaque ("Máquina · Todas"). */
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
    <div className={cn(isMobile && "w-full min-w-0 rounded-lg border bg-card p-3")}>
      {isMobile && (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-11 w-full min-w-0 items-center gap-2 text-left"
        >
          <SlidersHorizontal size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Filtros</span>
          <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">{summary}</span>
          <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 text-muted-foreground transition-transform duration-base ease-out", open && "rotate-180")} />
        </button>
      )}

      {(!isMobile || open) && (
        <div className={cn("flex flex-wrap items-center gap-2", isMobile && "mt-2")}>
          <DatePickerInput variant="pill" label="De" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
          <DatePickerInput variant="pill" label="Até" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
          <SelectDropdown
            variant="pill"
            label="Máquina"
            value={machine}
            onChange={setMachine}
            options={[
              { value: "TODAS", label: "Todas" },
              ...machines.map(m => ({ value: m.name, label: m.name })),
            ]}
          />
          {showTurno && (
            <SelectDropdown
              variant="pill"
              label="Turno"
              value={turno}
              onChange={setTurno}
              options={[
                { value: "TODOS", label: "Todos" },
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
