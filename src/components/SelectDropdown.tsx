import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SelectDropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  label?: string;
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar...",
  className = "",
  label,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

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
            className={cn(
              "flex items-center justify-between w-full border border-border rounded-lg px-3 py-2 min-h-[36px] text-sm font-semibold text-foreground bg-background",
              "hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer",
              open && "ring-2 ring-primary/40 border-primary/60 bg-primary/5"
            )}
            style={{ borderRadius: 6 }}
          >
            <span className={cn(!value && "text-muted-foreground")}>{selectedLabel}</span>
            <ChevronDown
              size={14}
              className={cn(
                "ml-2 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[160px] z-[200]"
          align="start"
          sideOffset={4}
        >
          <div className="max-h-[280px] overflow-y-auto py-1">
            {options.map(o => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center w-full text-left px-3 py-2 text-sm font-semibold transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-primary/10 hover:text-primary text-foreground pl-[22px]"
                  )}
                >
                  {isSelected && <Check size={14} className="mr-1.5 shrink-0" />}
                  {o.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
