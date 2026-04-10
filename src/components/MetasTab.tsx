import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, today, dispD } from "@/lib/api";
import { toast } from "sonner";

const DIAS_UTEIS_MES = 22;

const MetasTab = () => {
  const { user, machines, metas, metasInfo, refreshMetas, turnosAtivos, setTurnosAtivos } = useAuth();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [vigenciaInicio, setVigenciaInicio] = useState(today());
  const [saving, setSaving] = useState(false);

  function startEdit() {
    const init: Record<number, string> = {};
    machines.forEach(m => { init[m.id] = String(metas[m.id] ?? m.defaultMeta); });
    setEditValues(init);
    setVigenciaInicio(today());
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValues({});
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      machines.forEach(m => {
        const v = Number(editValues[m.id]);
        if (!isNaN(v) && v >= 0) payload[m.id] = v;
      });
      await api("saveMetas", { metas: payload, vigenciaInicio }, user);
      await refreshMetas();
      setEditing(false);
      toast.success("Metas salvas com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar metas");
    }
    setSaving(false);
  }

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
          {user?.role === "admin" && (
            !editing ? (
              <button
                onClick={startEdit}
                className="text-xs font-bold px-4 py-1.5 rounded-md border border-white/40 text-white hover:bg-white/10 transition-colors"
                style={{ borderRadius: 6 }}
              >
                Editar Metas
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEdit}
                  className="text-xs font-bold px-3 py-1.5 rounded-md border border-white/30 text-white/70 hover:bg-white/10 transition-colors"
                  style={{ borderRadius: 6 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs font-bold px-4 py-1.5 rounded-md bg-green-500 text-white hover:bg-green-400 disabled:opacity-60 transition-colors"
                  style={{ borderRadius: 6 }}
                >
                  {saving ? "Salvando..." : "Salvar Metas"}
                </button>
              </div>
            )
          )}
        </div>

        {/* Vigência selector (only in edit mode) */}
        {editing && (
          <div className="px-5 py-3 border-b border-border bg-amber-50">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Vigente a partir de:
              </label>
              <input
                type="date"
                value={vigenciaInicio}
                onChange={e => setVigenciaInicio(e.target.value)}
                className="text-xs bg-white border border-amber-300 rounded-md px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                style={{ borderRadius: 6 }}
              />
              <p className="text-xs text-amber-700">As metas entrarão em vigor nesta data para todos os usuários.</p>
            </div>
          </div>
        )}

        {isMobile ? (
          <div className="divide-y divide-border">
            {machines.map(m => {
              const metaTurno = editing
                ? (Number(editValues[m.id]) || 0)
                : (metas[m.id] ?? m.defaultMeta);
              const metaDia = metaTurno * turnosAtivos;
              const metaMes = metaDia * DIAS_UTEIS_MES;
              const info = metasInfo[m.id];
              return (
                <div key={m.id} className="px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-foreground">{m.name}</p>
                  {editing ? (
                    <input
                      type="number"
                      value={editValues[m.id] ?? ""}
                      onChange={e => setEditValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-md bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ borderRadius: 6 }}
                      placeholder="Meta/Turno"
                    />
                  ) : (
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
                  )}
                  {!editing && info?.vigenciaInicio && (
                    <p className="text-[10px] text-muted-foreground">
                      Desde {dispD(info.vigenciaInicio)} · por {info.updatedBy}
                    </p>
                  )}
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
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {editing ? "Meta / Turno (editar)" : "Meta / Turno"}
                  </th>
                  {!editing && (
                    <>
                      <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta / Dia</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Meta / Mês ({DIAS_UTEIS_MES} dias)</th>
                    </>
                  )}
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Vigente Desde</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m, i) => {
                  const metaTurno = metas[m.id] ?? m.defaultMeta;
                  const metaDia = metaTurno * turnosAtivos;
                  const metaMes = metaDia * DIAS_UTEIS_MES;
                  const info = metasInfo[m.id];
                  return (
                    <tr key={m.id} className="border-b border-border/50" style={{ background: i % 2 === 0 ? "transparent" : "#F8FAFC" }}>
                      <td className="px-5 py-3.5 font-bold text-foreground text-xs uppercase">{m.name}</td>
                      <td className="px-4 py-3.5 text-center">
                        {editing ? (
                          <input
                            type="number"
                            value={editValues[m.id] ?? ""}
                            onChange={e => setEditValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                            className="w-24 px-2.5 py-1.5 text-sm border border-border rounded-md bg-background font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                            style={{ borderRadius: 6 }}
                          />
                        ) : (
                          <span className="font-extrabold text-foreground">{metaTurno.toLocaleString("pt-BR")}</span>
                        )}
                      </td>
                      {!editing && (
                        <>
                          <td className="px-4 py-3.5 text-center text-muted-foreground">{metaDia.toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-3.5 text-center text-muted-foreground">{metaMes.toLocaleString("pt-BR")}</td>
                        </>
                      )}
                      <td className="px-4 py-3.5 text-center">
                        {info?.vigenciaInicio ? (
                          <>
                            <span className="text-xs font-bold text-foreground">{dispD(info.vigenciaInicio)}</span>
                            <br />
                            <span className="text-[10px] text-muted-foreground">por {info.updatedBy}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
            Metas são <strong>globais</strong> — todos os usuários verão as mesmas metas simultaneamente.
            {user?.role === "admin" && <> Clique em <strong>Editar Metas</strong> para alterar e em <strong>Salvar Metas</strong> para aplicar a todos.</>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MetasTab;
