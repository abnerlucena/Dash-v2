import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "dark", label: "Tema escuro", Icon: Moon },
  { value: "system", label: "Tema do sistema", Icon: Monitor },
] as const;

/** Alterna claro / escuro / sistema. Em fundos navy (header) use `onBrand`. */
export function ThemeToggle({ onBrand = false, className }: { onBrand?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[2];
  const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length];
  const { Icon } = current;

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={`${current.label}. Mudar para ${next.label.toLowerCase()}`}
      title={current.label}
      className={cn(
        "press inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-fast",
        onBrand ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
