import type { Session } from "../../../../src/lib/api";
import type { AdminUser, RoleOption } from "../../../../src/lib/repositories/types";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";
import { storageGet, storageSet } from "@/lib/utils";
import type { AccessClient } from "./client";
import type { Permission } from "./permissions";

/*
 * Fonte de DEMONSTRAÇÃO da área de acesso: roda sem Supabase, em memória.
 * Cobre os estados que a tela precisa mostrar (pendente, bloqueado, conta
 * compartilhada com crachá, TV, link de recuperação válido e expirado) e usa
 * as MESMAS mensagens de erro da implementação real
 * (src/lib/repositories/supabase/auth.ts).
 *
 * Nada aqui é regra de negócio: as permissões de cada perfil-modelo são uma
 * aproximação para a demonstração. Os perfis reais vêm do banco (listRoles).
 * Se a sessão do banco entregar uma fonte de mentira própria, esta sai.
 */

const ROLES: Array<RoleOption & { permissions: Permission[]; accountType?: Session["accountType"] }> = [
  {
    id: 1,
    code: "operator",
    name: "Operador",
    permissions: ["production.create", "production.edit_own", "dashboard.view", "targets.view", "tv_mode.view"],
  },
  {
    id: 2,
    code: "setter",
    name: "Preparador",
    permissions: [
      "production.create",
      "production.edit_own",
      "history.view",
      "feedbacks.view",
      "dashboard.view",
      "targets.view",
      "tv_mode.view",
    ],
  },
  {
    id: 3,
    code: "distributor",
    name: "Distribuidor",
    permissions: ["history.view", "feedbacks.view", "dashboard.view", "targets.view", "tv_mode.view"],
  },
  {
    id: 4,
    code: "technician",
    name: "Técnico",
    permissions: ["history.view", "feedbacks.view", "dashboard.view", "targets.view", "machines.manage", "tv_mode.view"],
  },
  {
    id: 5,
    code: "manager",
    name: "Gestor",
    permissions: [
      "production.create",
      "production.edit_own",
      "production.edit",
      "production.delete",
      "production.bulk_edit",
      "production.bulk_delete",
      "history.view",
      "feedbacks.view",
      "reports.export",
      "dashboard.view",
      "targets.view",
      "tv_mode.view",
      "machines.manage",
      "calendar.manage",
      "alerts.manage",
      "targets.manage",
      "users.approve",
    ],
  },
  { id: 6, code: "shared_admin", name: "Admin (conta compartilhada)", permissions: ["system.admin"], accountType: "shared" },
  { id: 7, code: "tv", name: "TV", permissions: ["tv_mode.view"], accountType: "display" },
];

interface DemoUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  badgeNumber: string | null;
  roleId: number | null;
  status: "ativo" | "bloqueado" | "pendente";
}

/** Senha de todas as contas de demonstração */
export const DEMO_PASSWORD = "demo123";

/** Contas prontas para experimentar cada estado (aparecem na tela de entrar) */
export const DEMO_ACCOUNTS = [
  { email: "gestor@demo.weg", what: "Gestor: tudo, inclusive aprovar cadastros" },
  { email: "operador@demo.weg", what: "Operador: aponta e vê o dashboard" },
  { email: "posto@demo.weg", what: "Conta compartilhada: pede o nº do crachá (use 1001)" },
  { email: "tv@demo.weg", what: "Tela de TV: abre direto no Modo TV" },
  { email: "pendente@demo.weg", what: "Cadastro aguardando aprovação" },
  { email: "bloqueado@demo.weg", what: "Usuário bloqueado" },
];

const users: DemoUser[] = [
  { id: "u1", nome: "Rafael Souza", email: "gestor@demo.weg", senha: DEMO_PASSWORD, badgeNumber: "1000", roleId: 5, status: "ativo" },
  { id: "u2", nome: "Camila Duarte", email: "operador@demo.weg", senha: DEMO_PASSWORD, badgeNumber: "1001", roleId: 1, status: "ativo" },
  { id: "u3", nome: "Posto da Montagem", email: "posto@demo.weg", senha: DEMO_PASSWORD, badgeNumber: null, roleId: 6, status: "ativo" },
  { id: "u4", nome: "TV da Embalagem", email: "tv@demo.weg", senha: DEMO_PASSWORD, badgeNumber: null, roleId: 7, status: "ativo" },
  {
    id: "u5",
    nome: "Bruno Teixeira",
    email: "pendente@demo.weg",
    senha: DEMO_PASSWORD,
    badgeNumber: "1002",
    roleId: null,
    status: "pendente",
  },
  {
    id: "u6",
    nome: "Eduardo Farias",
    email: "bloqueado@demo.weg",
    senha: DEMO_PASSWORD,
    badgeNumber: "1003",
    roleId: 2,
    status: "bloqueado",
  },
  {
    id: "u7",
    nome: "Juliana Martins",
    email: "juliana@demo.weg",
    senha: DEMO_PASSWORD,
    badgeNumber: "1004",
    roleId: null,
    status: "pendente",
  },
  { id: "u8", nome: "Thiago Barros", email: "thiago@demo.weg", senha: DEMO_PASSWORD, badgeNumber: "1005", roleId: 2, status: "ativo" },
];

