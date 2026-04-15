import { Plus, Trash2 } from "lucide-react";
import type { OrdemProducao } from "@/lib/api";

interface OrdemProducaoInputProps {
  ordens: OrdemProducao[];
  onChange: (ordens: OrdemProducao[]) => void;
  maxOrdens?: number;
}

const OrdemProducaoInput = ({ ordens, onChange, maxOrdens = 10 }: OrdemProducaoInputProps) => {
  const total = ordens.reduce((s, o) => s + (o.quantidade || 0), 0);

  function addOrdem() {
    if (ordens.length >= maxOrdens) return;
    onChange([...ordens, { ordemId: "", quantidade: 0 }]);
  }

  function updateOrdem(idx: number, field: keyof OrdemProducao, value: string | number) {
    onChange(ordens.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  }

  function removeOrdem(idx: number) {
    onChange(ordens.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {ordens.map((ordem, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Nº da Ordem / OS"
            value={ordem.ordemId}
            onChange={e => updateOrdem(idx, "ordemId", e.target.value.slice(0, 20))}
            className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40"
            style={{ borderRadius: 6 }}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Qtd"
            min={0}
            max={999999}
            value={ordem.quantidade || ""}
            onChange={e => updateOrdem(idx, "quantidade", Math.max(0, Number(e.target.value)))}
            className="w-24 px-3 py-2 text-sm rounded-md border border-border bg-background font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40"
            style={{ borderRadius: 6 }}
          />
          <button
            onClick={() => removeOrdem(idx)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
            style={{ borderRadius: 6 }}
            title="Remover ordem"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={addOrdem}
          disabled={ordens.length >= maxOrdens}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderRadius: 6 }}
        >
          <Plus size={12} />
          Adicionar Ordem
        </button>
        {ordens.length > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            Total: <strong className="text-foreground">{total.toLocaleString("pt-BR")} pç</strong>
            {" "}({ordens.length} {ordens.length === 1 ? "ordem" : "ordens"})
          </span>
        )}
      </div>
    </div>
  );
};

export default OrdemProducaoInput;
