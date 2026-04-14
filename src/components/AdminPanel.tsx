import { useState, useEffect } from "react";
import { X, Users, Factory, KeyRound, CalendarX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, dispD } from "@/lib/api";
import { toast } from "sonner";
import { SelectDropdown } from "@/components/SelectDropdown";
import { DatePickerInput } from "@/components/DatePickerInput";
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
  const [tab, setTab] = useState<"users" | "machines" | "invites" | "feriados">("users");
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
    `px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${tab === key ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground border border-transparent"}`;

  const inputCls = "w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-[620px] max-h-[90vh] overflow-y-auto shadow-2xl" style={{ borderRadius: 14 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border" style={{ background: '#003366', borderRadius: '14px 14px 0 0', color: '#fff' }}>
          <span className="font-bold text-sm">Painel do Administrador</span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-white/80">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 pb-0">
          <button onClick={() => setTab("users")} className={tabCls("users")}>
            <Users size={14} className="inline mr-1.5" />Usuários
          </button>
          <button onClick={() => setTab("machines")} className={tabCls("machines")}>
            <Factory size={14} className="inline mr-1.5" />Máquinas
          </button>
          <button onClick={() => setTab("invites")} className={tabCls("invites")}>
            <KeyRound size={14} className="inline mr-1.5" />Convites
          </button>
          <button onClick={() => setTab("feriados")} className={tabCls("feriados")}>
            <CalendarX size={14} className="inline mr-1.5" />Feriados
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
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Nome</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Perfil</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.nome} className="border-b border-border/50" style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff' }}>
                          <td className="px-3 py-2 font-semibold text-foreground">{u.nome}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-800"}`} style={{ borderRadius: 20 }}>
                              {u.role === "admin" ? "Admin" : "Operador"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} style={{ borderRadius: 20 }}>
                              {u.status === "ativo" ? "Ativo" : "Bloqueado"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {u.nome !== "Admin" && (
                              <button onClick={() => toggleUser(u.nome)}
                                className={`text-xs font-semibold px-2 py-1 rounded-md ${u.status === "ativo" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
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
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <p className="text-sm font-bold text-foreground mb-3">Criar Novo Usuário</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Nome</label>
                    <input value={cNome} onChange={e => setCNome(e.target.value)} placeholder="Nome do usuário" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Senha</label>
                    <input type="password" value={cSenha} onChange={e => setCSenha(e.target.value)} placeholder="Mín. 4 caracteres" className={inputCls} />
                  </div>
                </div>
                <button onClick={createUser} disabled={creating}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60 transition-all"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#22C55E)', borderRadius: 8 }}>
                  {creating ? "Criando..." : "Criar Usuário"}
                </button>
              </div>

              {/* Reset password */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <p className="text-sm font-bold text-foreground mb-3">Redefinir Senha</p>
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
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Nova Senha</label>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mín. 4 caracteres" className={inputCls} />
                  </div>
                </div>
                <button onClick={resetPw}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#003366,#0066B3)', borderRadius: 8 }}>
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
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-10">ID</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Nome</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Meta</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Status</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMachines.map((m: any, i: number) => (
                        <tr key={m.id} className="border-b border-border/50" style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff', opacity: m.status === "inativo" ? 0.5 : 1 }}>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{m.id}</td>
                          <td className="px-3 py-2 font-semibold text-foreground text-xs">{m.name}</td>
                          <td className="px-3 py-2 text-center text-xs">{m.defaultMeta || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} style={{ borderRadius: 20 }}>
                              {m.status === "ativo" ? "Ativa" : "Inativa"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => toggleMachine(m.id)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-md ${m.status === "ativo" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                              {m.status === "ativo" ? "Desativar" : "Ativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <p className="text-sm font-bold text-foreground mb-3">Adicionar Nova Máquina</p>
                <div className="grid grid-cols-[2fr_1fr] gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Nome</label>
                    <input value={mName} onChange={e => setMName(e.target.value)} placeholder="Ex: HORIZONTAL 3" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Meta Padrão</label>
                    <input type="number" value={mMeta} onChange={e => setMMeta(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                </div>
                <button onClick={addMachine} disabled={mAdding}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#22C55E)', borderRadius: 8 }}>
                  {mAdding ? "Adicionando..." : "Adicionar Máquina"}
                </button>
              </div>
            </>
          )}

          {/* Invites Tab */}
          {tab === "invites" && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border text-center">
                <p className="text-sm font-bold text-foreground mb-3">Gerar Código de Convite</p>
                <p className="text-xs text-muted-foreground mb-4">Novos usuários precisam de um código de convite para criar conta.</p>
                <button onClick={generateInvite} disabled={inviteLoading}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 mb-4"
                  style={{ background: 'linear-gradient(135deg,#003366,#0066B3)', borderRadius: 8 }}>
                  {inviteLoading ? "Gerando..." : "Gerar Código"}
                </button>
                {inviteCode && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Código gerado:</p>
                    <p className="text-lg font-extrabold text-primary tracking-wider font-mono">{inviteCode}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Compartilhe este código com o novo usuário.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Feriados Tab */}
          {tab === "feriados" && (
            <div className="space-y-4">
              {/* Add form */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <p className="text-sm font-bold text-foreground mb-3">Adicionar Feriado / Dia Anulado</p>
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
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Descrição</label>
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
                    className="px-4 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 transition-all self-end"
                    style={{ background: 'linear-gradient(135deg,#003366,#0066B3)', borderRadius: 8 }}
                  >
                    {hAdding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>

              {/* Table */}
              {holLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
              ) : holidays.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Tipo</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Descrição</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...holidays].sort((a, b) => b.date.localeCompare(a.date)).map((h, i) => (
                        <tr key={h.id} className="border-b border-border/50" style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff' }}>
                          <td className="px-3 py-2 font-semibold text-foreground text-xs">{dispD(h.date)}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.type === "feriado" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                              style={{ borderRadius: 20 }}
                            >
                              {h.type === "feriado" ? "Feriado" : "Dia Anulado"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-foreground text-xs">{h.label}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeHoliday(h.id)}
                              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
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
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
