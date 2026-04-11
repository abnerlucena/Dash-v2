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
}

export function DatePickerInput({ value, onChange, min, max, label, className = "", displayFormat = "dd/MM/yyyy" }: DatePickerInputProps) {
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
      {label && (
        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-background border border-border rounded-md font-semibold text-foreground hover:border-primary/60 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            style={{ borderRadius: 6, minWidth: 130 }}
          >
            <CalendarDays size={15} className="text-muted-foreground shrink-0" />
            <span>{selected ? format(selected, displayFormat, { locale: ptBR }) : "—"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
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
