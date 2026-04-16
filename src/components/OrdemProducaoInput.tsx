import { Plus, Trash2 } from "lucide-react";
import type { OrdemProducao } from "@/lib/api";

interface OrdemProducaoInputProps {
  ordens: OrdemProducao[];
  onChange: (ordens: OrdemProducao[]) => void;
  maxOrdens?: number;
}

const OrdemProducaoInput = ({ ordens, onChange, maxOrdens = 10 }: OrdemProducaoInputProps) => {
  const filledOrdens = ordens.filter(o => o.quantidade > 0);
  const total = filledOrdens.reduce((s, o) => s + o.quantidade, 0);

  function addOrdem() {
    if (ordens.length >= maxOrdens) return;
    onChange([...ordens, { ordemId: "", quantidade: 0 }]);
  }

  function updateOrdem(idx: number, field: keyof OrdemProducao, value: string | number) {
    onChange(ordens.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  }

  function removeOrdem(idx: number) {
    // Never remove the first row — let user clear its fields instead
    if (idx === 0) return;
    onChange(ordens.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {ordens.map((ordem, idx) => {
        const isFirst = idx === 0;
        return (
          <div key={idx} className="flex gap-2 items-center">
            {/* First row: just Quantidade + Adicionar Ordem button */}
            {/* Additional rows: Nº OS + Quantidade + trash */}
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

            {/* Quantity field */}
            <input
              type="number"
              inputMode="numeric"
              placeholder="Quantidade"
              min={0}
              max={999999}
              value={ordem.quantidade || ""}
              onChange={e => updateOrdem(idx, "quantidade", Math.max(0, Number(e.target.value)))}
              className="px-3 py-2 text-sm rounded-md border border-border bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center"
              style={{ borderRadius: 6, flex: 1, fontWeight: isFirst ? 700 : 600 }}
            />

            {/* Right action: "Adicionar Ordem" on first row, trash on additional rows */}
            {isFirst ? (
              <button
                onClick={addOrdem}
                disabled={ordens.length >= maxOrdens}
                className="shrink-0 h-9 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-md border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ borderRadius: 6 }}
                title="Adicionar outra ordem"
              >
                <Plus size={12} />
                Adicionar Ordem
              </button>
            ) : (
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

      {/* Total footer */}
      {filledOrdens.length > 0 && (
        <p className="text-xs text-muted-foreground font-medium pt-0.5 text-right">
          Total: <strong className="text-foreground">{total.toLocaleString("pt-BR")} pç</strong>
          {filledOrdens.length > 1 && <span className="ml-1">({filledOrdens.length} ordens)</span>}
        </p>
      )}
    </div>
  );
};

export default OrdemProducaoInput;
