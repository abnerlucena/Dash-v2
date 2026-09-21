// ─── Autenticação via Supabase Auth (D19–D23) ─────────────────
import { getSupabase } from "@/lib/supabase";
import type { Session } from "@/lib/api";
import type { DataSource, LoginResponse } from "../types";
import { toAuthError, toError } from "./helpers";

const ONBOARDING_KEY = (userId: string) => `onboarding_done_${userId}`;

/** Erro com código, para a tela de login pedir o crachá da conta compartilhada. */
export class BadgeRequiredError extends Error {
  code = "BADGE_REQUIRED" as const;
  constructor() {
    super("Conta compartilhada: informe o nº do seu crachá para continuar.");
  }
}

async function buildSession(): Promise<LoginResponse> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getSession();
  const authSession = auth.session;
  if (!authSession) throw new Error("Sessão não encontrada. Faça login novamente.");

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, full_name, status, account_type")
    .eq("id", authSession.user.id)
    .single();
  if (error || !profile) throw toError(error, "Perfil não encontrado.");

  const { data: permissions, error: permError } = await sb.rpc("my_permissions");
  if (permError) throw toError(permError);
  const perms = permissions || [];

  const session: Session = {
    token: "supabase",              // o token real fica guardado pelo supabase-js
    nome: profile.full_name,
    role: perms.includes("system.admin") ? "admin" : "user",
    expiresAt: authSession.expires_at ? new Date(authSession.expires_at * 1000).toISOString() : undefined,
    source: "supabase",
    userId: profile.id,
    permissions: perms,
    accountType: profile.account_type as Session["accountType"],
  };
  let onboardingDone = true;
  try { onboardingDone = localStorage.getItem(ONBOARDING_KEY(profile.id)) === "1"; } catch { /* sem localStorage */ }
  return { session, onboardingDone };
}

export const supabaseAuth: DataSource["auth"] = {
  async login(email, password, badgeNumber) {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAuthError(error);

    const { data: auth } = await sb.auth.getUser();
    const { data: profile, error: profError } = await sb
      .from("profiles")
      .select("status, account_type, full_name")
      .eq("id", auth.user?.id ?? "")
      .single();
    if (profError || !profile) {
      await sb.auth.signOut();
      throw toError(profError, "Perfil não encontrado.");
    }
    if (profile.status === "pending") {
      await sb.auth.signOut();
      throw new Error("Seu cadastro está aguardando aprovação do gestor.");
    }
    if (profile.status === "blocked") {
      await sb.auth.signOut();
      throw new Error("Usuário bloqueado. Fale com o gestor.");
    }

    // D23: conta compartilhada só ganha permissões depois da identificação por crachá.
    let identifiedName: string | null = null;
    if (profile.account_type === "shared") {
      if (!badgeNumber?.trim()) {
        await sb.auth.signOut();
        throw new BadgeRequiredError();
      }
      const { data, error: idError } = await sb.rpc("identify_shared_session", { p_badge_number: badgeNumber.trim() });
      if (idError) {
        await sb.auth.signOut();
        throw toError(idError);
      }
      identifiedName = data;
    }

    const result = await buildSession();
    if (identifiedName) result.session.nome = `${identifiedName} (${profile.full_name})`;
    return result;
  },

  async register({ nome, senha, email, badgeNumber }) {
    const sb = getSupabase();
    if (!email?.trim()) throw new Error("Informe o e-mail.");
    if (!badgeNumber?.trim()) throw new Error("Informe o nº do crachá.");
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { full_name: nome.trim(), badge_number: badgeNumber.trim() } },
    });
    if (error) throw toAuthError(error);
    // O cadastro nasce "pendente" (D20): mesmo que o Supabase já devolva uma
    // sessão, a pessoa só entra depois da aprovação do gestor.
    if (data.session) await sb.auth.signOut();
    return {
      loggedIn: false,
      message: data.session
        ? "Cadastro enviado! Aguarde a aprovação do gestor para entrar."
        : "Cadastro enviado! Confirme o e-mail (veja a caixa de entrada) e aguarde a aprovação do gestor.",
    };
  },

  async logout() {
    try { await getSupabase().auth.signOut(); } catch { /* sem conexão: a sessão local é limpa mesmo assim */ }
  },

  async completeOnboarding(session) {
    if (!session?.userId) return;
    try { localStorage.setItem(ONBOARDING_KEY(session.userId), "1"); } catch { /* sem localStorage */ }
  },

  async isSessionValid(session) {
    if (session.source !== "supabase") return false;
    const { data } = await getSupabase().auth.getSession();
    return !!data.session && data.session.user.id === session.userId;
  },
};
