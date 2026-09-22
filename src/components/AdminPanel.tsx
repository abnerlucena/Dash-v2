import { useState, useEffect } from "react";
import { Users, Factory, KeyRound, CalendarX, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api, dispD } from "@/lib/api";
import { toast } from "sonner";
import { SelectDropdown } from "@/components/SelectDropdown";
import { DatePickerInput } from "@/components/DatePickerInput";
import AlertConfigPanel from "@/components/AlertConfigPanel";
import type { Holiday } from "@/lib/api";

interface AdminPanelProps {
  onClose: () => void;
}

interface AdminUser {
  nome: string;
  status: string;
}

interface AdminMachine {
  id: number;
  name: string;
  status: string;
  hasMeta: boolean;
  defaultMeta: number;
}

const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const { user, refreshMachines, refreshHolidays } = useAuth();
  const [tab, setTab] = useState<"users" | "machines" | "invites" | "feriados" | "alertas">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allMachines, setAllMachines] = useState<AdminMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [machLoading, setMachLoading] = useState(true);

  // User creation
  const [cNome, setCNome] = useState("");
  const [cSenha, setCSenha] = useState("");
  const [creating, setCreating] = useState(false);

  // Password reset
  const [rTarget, setRTarget] = useState("");
  const [newPw, setNewPw] = useState("");

  // Machine
  const [mName, setMName] = useState("");
  const [mMeta, setMMeta] = useState("");
  const [mAdding, setMAdding] = useState(false);

  // Invite
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Feriados
  const [holidays, setHolidaysList] = useState<Holiday[]>([]);
  const [holLoading, setHolLoading] = useState(true);
  const [hDate, setHDate] = useState("");
  const [hLabel, setHLabel] = useState("");
  const [hType, setHType] = useState<"feriado" | "dia_anulado">("feriado");
  const [hAdding, setHAdding] = useState(false);

  useEffect(() => {
    api("listUsers", {}, user)
      .then(r => setUsers(r.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    api("getMachines", {}, user)
      .then(r => setAllMachines(r.allMachines || r.machines || []))
      .catch(() => {})
      .finally(() => setMachLoading(false));
    api("getHolidays", {}, user)
      .then(r => setHolidaysList(r.holidays || []))
      .catch(() => {})
      .finally(() => setHolLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleUser(nome: string) {
    try {
      const r = await api("toggleUser", { targetNome: nome }, user);
      setUsers(u => u.map(x => x.nome === nome ? { ...x, status: r.newStatus } : x));
      toast.success(`${nome} ${r.newStatus === "ativo" ? "ativado" : "bloqueado"}.`);
    } catch (e: any) { toast.error(e.message); }
  }

  async function createUser() {
    if (!cNome || !cSenha) { toast.error("Preencha nome e senha."); return; }
    setCreating(true);
    try {
      await api("adminCreateUser", { nome: cNome, senha: cSenha }, user);
      toast.success(`Usuário "${cNome}" criado!`);
      setCNome(""); setCSenha("");
      const r = await api("listUsers", {}, user);
      setUsers(r.users || []);
    } catch (e: any) { toast.error(e.message); }
    setCreating(false);
  }

  async function resetPw() {
    if (!rTarget || !newPw) { toast.error("Selecione usuário e nova senha."); return; }
    try {
      await api("resetPassword", { targetNome: rTarget, novaSenha: newPw }, user);
      toast.success(`Senha de "${rTarget}" redefinida.`);
      setRTarget(""); setNewPw("");
    } catch (e: any) { toast.error(e.message); }
  }

  async function addMachine() {
    if (!mName.trim()) { toast.error("Informe o nome da máquina."); return; }
    setMAdding(true);
    try {
      await api("addMachine", { name: mName.trim(), hasMeta: true, defaultMeta: Number(mMeta) || 0 }, user);
      toast.success(`Máquina "${mName}" adicionada!`);
      setMName(""); setMMeta("");
      const r = await api("getMachines", {}, user);
      setAllMachines(r.allMachines || r.machines || []);
      refreshMachines();
    } catch (e: any) { toast.error(e.message); }
    setMAdding(false);
  }

  async function toggleMachine(mId: number) {
    try {
      const r = await api("toggleMachine", { machineId: mId }, user);
      setAllMachines(prev => prev.map(m => m.id === mId ? { ...m, status: r.newStatus } : m));
      toast.success(`Máquina ${r.newStatus === "ativo" ? "ativada" : "desativada"}.`);
      refreshMachines();
    } catch (e: any) { toast.error(e.message); }
  }

  async function generateInvite() {
    setInviteLoading(true);
    try {
      const r = await api("generateInviteCode", {}, user);
      setInviteCode(r.code);
      toast.success("Código de convite gerado!");
    } catch (e: any) { toast.error(e.message); }
    setInviteLoading(false);
  }

  async function addHoliday() {
    if (!hDate) { toast.error("Selecione uma data."); return; }
    if (!hLabel.trim()) { toast.error("Informe a descrição."); return; }
    setHAdding(true);
    try {
      await api("addHoliday", { date: hDate, label: hLabel.trim(), type: hType }, user);
      toast.success("Feriado adicionado!");
      setHDate(""); setHLabel(""); setHType("feriado");
      const r = await api("getHolidays", {}, user);
      setHolidaysList(r.holidays || []);
      refreshHolidays();
    } catch (e: any) { toast.error(e.message); }
    setHAdding(false);
  }

  async function removeHoliday(id: string) {
    try {
      await api("removeHoliday", { id }, user);
      toast.success("Feriado removido.");
      setHolidaysList(prev => prev.filter(h => h.id !== id));
      refreshHolidays();
    } catch (e: any) { toast.error(e.message); }
  }

  const tabCls = (key: string) =>
    cn("inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors duration-fast", tab === key ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground");

  const inputCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

  return (
    // Dialog do Radix: Esc fecha, foco fica preso no modal e o fundo fica inerte
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-[640px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="text-sm font-medium">Painel do administrador</DialogTitle>
          <DialogDescription className="text-xs">Usuários, máquinas, convites, feriados e alertas</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto">

        {/* Tabs */}
        <div role="tablist" aria-label="Seções do painel" className="flex gap-1 overflow-x-auto p-4 pb-0">
          <button role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")} className={tabCls("users")}>
            <Users size={14} aria-hidden="true" />Usuários
          </button>
          <button role="tab" aria-selected={tab === "machines"} onClick={() => setTab("machines")} className={tabCls("machines")}>
            <Factory size={14} aria-hidden="true" />Máquinas
          </button>
          <button role="tab" aria-selected={tab === "invites"} onClick={() => setTab("invites")} className={tabCls("invites")}>
            <KeyRound size={14} aria-hidden="true" />Convites
          </button>
          <button role="tab" aria-selected={tab === "feriados"} onClick={() => setTab("feriados")} className={tabCls("feriados")}>
            <CalendarX size={14} aria-hidden="true" />Feriados
          </button>
          <button role="tab" aria-selected={tab === "alertas"} onClick={() => setTab("alertas")} className={tabCls("alertas")}>
            <Bell size={14} aria-hidden="true" />Alertas
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Users Tab */}
          {tab === "users" && (
            <>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-normal text-muted-foreground">Nome</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground">Perfil</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground">Status</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.nome} className="border-b border-border/50">
                          <td className="px-3 py-2 font-semibold text-foreground">{u.nome}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-semibold px-1.5 py-px rounded-sm ${u.role === "admin" ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}>
                              {u.role === "admin" ? "Admin" : "Operador"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-medium px-1.5 py-px rounded-sm ${u.status === "ativo" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {u.status === "ativo" ? "Ativo" : "Bloqueado"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {u.nome !== "Admin" && (
                              <button onClick={() => toggleUser(u.nome)}
                                className={`text-xs font-semibold px-2 py-1 rounded-md ${u.status === "ativo" ? "bg-destructive/10 text-destructive hover:bg-destructive/10" : "bg-success/10 text-success hover:bg-success/10"}`}>
                                {u.status === "ativo" ? "Bloquear" : "Ativar"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Create user */}
              <div className="bg-surface-2 rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground mb-3">Criar Novo Usuário</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                    <input value={cNome} onChange={e => setCNome(e.target.value)} placeholder="Nome do usuário" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Senha</label>
                    <input type="password" value={cSenha} onChange={e => setCSenha(e.target.value)} placeholder="Mín. 4 caracteres" className={inputCls} />
                  </div>
                </div>
                <button onClick={createUser} disabled={creating}
                  className="press inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 transition-colors bg-primary hover:bg-weg-700">
                  {creating ? "Criando..." : "Criar Usuário"}
                </button>
              </div>

              {/* Reset password */}
              <div className="bg-surface-2 rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground mb-3">Redefinir Senha</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <SelectDropdown
                      label="Usuário"
                      value={rTarget}
                      onChange={setRTarget}
                      options={[
                        { value: "", label: "Selecione..." },
                        ...users.filter(u => u.nome !== user?.nome).map(u => ({ value: u.nome, label: u.nome })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Nova Senha</label>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mín. 4 caracteres" className={inputCls} />
                  </div>
                </div>
                <button onClick={resetPw}
                  className="press inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground transition-colors bg-primary hover:bg-weg-700">
                  Redefinir
                </button>
              </div>
            </>
          )}

          {/* Machines Tab */}
          {tab === "machines" && (
            <>
              {machLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-normal text-muted-foreground w-10">ID</th>
                        <th className="text-left px-3 py-2 text-xs font-normal text-muted-foreground">Nome</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground w-16">Meta</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground w-16">Status</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground w-20">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMachines.map((m: any, i: number) => (
                        <tr key={m.id} className="border-b border-border/50" style={{ opacity: m.status === "inativo" ? 0.5 : 1 }}>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{m.id}</td>
                          <td className="px-3 py-2 font-semibold text-foreground text-xs">{m.name}</td>
                          <td className="px-3 py-2 text-center text-xs">{m.defaultMeta || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-caption font-medium px-1.5 py-px rounded-sm ${m.status === "ativo" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {m.status === "ativo" ? "Ativa" : "Inativa"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => toggleMachine(m.id)}
                              className={`text-caption font-semibold px-2 py-1 rounded-md ${m.status === "ativo" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                              {m.status === "ativo" ? "Desativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-surface-2 rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground mb-3">Adicionar Nova Máquina</p>
                <div className="grid grid-cols-[2fr_1fr] gap-3 mb-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Nome</label>
                    <input value={mName} onChange={e => setMName(e.target.value)} placeholder="Ex: HORIZONTAL 3" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Meta Padrão</label>
                    <input type="number" value={mMeta} onChange={e => setMMeta(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                </div>
                <button onClick={addMachine} disabled={mAdding}
                  className="press inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 bg-primary hover:bg-weg-700">
                  {mAdding ? "Adicionando..." : "Adicionar Máquina"}
                </button>
              </div>
            </>
          )}

          {/* Invites Tab */}
          {tab === "invites" && (
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-lg border p-4 text-center">
                <p className="text-sm font-medium text-foreground mb-3">Gerar Código de Convite</p>
                <p className="text-xs text-muted-foreground mb-4">Novos usuários precisam de um código de convite para criar conta.</p>
                <button onClick={generateInvite} disabled={inviteLoading}
                  className="press inline-flex h-9 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium text-primary-foreground disabled:opacity-60 mb-4 bg-primary hover:bg-weg-700">
                  {inviteLoading ? "Gerando..." : "Gerar Código"}
                </button>
                {inviteCode && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Código gerado:</p>
                    <p className="text-lg font-semibold text-primary tracking-wider font-mono">{inviteCode}</p>
                    <p className="text-caption text-muted-foreground mt-2">Compartilhe este código com o novo usuário.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Feriados Tab */}
          {tab === "feriados" && (
            <div className="space-y-4">
              {/* Add form */}
              <div className="bg-surface-2 rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground mb-3">Adicionar Feriado / Dia Anulado</p>
                <div className="flex flex-wrap gap-3 items-end mb-3">
                  <DatePickerInput label="Data" value={hDate} onChange={setHDate} />
                  <SelectDropdown
                    label="Tipo"
                    value={hType}
                    onChange={v => setHType(v as "feriado" | "dia_anulado")}
                    options={[
                      { value: "feriado", label: "Feriado" },
                      { value: "dia_anulado", label: "Dia Anulado" },
                    ]}
                    className="min-w-[150px]"
                  />
                  <div className="flex-1 min-w-[160px]">
                    <label className="mb-1 block text-xs text-muted-foreground">Descrição</label>
                    <input
                      value={hLabel}
                      onChange={e => setHLabel(e.target.value)}
                      placeholder="Ex: Natal, Paralisação..."
                      className={inputCls}
                    />
                  </div>
                  <button
                    onClick={addHoliday}
                    disabled={hAdding}
                    className="press inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 transition-colors self-end bg-primary hover:bg-weg-700"
                  >
                    {hAdding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>

              {/* Table */}
              {holLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : holidays.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-normal text-muted-foreground">Data</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground">Tipo</th>
                        <th className="text-left px-3 py-2 text-xs font-normal text-muted-foreground">Descrição</th>
                        <th className="text-center px-3 py-2 text-xs font-normal text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...holidays].sort((a, b) => b.date.localeCompare(a.date)).map((h, i) => (
                        <tr key={h.id} className="border-b border-border/50">
                          <td className="px-3 py-2 font-semibold text-foreground text-xs">{dispD(h.date)}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`text-caption font-medium px-1.5 py-px rounded-sm ${h.type === "feriado" ? "bg-info/10 text-info" : "bg-destructive/10 text-destructive"}`}
                            >
                              {h.type === "feriado" ? "Feriado" : "Dia Anulado"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-foreground text-xs">{h.label}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeHoliday(h.id)}
                              className="text-caption font-semibold px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Alertas Tab */}
          {tab === "alertas" && <AlertConfigPanel />}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
