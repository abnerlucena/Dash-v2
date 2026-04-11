import { ChevronDown } from "lucide-react";

interface FilterSelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function FilterSelect({ label, value, onChange, options, className = "" }: FilterSelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm bg-background border border-border rounded-md font-semibold text-foreground hover:border-primary/60 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
          style={{ borderRadius: 6 }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
