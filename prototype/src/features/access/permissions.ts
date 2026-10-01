import type { Session } from "../../../../src/lib/api";

/*
 * Catálogo de permissões — é o que chega em `session.permissions` (modo Supabase).
 * Fonte: docs/database/notas/2026-09-27-area-de-acesso-na-ui-nova.md e a tabela
 * `permissions` do banco. Esconder na tela é conveniência: quem impede de verdade
 * é o banco (RLS).
 */
export type Permission =
  | "production.create"
  | "production.edit_own"
  | "production.edit"
  | "production.delete"
  | "production.bulk_edit"
  | "production.bulk_delete"
  | "history.view"
  | "feedbacks.view"
  | "reports.export"
  | "dashboard.view"
  | "targets.view"
  | "tv_mode.view"
  | "machines.manage"
  | "calendar.manage"
  | "alerts.manage"
  | "targets.manage"
  | "users.approve"
  | "system.admin";

/** O que cada permissão libera, em português (tela de Usuários) */
export const PERMISSION_LABEL: Record<Permission, string> = {
  "production.create": "Apontar produção",
  "production.edit_own": "Corrigir o próprio apontamento",
  "production.edit": "Editar apontamentos de qualquer pessoa",
  "production.delete": "Excluir apontamentos",
  "production.bulk_edit": "Editar em lote",
  "production.bulk_delete": "Excluir em lote",
  "history.view": "Ver o histórico",
  "feedbacks.view": "Ver feedbacks e OPs",
  "reports.export": "Exportar relatórios",
  "dashboard.view": "Ver o dashboard",
  "targets.view": "Ver metas",
  "tv_mode.view": "Modo TV",
  "machines.manage": "Gerenciar máquinas",
  "calendar.manage": "Gerenciar calendário",
  "alerts.manage": "Gerenciar alertas",
  "targets.manage": "Alterar metas",
  "users.approve": "Aprovar cadastros e gerenciar usuários",
  "system.admin": "Administrador (tudo)",
};

/**
 * Modo Apps Script (legado): a sessão não traz permissões, só `role`.
 * admin = tudo; user = o que o operador fazia no app antigo.
 */
const LEGACY_USER: Permission[] = [
  "production.create",
  "production.edit_own",
  "history.view",
  "feedbacks.view",
  "dashboard.view",
  "targets.view",
  "tv_mode.view",
  "reports.export",
];

export function can(session: Session | null, permission: Permission): boolean {
  if (!session) return false;
  const list = session.permissions;
  if (!list) return session.role === "admin" || LEGACY_USER.includes(permission);
  return list.includes("system.admin") || list.includes(permission);
}

/**
 * Permissão que cada tela exige. Sem entrada = qualquer pessoa logada (Ajuda).
 * OPs: o catálogo não tem código próprio; a conversa das OPs é a mesma dos
 * feedbacks (o operador não a acessa), então usa `feedbacks.view`.
 */
export const ROUTE_PERMISSION: Record<string, Permission> = {
  dashboard: "dashboard.view",
  "linha-montagem": "dashboard.view",
  "linha-embalagem": "dashboard.view",
  "linha-granel": "dashboard.view",
  "turno-1": "dashboard.view",
  "turno-2": "dashboard.view",
  "turno-3": "dashboard.view",
  ranking: "dashboard.view",
  retrabalho: "dashboard.view",
  apontamento: "production.create",
  ops: "feedbacks.view",
  historico: "history.view",
  metas: "targets.view",
  feedbacks: "feedbacks.view",
  relatorios: "reports.export",
  tv: "tv_mode.view",
  usuarios: "users.approve",
};

export const canOpen = (session: Session | null, route: string) => {
  const p = ROUTE_PERMISSION[route];
  return p ? can(session, p) : !!session;
};

/** Rótulo curto do tipo de acesso, para o menu do usuário */
export function accessLabel(session: Session): string {
  if (session.accountType === "shared") return "Posto compartilhado";
  if (session.accountType === "display") return "Tela de TV";
  if (can(session, "system.admin")) return "Administrador";
  if (can(session, "users.approve")) return "Gestão";
  if (can(session, "targets.manage")) return "Liderança";
  return "Operação";
}
