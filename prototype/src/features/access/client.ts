import type { Session } from "../../../../src/lib/api";
import type { DataSource } from "../../../../src/lib/repositories/types";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";

/*
 * O que a área de acesso usa da camada de dados. É um recorte do contrato
 * (src/lib/repositories/types.ts) — a tela escreve contra ele, não contra a
 * implementação.
 *
 * Qual fonte:
 * - VITE_DATA_SOURCE definido ("supabase" ou "gas", no .env.local da raiz):
 *   a camada de dados real, carregada sob demanda (o Supabase não entra no
 *   pacote de quem não usa).
 * - Sem configuração: a fonte de demonstração (demoClient.ts), para o protótipo
 *   continuar abrindo sozinho, como as outras telas.
 */
export interface AccessClient {
  kind: "demo" | "gas" | "supabase";
  auth: Pick<
    DataSource["auth"],
    "login" | "register" | "logout" | "isSessionValid" | "watchSession" | "requestPasswordReset" | "setNewPassword"
  >;
  users: Pick<DataSource["users"], "listUsers" | "approveUser" | "listRoles" | "toggleUser">;
  /** Sessão guardada no navegador (mesma chave do app antigo no modo real) */
  store: { load(): Session | null; save(s: Session): void; clear(): void };
  /** Se esta visita veio do link de recuperação de senha, em que tela começa */
  recovery(): EstadoRecuperacao | null;
}

export const configuredSource = import.meta.env.VITE_DATA_SOURCE as string | undefined;

export async function loadAccessClient(): Promise<AccessClient> {
  if (configuredSource === "supabase" || configuredSource === "gas") {
    const [{ data }, api, rec] = await Promise.all([
      import("../../../../src/lib/repositories"),
      import("../../../../src/lib/api"),
      import("../../../../src/lib/recovery"),
    ]);
    // Precisa rodar antes da primeira tela: tira o token do endereço (ver recovery.ts)
    await rec.prepararRecuperacaoDeSenha();
    return {
      kind: data.kind,
      auth: data.auth,
      users: data.users,
      store: { load: api.loadSession, save: api.saveSession, clear: api.clearSession },
      recovery: rec.recuperacaoEmAndamento,
    };
  }
  const { demoClient } = await import("./demoClient");
  return demoClient;
}
