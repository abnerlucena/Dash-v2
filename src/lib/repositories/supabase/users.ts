// ─── Usuários, aprovação e alertas ────────────────────────────
import { getSupabase } from "@/lib/supabase";
import type { AdminUser, DataSource } from "../types";
import { PROFILE_STATUS_TO_LEGACY } from "./adapters";
import { toError } from "./helpers";

const notAvailable = (what: string) => new Error(`${what} não existe no modo Supabase.`);

export const supabaseUsers: DataSource["users"] = {
  async listUsers() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, badge_number, account_type, status, created_at, roles(code, name)")
      .order("status", { ascending: false })   // pending primeiro
      .order("full_name");
    if (error) throw toError(error);
    const users: AdminUser[] = (data || []).map(p => {
      const role = p.roles as { code: string; name: string } | null;
      return {
        id: p.id,
        nome: p.full_name,
        status: PROFILE_STATUS_TO_LEGACY[p.status] ?? p.status,
        role: role && ["manager", "admin"].includes(role.code) ? "admin" : "user",
        roleName: role?.name ?? null,
        badgeNumber: p.badge_number,
        accountType: p.account_type,
      };
    });
    return { users };
  },

  // Alterna entre ativo e bloqueado. Cadastro pendente se aprova com approveUser.
  async toggleUser(target) {
    if (!target.id) throw new Error("Usuário sem identificador.");
    if (target.status === "pendente") throw new Error("Cadastro pendente: use \"Aprovar\".");
    const next = target.status === "ativo" ? "blocked" : "active";
    const { data, error } = await getSupabase().from("profiles").update({ status: next }).eq("id", target.id).select("id");
    if (error) throw toError(error);
    if (!data || data.length === 0) throw new Error("Você não tem permissão para alterar usuários.");
    return { newStatus: PROFILE_STATUS_TO_LEGACY[next] };
  },

  // A criação de contas e a troca de senha pelo gestor exigiriam a chave
  // service_role, que nunca pode ir para o navegador (D19). No modo Supabase
  // cada pessoa se cadastra pela tela de login e o gestor aprova (D20).
  async adminCreateUser() { throw notAvailable("Criar usuário pelo painel"); },
  async resetPassword() { throw notAvailable("Redefinir senha pelo painel"); },
  async generateInviteCode() { throw notAvailable("Código de convite"); },

  async approveUser(userId, roleId) {
    const { error } = await getSupabase().rpc("approve_user", { p_user_id: userId, p_role_id: roleId });
    if (error) throw toError(error);
  },

  async listRoles() {
    const { data, error } = await getSupabase().from("roles").select("id, code, name").order("id");
    if (error) throw toError(error);
    return data || [];
  },
};

// Alertas por e-mail não fazem parte do desenho do banco (e também não
// existem no Main.gs atual). A tela mostra o aviso de indisponível.
export const supabaseAlerts: DataSource["alerts"] = {
  async getAlertConfig() { throw notAvailable("Configuração de alertas"); },
  async saveAlertConfig() { throw notAvailable("Configuração de alertas"); },
  async testAlertEmail() { throw notAvailable("E-mail de teste de alertas"); },
};
