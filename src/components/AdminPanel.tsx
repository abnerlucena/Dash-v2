import { useState } from "react";
import { X, Users, Factory, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, pctColor } from "@/lib/api";
import { toast } from "sonner";

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const { user, refreshMachines } = useAuth();
  const [tab, setTab] = useState<"users" | "machines" | "invites">("users");
  const [users, setUsers] = useState<any[]>([]);
  const [allMachines, setAllMachines] = useState<any[]>([]);
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

  useState(() => {
    api("listUsers", { token: user?.token }, user)
      .then(r => setUsers(r.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    api("getMachines", {}, user)
      .then(r => setAllMachines(r.allMachines || r.machines || []))
      .catch(() => {})
      .finally(() => setMachLoading(false));
  });

  async function toggleUser(nome: string) {
    try {
      const r = await api("toggleUser", { token: user?.token, targetNome: nome }, user);
      setUsers(u => u.map(x => x.nome === nome ? { ...x, status: r.newStatus } : x));
      toast.success(`${nome} ${r.newStatus === "ativo" ? "ativado" : "bloqueado"}.`);
    } catch (e: any) { toast.error(e.message); }
  }

  async function createUser() {
    if (!cNome || !cSenha) { toast.error("Preencha nome e senha."); return; }
    setCreating(true);
    try {
      await api("adminCreateUser", { token: user?.token, nome: cNome, senha: cSenha }, user);
      toast.success(`Usuário "${cNome}" criado!`);
      setCNome(""); setCSenha("");
      const r = await api("listUsers", { token: user?.token }, user);
      setUsers(r.users || []);
    } catch (e: any) { toast.error(e.message); }
    setCreating(false);
  }

  async function resetPw() {
    if (!rTarget || !newPw) { toast.error("Selecione usuário e nova senha."); return; }
    try {
      await api("resetPassword", { token: user?.token, targetNome: rTarget, novaSenha: newPw }, user);
      toast.success(`Senha de "${rTarget}" redefinida.`);
      setRTarget(""); setNewPw("");
    } catch (e: any) { toast.error(e.message); }
  }

  async function addMachine() {
    if (!mName.trim()) { toast.error("Informe o nome da máquina."); return; }
    setMAdding(true);
    try {
      await api("addMachine", { token: user?.token, name: mName.trim(), hasMeta: true, defaultMeta: Number(mMeta) || 0 }, user);
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
      const r = await api("toggleMachine", { token: user?.token, machineId: mId }, user);
      setAllMachines(prev => prev.map(m => m.id === mId ? { ...m, status: r.newStatus } : m));
      toast.success(`Máquina ${r.newStatus === "ativo" ? "ativada" : "desativada"}.`);
      refreshMachines();
    } catch (e: any) { toast.error(e.message); }
  }

  async function generateInvite() {
    setInviteLoading(true);
    try {
      const r = await api("generateInviteCode", { token: user?.token }, user);
      setInviteCode(r.code);
      toast.success("Código de convite gerado!");
    } catch (e: any) { toast.error(e.message); }
    setInviteLoading(false);
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
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Usuário</label>
                    <select value={rTarget} onChange={e => setRTarget(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      {users.filter(u => u.nome !== user?.nome).map(u => <option key={u.nome}>{u.nome}</option>)}
                    </select>
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
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
