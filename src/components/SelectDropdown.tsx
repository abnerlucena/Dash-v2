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
  /** "field": rótulo em cima (formulários). "pill": rótulo apagado + valor na mesma pílula (barras de filtro). */
  variant?: "field" | "pill";
}

export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar...",
  className = "",
  label,
  variant = "field",
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

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
            aria-label={label ? `${label}: ${selectedLabel}` : undefined}
            className={cn(
              "press flex w-full items-center justify-between rounded-md border bg-card text-sm text-foreground transition-colors duration-fast",
              "hover:bg-accent",
              variant === "pill" ? "h-8 gap-1.5 px-2.5" : "h-9 px-3",
              open && "bg-accent"
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {label && variant === "pill" && <span className="text-muted-foreground">{label} · </span>}
              {selectedLabel}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "ml-1 shrink-0 text-muted-foreground transition-transform duration-base ease-out",
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
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors duration-fast hover:bg-accent",
                    isSelected && "font-medium"
                  )}
                  aria-selected={isSelected}
                >
                  <Check size={14} className={cn("shrink-0 text-brand-text", !isSelected && "invisible")} aria-hidden="true" />
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
