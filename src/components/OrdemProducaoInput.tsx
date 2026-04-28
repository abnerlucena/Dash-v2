import { Trash2, RefreshCw } from "lucide-react";
import type { OrdemProducao } from "@/lib/api";

interface OrdemProducaoInputProps {
  ordens: OrdemProducao[];
  onChange: (ordens: OrdemProducao[]) => void;
}

const OrdemProducaoInput = ({ ordens, onChange }: OrdemProducaoInputProps) => {
  const filledOrdens = ordens.filter(o => o.quantidade > 0);
  const total = filledOrdens.reduce((s, o) => s + o.quantidade, 0);

  function updateOrdem(idx: number, field: keyof OrdemProducao, value: string | number | boolean) {
    onChange(ordens.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  }

  function toggleRetrabalho(idx: number) {
    onChange(ordens.map((o, i) => i === idx ? { ...o, retrabalho: !o.retrabalho } : o));
  }

  function removeOrdem(idx: number) {
    if (ordens.length <= 1) return;
    onChange(ordens.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {ordens.map((ordem, idx) => {
        const isRetrabalho = !!ordem.retrabalho;
        return (
        <div
          key={idx}
          className={`flex gap-2 items-center rounded-md transition-colors ${isRetrabalho ? "bg-amber-50 border border-amber-300/60 p-1.5" : ""}`}
          style={isRetrabalho ? { borderRadius: 8 } : undefined}
        >
          <input
            type="text"
            placeholder="Nº OS"
            value={ordem.ordemId}
            onChange={e => updateOrdem(idx, "ordemId", e.target.value.slice(0, 20))}
            className={`px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/40 ${isRetrabalho ? "border-amber-400/60 focus:ring-amber-400/30 focus:border-amber-500" : "border-border focus:ring-primary/30 focus:border-primary"}`}
            style={{ borderRadius: 6, flex: 1 }}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Qtd"
            min={0}
            max={999999}
            value={ordem.quantidade || ""}
            onChange={e => updateOrdem(idx, "quantidade", Math.max(0, Number(e.target.value)))}
            className={`px-3 py-2 text-sm font-bold rounded-md border bg-background focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/40 text-center ${isRetrabalho ? "border-amber-400/60 focus:ring-amber-400/30 focus:border-amber-500 text-amber-800" : "border-border focus:ring-primary/30 focus:border-primary"}`}
            style={{ borderRadius: 6, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => toggleRetrabalho(idx)}
            aria-pressed={isRetrabalho}
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-md border transition-all ${isRetrabalho ? "bg-amber-500 border-amber-600 text-white shadow-sm" : "bg-muted/40 border-border text-muted-foreground hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600"}`}
            style={{ borderRadius: 6 }}
            title={isRetrabalho ? "Marcado como retrabalho — clique pra desmarcar" : "Marcar como retrabalho"}
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeOrdem(idx)}
            disabled={ordens.length <= 1}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ borderRadius: 6 }}
            title="Remover ordem"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
      })}

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
