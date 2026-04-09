import { pctColor } from "@/lib/api";

interface MachineData {
  id: number; name: string; totalProd: number; totalMeta: number; pct: number; days: number;
}

interface MachineTableProps {
  machines: MachineData[];
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
}

const MachineTable = ({ machines, totalProd, totalMeta, pctGeral }: MachineTableProps) => {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ borderRadius: 12 }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#003366', color: '#fff' }}>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Máquina</th>
              <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider">Dias</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider">Produção</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider">Meta</th>
              <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider">%</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m, i) => {
              const barColor = m.pct >= 100 ? '#22C55E' : '#EF4444';
              const barWidth = Math.min(m.pct, 100);
              return (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                  style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff' }}>
                  <td className="px-4 py-3 font-semibold text-foreground text-xs">{m.name}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{m.days}</td>
                  <td className="px-3 py-3 text-right font-bold">{m.totalProd.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{m.totalMeta > 0 ? m.totalMeta.toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full inline-block"
                      style={{ color: pctColor(m.pct), backgroundColor: `${pctColor(m.pct)}15`, borderRadius: 20 }}>
                      {m.pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden" style={{ minWidth: 120 }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F1F5F9' }} className="font-bold">
              <td className="px-4 py-3 text-xs uppercase text-foreground">Total</td>
              <td className="px-3 py-3 text-center">—</td>
              <td className="px-3 py-3 text-right">{totalProd.toLocaleString("pt-BR")}</td>
              <td className="px-3 py-3 text-right">{totalMeta > 0 ? totalMeta.toLocaleString("pt-BR") : "—"}</td>
              <td className="px-3 py-3 text-center">
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full inline-block"
                  style={{ color: pctColor(pctGeral), backgroundColor: `${pctColor(pctGeral)}15`, borderRadius: 20 }}>
                  {pctGeral}%
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden" style={{ minWidth: 120 }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pctGeral, 100)}%`, backgroundColor: pctGeral >= 100 ? '#22C55E' : '#EF4444' }} />
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default MachineTable;
