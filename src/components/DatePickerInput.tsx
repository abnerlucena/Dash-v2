import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerInputProps {
  value: string;            // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;             // YYYY-MM-DD
  max?: string;             // YYYY-MM-DD
  label?: string;
  className?: string;
  displayFormat?: string;   // date-fns format string, default "dd/MM/yyyy"
  /** "field": rótulo em cima (formulários). "pill": rótulo apagado dentro da pílula (barras de filtro). */
  variant?: "field" | "pill";
}

export function DatePickerInput({ value, onChange, min, max, label, className = "", displayFormat = "dd/MM/yyyy", variant = "field" }: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? parseISO(value) : undefined;

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    const iso = format(day, "yyyy-MM-dd");
    onChange(iso);
    setOpen(false);
  }

  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  return (
    <div className={className}>
      {label && variant === "field" && (
        <label className="mb-1 block text-xs text-muted-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label ? `${label}: ${selected ? format(selected, displayFormat, { locale: ptBR }) : "sem data"}` : undefined}
            className={`press flex w-full items-center gap-1.5 rounded-md border bg-card text-sm text-foreground transition-colors duration-fast hover:bg-accent ${variant === "pill" ? "h-8 px-2.5" : "h-9 min-w-[130px] px-3"}`}
          >
            <CalendarDays size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            {label && variant === "pill" && <span className="text-muted-foreground">{label}</span>}
            <span>{selected ? format(selected, displayFormat, { locale: ptBR }) : "—"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[200]" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={ptBR}
            disabled={(day) => {
              if (minDate && day < minDate) return true;
              if (maxDate && day > maxDate) return true;
              return false;
            }}
            defaultMonth={selected}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
