import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Calendar } from "lucide-react";
import { pctColor } from "@/lib/api";

interface MachineData {
  id: number;
  name: string;
  totalProd: number;
  totalMeta: number;
  pct: number;
  days: number;
}

interface MachineCardMobileProps {
  machine: MachineData;
  index: number;
}

const MachineCardMobile = ({ machine, index }: MachineCardMobileProps) => {
  const [expanded, setExpanded] = useState(false);
  const color = pctColor(machine.pct);
  const circumference = 2 * Math.PI * 32;
  const progress = Math.min(machine.pct, 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 p-3.5">
        {/* Circular progress */}
        <div className="relative shrink-0 w-16 h-16">
          <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
            <circle cx="36" cy="36" r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
            <motion.circle
              cx="36" cy="36" r="32" fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ delay: index * 0.04 + 0.3, duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-extrabold" style={{ color }}>{machine.pct}%</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-foreground leading-tight line-clamp-2">
            {machine.name}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-muted-foreground">
              Prod: <strong className="text-foreground">{machine.totalProd.toLocaleString("pt-BR")}</strong>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Meta: <strong className="text-foreground">{machine.totalMeta.toLocaleString("pt-BR")}</strong>
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown size={16} className="text-muted-foreground" />
        </motion.div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-0">
              <div className="bg-muted/50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Produção</p>
                  <p className="text-sm font-bold text-foreground">{machine.totalProd.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Meta</p>
                  <p className="text-sm font-bold text-foreground">{machine.totalMeta.toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                    <Calendar size={10} />
                    Dias
                  </p>
                  <p className="text-sm font-bold text-foreground">{machine.days}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MachineCardMobile;
