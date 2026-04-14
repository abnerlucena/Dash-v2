import { motion } from "framer-motion";
import { pctColor } from "@/lib/api";

interface MachineData {
  id: number;
  name: string;
  totalProd: number;
  totalMeta: number;
  pct: number;
  days: number;
}

interface MobileDetailCardsProps {
  machines: MachineData[];
  totalProd: number;
  totalMeta: number;
  pctGeral: number;
}

const MobileDetailCards = ({ machines, totalProd, totalMeta, pctGeral }: MobileDetailCardsProps) => {
  return (
    <div className="space-y-2">
      {/* Total summary card */}
      <div className="bg-[hsl(var(--weg-navy))] rounded-2xl p-4 text-white">
        <p className="text-[10px] uppercase font-bold tracking-wider text-white/60 mb-1">Resumo Total</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-extrabold">{totalProd.toLocaleString("pt-BR")} <span className="text-xs font-medium text-white/60">peças</span></p>
            <p className="text-xs text-white/50">Meta: {totalMeta.toLocaleString("pt-BR")}</p>
          </div>
          <span
            className="text-lg font-extrabold px-3 py-1 rounded-full"
            style={{ color: pctColor(pctGeral), backgroundColor: `${pctColor(pctGeral)}20` }}
          >
            {pctGeral}%
          </span>
        </div>
      </div>

      {/* Individual machine cards */}
      {machines.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="bg-card rounded-xl border border-border p-3.5"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-foreground line-clamp-1 flex-1 mr-2">{m.name}</h4>
            <span
              className="text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
              style={{ color: pctColor(m.pct), backgroundColor: `${pctColor(m.pct)}15` }}
            >
              {m.pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(m.pct, 100)}%` }}
              transition={{ delay: i * 0.03 + 0.2, duration: 0.5 }}
              className="h-full rounded-full"
              style={{ backgroundColor: pctColor(m.pct) }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Produção: <strong className="text-foreground">{m.totalProd.toLocaleString("pt-BR")}</strong></span>
            <span>Meta: <strong className="text-foreground">{m.totalMeta.toLocaleString("pt-BR")}</strong></span>
            <span>{m.days}d</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default MobileDetailCards;
