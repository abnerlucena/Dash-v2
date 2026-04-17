import { Trash2 } from "lucide-react";
import type { OrdemProducao } from "@/lib/api";

interface OrdemProducaoInputProps {
  ordens: OrdemProducao[];
  onChange: (ordens: OrdemProducao[]) => void;
}

const OrdemProducaoInput = ({ ordens, onChange }: OrdemProducaoInputProps) => {
  const filledOrdens = ordens.filter(o => o.quantidade > 0);
  const total = filledOrdens.reduce((s, o) => s + o.quantidade, 0);

  function updateOrdem(idx: number, field: keyof OrdemProducao, value: string | number) {
    onChange(ordens.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  }

  function removeOrdem(idx: number) {
    if (ordens.length <= 1) return;
    onChange(ordens.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {ordens.map((ordem, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Nº OS"
            value={ordem.ordemId}
            onChange={e => updateOrdem(idx, "ordemId", e.target.value.slice(0, 20))}
            className="px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40"
            style={{ borderRadius: 6, flex: 1 }}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Quantidade"
            min={0}
            max={999999}
            value={ordem.quantidade || ""}
            onChange={e => updateOrdem(idx, "quantidade", Math.max(0, Number(e.target.value)))}
            className="px-3 py-2 text-sm font-bold rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center"
            style={{ borderRadius: 6, flex: 1 }}
          />
          <button
            onClick={() => removeOrdem(idx)}
            disabled={ordens.length <= 1}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ borderRadius: 6 }}
            title="Remover ordem"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {filledOrdens.length > 1 && (
        <p className="text-xs text-muted-foreground font-medium pt-0.5 text-right">
          Total: <strong className="text-foreground">{total.toLocaleString("pt-BR")} pç</strong>
          <span className="ml-1">({filledOrdens.length} ordens)</span>
        </p>
      )}
    </div>
  );
};

export default OrdemProducaoInput;
