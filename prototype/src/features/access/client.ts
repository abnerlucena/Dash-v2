import type { Session } from "../../../../src/lib/api";
import type { DataSource, DataSourceKind } from "../../../../src/lib/repositories/types";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";

/*
 * O que a área de acesso usa da camada de dados. É um recorte do contrato
 * (src/lib/repositories/types.ts) — a tela escreve contra ele, não contra a
 * implementação.
 *
 * Qual fonte:
 * - VITE_DATA_SOURCE definido ("supabase", "gas" ou "mock", no .env.local da
 *   raiz): a camada de dados da sessão do banco, carregada sob demanda. O
 *   "mock" dela só liga em desenvolvimento (nunca num build).
 * - Sem configuração: a fonte de demonstração desta pasta (demoClient.ts), para
 *   o protótipo — inclusive o HTML único, que é um build — abrir sozinho.
 */
export interface AccessClient {
  kind: DataSourceKind | "demo";
  /**
   * Login por e-mail, cadastro com aprovação e permissões (D19–D23)? É a
   * pergunta certa para o formato da tela — não "é Supabase?": o modo de
   * demonstração também entra por e-mail (nota de 01/10, § 6).
   */
  emailAccess: boolean;
  auth: Pick<
    DataSource["auth"],
    "login" | "register" | "logout" | "isSessionValid" | "watchSession" | "requestPasswordReset" | "setNewPassword"
  >;
  users: Pick<
    DataSource["users"],
    "listUsers" | "approveUser" | "listRoles" | "toggleUser" | "listPermissions" | "getPermissions" | "setPermissions"
  >;
  /** Sessão guardada no navegador (mesma chave do app antigo no modo real) */
  store: { load(): Session | null; save(s: Session): void; clear(): void };
  /** Se esta visita veio do link de recuperação de senha, em que tela começa */
  recovery(): EstadoRecuperacao | null;
}

export const configuredSource = import.meta.env.VITE_DATA_SOURCE as string | undefined;

export async function loadAccessClient(): Promise<AccessClient> {
  if (configuredSource === "supabase" || configuredSource === "gas" || configuredSource === "mock") {
    const [repo, api, rec] = await Promise.all([
      import("../../../../src/lib/repositories"),
      import("../../../../src/lib/api"),
      import("../../../../src/lib/recovery"),
    ]);
    // Antes da primeira tela: liga o mock (se for o caso) e tira o token do endereço
    await repo.carregarModoDemonstracao();
    await rec.prepararRecuperacaoDeSenha();
    // `repo.data` é ligação viva: lida depois do carregamento, já é o mock
    const { data } = repo;
    return {
      kind: data.kind,
      emailAccess: repo.usaAcessoPorEmail,
      auth: data.auth,
      users: data.users,
      store: { load: api.loadSession, save: api.saveSession, clear: api.clearSession },
      recovery: rec.recuperacaoEmAndamento,
    };
  }
  const { demoClient } = await import("./demoClient");
  return demoClient;
}
