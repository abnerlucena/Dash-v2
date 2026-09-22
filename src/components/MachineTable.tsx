import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SegmentedBar } from "@/components/SegmentedBar";
import { Sparkline } from "@/components/Sparkline";
import { StatusChip } from "@/components/StatusChip";

interface MachineData {
  id: number; name: string; totalProd: number; totalMeta: number; pct: number; days: number;
}

interface MachineTableProps {
  machines: MachineData[];
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
  /** % da meta por dia (cronológico, últimos N dias) por máquina — alimenta a sparkline. */
  trend?: Record<number, number[]>;
  recordCount?: number;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

const MachineTable = ({ machines, totalProd, totalMeta, pctGeral, trend = {}, recordCount }: MachineTableProps) => {
  const activeCount = machines.filter(m => m.days > 0).length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Máquina</TableHead>
            <TableHead className="text-right">Dias</TableHead>
            <TableHead className="text-right">Produção</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead className="min-w-[220px]">Atingimento</TableHead>
            <TableHead className="pr-4">Tendência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {machines.map(m => (
            <TableRow key={m.id}>
              <TableCell className="pl-4 font-medium">{m.name}</TableCell>
              <TableCell className="text-right text-muted-foreground">{m.days}</TableCell>
              <TableCell className="text-right">{fmt(m.totalProd)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{m.totalMeta > 0 ? fmt(m.totalMeta) : "—"}</TableCell>
              <TableCell>
                {m.totalMeta > 0 ? (
                  <div className="flex items-center gap-2">
                    <SegmentedBar pct={m.pct} className="w-20 shrink-0" />
                    <span className="w-10 text-right">{m.pct}%</span>
                    <StatusChip pct={m.pct} />
                  </div>
                ) : (
                  <StatusChip pct={null} emptyLabel={m.days === 0 ? "Sem apontamento" : undefined} />
                )}
              </TableCell>
              <TableCell className="pr-4">
                <Sparkline values={trend[m.id] ?? []} max={100} label={`Tendência de ${m.name}, % da meta por dia`} />
              </TableCell>
            </TableRow>
          ))}
          {machines.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Nenhuma máquina no filtro atual.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell className="pl-4">
              {activeCount} de {machines.length} máquinas{recordCount !== undefined ? ` · ${fmt(recordCount)} registros` : ""}
            </TableCell>
            <TableCell />
            <TableCell className="text-right">
              <span className="text-muted-foreground">Soma </span>
              <span className="font-medium text-foreground">{fmt(totalProd)}</span>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-medium text-foreground">{totalMeta > 0 ? fmt(totalMeta) : "—"}</span>
            </TableCell>
            <TableCell>
              {totalMeta > 0 && (
                <div className="flex items-center gap-2">
                  <SegmentedBar pct={pctGeral} className="w-20 shrink-0" />
                  <span className="w-10 text-right font-medium text-foreground">{pctGeral}%</span>
                  <StatusChip pct={pctGeral} />
                </div>
              )}
            </TableCell>
            <TableCell className="pr-4" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export default MachineTable;