const wait = (ms = 450) => new Promise((r) => window.setTimeout(r, ms));
const roleOf = (u: DemoUser) => ROLES.find((r) => r.id === u.roleId);

class DemoBadgeRequired extends Error {
  code = "BADGE_REQUIRED" as const;
  constructor() {
    super("Informe o nº do crachá para entrar nesta conta compartilhada.");
  }
}

function sessionFor(u: DemoUser, operator?: DemoUser): Session {
  const role = roleOf(u)!;
  return {
    token: `demo-${u.id}-${Date.now()}`,
    // Conta compartilhada: quem aponta é a pessoa do crachá
    nome: operator ? operator.nome : u.nome,
    role: role.permissions.includes("system.admin") || role.permissions.includes("users.approve") ? "admin" : "user",
    source: "supabase",
    userId: u.id,
    permissions: role.permissions,
    accountType: role.accountType ?? "personal",
  };
}

const toAdmin = (u: DemoUser): AdminUser => ({
  id: u.id,
  nome: u.nome,
  status: u.status,
  badgeNumber: u.badgeNumber,
  roleName: roleOf(u)?.name ?? null,
  accountType: roleOf(u)?.accountType ?? "personal",
  role: roleOf(u)?.permissions.includes("users.approve") ? "admin" : "user",
});

/* Simulação do link do e-mail de recuperação (só na demonstração) */
let recovery: EstadoRecuperacao | null = null;
export function simulateRecoveryLink(kind: "valid" | "expired") {
  recovery = kind === "valid" ? { tela: "novaSenha" } : { tela: "recuperar", erro: "O link de recuperação expirou. Peça um novo e-mail." };
}

const KEY = "dash-proto.session";

export const demoClient: AccessClient = {
  kind: "demo",
  emailAccess: true,
  auth: {
    async login(identifier, password, badgeNumber) {
      await wait();
      const u = users.find((x) => x.email.toLowerCase() === identifier.trim().toLowerCase());
      if (!u || u.senha !== password) throw new Error("E-mail ou senha incorretos.");
      if (u.status === "pendente") throw new Error("Seu cadastro está aguardando aprovação do gestor.");
      if (u.status === "bloqueado") throw new Error("Usuário bloqueado. Fale com o gestor.");
      if (roleOf(u)?.accountType === "shared") {
        if (!badgeNumber?.trim()) throw new DemoBadgeRequired();
        const operator = users.find((x) => x.badgeNumber === badgeNumber.trim() && x.status === "ativo");
        if (!operator) throw new Error("Crachá não encontrado ou sem cadastro ativo.");
        return { session: sessionFor(u, operator), onboardingDone: true };
      }
      return { session: sessionFor(u), onboardingDone: true };
    },
    async register({ nome, senha, email, badgeNumber }) {
      await wait();
      if (!email?.trim()) throw new Error("Informe o e-mail.");
      if (!badgeNumber?.trim()) throw new Error("Informe o nº do crachá.");
      if (users.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error("Já existe uma conta com este e-mail.");
      users.push({
        id: `u${users.length + 1}`,
        nome: nome.trim(),
        email: email.trim(),
        senha,
        badgeNumber: badgeNumber.trim(),
        roleId: null,
        status: "pendente",
      });
      return { loggedIn: false, message: "Cadastro enviado. Um gestor precisa aprovar antes do primeiro acesso." };
    },
    async logout() {
      await wait(150);
    },
    async isSessionValid(session) {
      return users.some((u) => u.id === session.userId && u.status === "ativo");
    },
    watchSession() {
      // Na demonstração não há login compartilhado entre abas
      return () => {};
    },
    async requestPasswordReset(email) {
      await wait();
      if (!email.trim()) throw new Error("Informe o e-mail da sua conta.");
    },
    async setNewPassword(newPassword) {
      await wait();
      if (newPassword.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      recovery = null;
    },
  },
  users: {
    async listUsers() {
      await wait(300);
      return { users: users.map(toAdmin) };
    },
    async listRoles() {
      return ROLES.map(({ id, code, name }) => ({ id, code, name }));
    },
    async approveUser(userId, roleId) {
      await wait();
      const u = users.find((x) => x.id === userId);
      if (!u) throw new Error("Usuário não encontrado.");
      u.roleId = roleId;
      u.status = "ativo";
    },
    async toggleUser(target) {
      await wait();
      const u = users.find((x) => x.id === target.id);
      if (!u) throw new Error("Usuário não encontrado.");
      u.status = u.status === "bloqueado" ? "ativo" : "bloqueado";
      return { newStatus: u.status };
    },
  },
  store: {
    load: () => storageGet<Session | null>(KEY, null),
    save: (s) => storageSet(KEY, s),
    clear: () => storageSet(KEY, null),
  },
  recovery: () => recovery,
};
