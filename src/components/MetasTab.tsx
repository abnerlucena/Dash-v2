import { useState } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, today, dispD } from "@/lib/api";
import { toast } from "sonner";
import { DatePickerInput } from "@/components/DatePickerInput";

const DIAS_UTEIS_MES = 22;

const MetasTab = () => {
  const { user, machines, metas, metasInfo, refreshMetas, turnosAtivos, setTurnosAtivos } = useAuth();
  const isMobile = useIsMobile();

  const [editing, setEditing]       = useState(false);
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [vigencia, setVigencia]     = useState(today());
  const [saving, setSaving]         = useState(false);

  const isAdmin = user?.role === "admin";

  function startEdit() {
    const init: Record<number, string> = {};
    machines.forEach(m => { init[m.id] = String(metas[m.id] ?? m.defaultMeta); });
    setEditValues(init);
    setVigencia(today());
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
      await api("saveMetas", { metas: payload, vigenciaInicio: vigencia }, user);
      await refreshMetas();
      setEditing(false);
      setEditValues({});
      toast.success("Metas salvas com sucesso!");
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "Erro ao salvar metas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Tipo de Meta */}
      <div className="bg-card rounded-lg border border-border p-5">
        <p className="text-xs font-medium text-muted-foreground mb-4">
          Tipo de Meta Aplicada no Dashboard
        </p>
        <div className={`grid ${isMobile ? "grid-cols-3 gap-2" : "grid-cols-3 gap-4"}`}>
          {[1, 2, 3].map(n => {
            const active = turnosAtivos === n;
            return (
              <button key={n} onClick={() => setTurnosAtivos(n)}
                aria-pressed={active}
                className={cn(
                  "press flex flex-col items-center justify-center rounded-lg border py-4 transition-colors duration-fast",
                  active ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:bg-accent",
                )}>
                <span className="text-xl font-semibold tabular-nums">{n}</span>
                <span className="text-xs">
                  {n === 1 ? "Turno" : "Turnos"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Meta/Dia = Meta/Turno × {turnosAtivos} · Afeta o cálculo de % atingimento no Dashboard em tempo real
        </p>
      </div>

      {/* Tabela Metas por Máquina */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <h3 className="shrink-0 text-sm font-medium">Metas por máquina</h3>

          {isAdmin && (
            !editing ? (
              <button onClick={startEdit}
                className="press inline-flex h-9 items-center gap-2 rounded-md border bg-card px-4 text-sm transition-colors duration-fast hover:bg-accent">
                <Pencil size={13} />
                Alterar Metas
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={cancelEdit} disabled={saving}
                  className="press inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground disabled:opacity-50">
                  <X size={13} />
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="press inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-weg-700 disabled:opacity-60">
                  <Check size={13} />
                  {saving ? "Salvando..." : "Salvar Metas"}
                </button>
              </div>
            )
          )}
        </div>

        {/* Vigência banner — only while editing */}
        {editing && (
          <div className="px-5 py-2.5 border-b border-warning/30 bg-warning/10 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-warning shrink-0">Vigente a partir de:</span>
            <DatePickerInput value={vigencia} onChange={setVigencia} />
            <p className="text-xs text-warning">As metas entrarão em vigor nesta data para todos os usuários.</p>
          </div>
        )}

        {/* Mobile */}
        {isMobile ? (
          <div className="divide-y divide-border">
            {machines.map(m => {
              const metaTurno = editing ? (Number(editValues[m.id]) || 0) : (metas[m.id] ?? m.defaultMeta);
              const metaDia   = metaTurno * turnosAtivos;
              const metaMes   = metaDia * DIAS_UTEIS_MES;
              const info      = metasInfo[m.id];
              return (
                <div key={m.id} className="px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">{m.name}</p>
                  {editing ? (
                    <input
                      type="number"
                      value={editValues[m.id] ?? ""}
                      onChange={e => setEditValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full px-2.5 py-2 text-sm border-2 border-primary rounded-md bg-background font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                      placeholder="Meta/Turno"
                    />
                  ) : null}
                  <div className="grid grid-cols-3 gap-2 text-caption">
                    <div>
                      <span className="text-muted-foreground">Meta/Turno</span>
                      <p className={`font-semibold ${editing ? "text-primary" : "text-foreground"}`}>
                        {metaTurno.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meta/Dia</span>
                      <p className={`font-semibold ${editing ? "text-primary" : "text-foreground"}`}>
                        {metaDia.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meta/Mês</span>
                      <p className={`font-semibold ${editing ? "text-primary" : "text-foreground"}`}>
                        {metaMes.toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  {!editing && info?.vigenciaInicio && (
                    <p className="text-caption text-muted-foreground">
                      Desde {dispD(info.vigenciaInicio)} · por {info.updatedBy}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-normal text-muted-foreground">Máquina</th>
                  <th className="text-center px-4 py-3 text-xs font-normal text-muted-foreground">
                    Meta / Turno {editing && <span className="normal-case font-normal text-primary">(editando)</span>}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-normal text-muted-foreground">Meta / Dia</th>
                  <th className="text-center px-4 py-3 text-xs font-normal text-muted-foreground">Meta / Mês ({DIAS_UTEIS_MES} dias)</th>
                  <th className="text-center px-4 py-3 text-xs font-normal text-muted-foreground">Vigente Desde</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const metaTurno = editing ? (Number(editValues[m.id]) || 0) : (metas[m.id] ?? m.defaultMeta);
                  const metaDia   = metaTurno * turnosAtivos;
                  const metaMes   = metaDia * DIAS_UTEIS_MES;
                  const info      = metasInfo[m.id];

                  return (
                    <tr key={m.id} className={cn("border-b border-border/50 transition-colors duration-fast", editing ? "bg-primary/5" : "hover:bg-surface-2")}>

                      <td className="px-4 py-2 text-sm font-medium">{m.name}</td>

                      {/* Meta/Turno — input when editing */}
                      <td className="px-4 py-2.5 text-center">
                        {editing ? (
                          <input
                            type="number"
                            value={editValues[m.id] ?? ""}
                            onChange={e => setEditValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                            className="w-28 px-2.5 py-1.5 text-sm border-2 border-primary rounded-md bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                          />
                        ) : (
                          <span className="font-semibold text-foreground">{metaTurno.toLocaleString("pt-BR")}</span>
                        )}
                      </td>

                      {/* Meta/Dia — always derived, highlights blue while editing */}
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${editing ? "text-primary" : "text-muted-foreground"}`}>
                          {metaDia.toLocaleString("pt-BR")}
                        </span>
                      </td>

                      {/* Meta/Mês — always derived */}
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${editing ? "text-primary" : "text-muted-foreground"}`}>
                          {metaMes.toLocaleString("pt-BR")}
                        </span>
                      </td>

                      {/* Vigente Desde */}
                      <td className="px-4 py-3 text-center">
                        {info?.vigenciaInicio ? (
                          <>
                            <span className="text-xs font-medium text-foreground">{dispD(info.vigenciaInicio)}</span>
                            <br />
                            <span className="text-caption text-muted-foreground">por {info.updatedBy}</span>
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
            {isAdmin && !editing && <> Clique em <strong>Alterar Metas</strong> para editar e em <strong>Salvar Metas</strong> para aplicar a todos.</>}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MetasTab;
