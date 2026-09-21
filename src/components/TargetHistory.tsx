import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { dispD } from "@/lib/api";
import { data, type TargetHistoryItem } from "@/lib/repositories";

// Histórico de metas (D13) — só no modo Supabase. Cada linha é uma vigência:
// a meta nunca é sobrescrita, uma mudança cria uma linha nova.
const TargetHistory = ({ refreshKey }: { refreshKey: number }) => {
  const { user, machines } = useAuth();
  const [items, setItems] = useState<TargetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [machineFilter, setMachineFilter] = useState<number | "all">("all");

  useEffect(() => {
    setLoading(true);
    data.targets.getHistory(user)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const names = useMemo(() => new Map(machines.map(m => [m.id, m.name])), [machines]);
  const visible = items.filter(i => machineFilter === "all" || i.machineId === machineFilter).slice(0, 60);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm" style={{ borderRadius: 12 }}>
      <div className="flex items-center justify-between px-5 py-3 gap-3 border-b border-border bg-muted/30 flex-wrap">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <History size={15} /> Histórico de Metas
        </h3>
        <select
          value={machineFilter}
          onChange={e => setMachineFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="text-xs font-semibold border border-border rounded-md px-2 py-1.5 bg-background"
          style={{ borderRadius: 6 }}
        >
          <option value="all">Todas as máquinas</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma meta registrada.</p>
      ) : (
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground uppercase">Máquina</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Meta / Turno</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Vale a partir de</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Registrada por</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i, idx) => (
                <tr key={`${i.machineId}-${i.validFrom}`} className="border-b border-border/50" style={{ background: idx % 2 ? "#F8FAFC" : "transparent" }}>
                  <td className="px-5 py-2 text-xs font-bold uppercase">{names.get(i.machineId) ?? `Máquina ${i.machineId}`}</td>
                  <td className="px-3 py-2 text-center font-extrabold">{i.quantity.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-center text-xs font-semibold">{dispD(i.validFrom)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i.createdBy || "Carga inicial"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-2.5 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          Cada alteração cria uma nova vigência; as anteriores ficam guardadas. Os apontamentos antigos mantêm a meta da época.
        </p>
      </div>
    </div>
  );
};

export default TargetHistory;
