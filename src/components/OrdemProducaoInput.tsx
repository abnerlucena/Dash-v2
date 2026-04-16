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
    if (idx === 0) return;
    onChange(ordens.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {ordens.map((ordem, idx) => {
        const isFirst = idx === 0;
        return (
          <div key={idx} className="flex gap-2 items-center">
            {/* Rows 1+: Nº OS field */}
            {!isFirst && (
              <input
                type="text"
                placeholder="Nº OS"
                value={ordem.ordemId}
                onChange={e => updateOrdem(idx, "ordemId", e.target.value.slice(0, 20))}
                className="px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40"
                style={{ borderRadius: 6, flex: 1 }}
              />
            )}

            {/* Quantity */}
            <input
              type="number"
              inputMode="numeric"
              placeholder="Quantidade"
              min={0}
              max={999999}
              value={ordem.quantidade || ""}
              onChange={e => updateOrdem(idx, "quantidade", Math.max(0, Number(e.target.value)))}
              className="px-3 py-2 text-sm rounded-md border border-border bg-background font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center"
              style={{ borderRadius: 6, flex: 1 }}
            />

            {/* Rows 1+: trash button */}
            {!isFirst && (
              <button
                onClick={() => removeOrdem(idx)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
                style={{ borderRadius: 6 }}
                title="Remover ordem"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}

      {/* Total — only when more than one ordem filled */}
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
