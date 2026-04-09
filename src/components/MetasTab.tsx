import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const DIAS_UTEIS_MES = 22;

const MetasTab = () => {
  const { machines, metas } = useAuth();
  const isMobile = useIsMobile();
  const [turnosAtivos, setTurnosAtivos] = useState(2);

  return (
    <div className="space-y-6">
      {/* Tipo de Meta */}
      <div className="bg-card rounded-xl border border-border p-5" style={{ borderRadius: 12 }}>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Tipo de Meta Aplicada no Dashboard
        </p>
        <div className={`grid ${isMobile ? "grid-cols-3 gap-2" : "grid-cols-3 gap-4"}`}>
          {[1, 2, 3].map(n => {
            const active = turnosAtivos === n;
            return (
              <button
                key={n}
                onClick={() => setTurnosAtivos(n)}
                className="flex flex-col items-center justify-center py-4 rounded-lg border-2 transition-all"
                style={{
                  borderColor: active ? "#0066B3" : "#E2E8F0",
                  backgroundColor: active ? "#0066B310" : "transparent",
                  borderRadius: 10,
                }}
              >
                <span className="text-xl font-extrabold" style={{ color: active ? "#003366" : "#94A3B8" }}>
                  {n}
                </span>
                <span className="text-xs font-semibold" style={{ color: active ? "#003366" : "#94A3B8" }}>
                  {n === 1 ? "Turno" : "Turnos"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Meta/Dia = Meta/Turno x {turnosAtivos} · Afeta o cálculo de % atingimento no Dashboard em tempo real
        </p>
      </div>

      {/* Tabela Metas por Máquina */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm" style={{ borderRadius: 12 }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: "#003366" }}>
          <h3 className="text-sm font-bold text-white">Metas por Máquina</h3>
          <button
            className="text-xs font-bold px-4 py-1.5 rounded-md border border-white/40 text-white hover:bg-white/10 transition-colors"
            style={{ borderRadius: 6 }}
          >
            Editar Metas
          </button>
        </div>

        {isMobile ? (
          <div className="divide-y divide-border">
            {machines.map(m => {
              const metaTurno = metas[m.id] ?? m.defaultMeta;
              const metaDia = metaTurno * turnosAtivos;
              const metaMes = metaDia * DIAS_UTEIS_MES;
              return (
                <div key={m.id} className="px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-foreground">{m.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Meta/Turno</span>
                      <p className="font-extrabold text-foreground">{metaTurno.toLocaleString("pt-BR")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meta/Dia</span>
                      <p className="font-semibold text-foreground">{metaDia.toLocaleString("pt-BR")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meta/Mês</span>
                      <p className="font-semibold text-foreground">{metaMes.toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Máquina</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta / Turno</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta / Dia</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta / Mês ({DIAS_UTEIS_MES} dias)</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Vigente Desde</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m, i) => {
                  const metaTurno = metas[m.id] ?? m.defaultMeta;
                  const metaDia = metaTurno * turnosAtivos;
                  const metaMes = metaDia * DIAS_UTEIS_MES;
                  return (
                    <tr key={m.id} className="border-b border-border/50" style={{ background: i % 2 === 0 ? "transparent" : "#F8FAFC" }}>
                      <td className="px-5 py-3.5 font-bold text-foreground text-xs uppercase">{m.name}</td>
                      <td className="px-4 py-3.5 text-center font-extrabold text-foreground">{metaTurno.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3.5 text-center text-muted-foreground">{metaDia.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3.5 text-center text-muted-foreground">{metaMes.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-xs font-bold text-foreground">25/03/2026</span>
                        <br />
                        <span className="text-[10px] text-muted-foreground">por abnerf</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Metas são <strong>globais</strong> — todos os usuários verão as mesmas metas simultaneamente. Clique em <strong>Editar Metas</strong> para alterar e em <strong>Salvar Metas</strong> para aplicar a todos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MetasTab;
