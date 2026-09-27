// ─── Fachada da camada de dados ───────────────────────────────
// Ponto único que as telas e o AuthContext usam para ler e gravar dados.
//
// Chave liga/desliga: variável de ambiente VITE_DATA_SOURCE
//   "gas"      → Google Apps Script + planilhas (PADRÃO; comportamento de hoje)
//   "supabase" → banco Supabase (precisa de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
//   "mock"     → dados de mentira para construir telas (ver ./mock/index.ts).
//                Só em desenvolvimento: um build de produção nunca liga o mock.
// Qualquer outro valor, ou a variável ausente, cai no "gas".
import type { DataSource, DataSourceKind } from "./types";
import { gasDataSource } from "./gas";
import { supabaseDataSource } from "./supabase";
import { mockDataSource } from "./mock";

function escolher(): DataSourceKind {
  const pedido = import.meta.env.VITE_DATA_SOURCE;
  if (pedido === "supabase") return "supabase";
  // import.meta.env.DEV é falso em qualquer `vite build`: esquecer a variável
  // num .env nunca publica o site com contas de mentira.
  if (pedido === "mock" && import.meta.env.DEV) return "mock";
  return "gas";
}

export const DATA_SOURCE: DataSourceKind = escolher();

export const isSupabase = DATA_SOURCE === "supabase";
export const isMock = DATA_SOURCE === "mock";
/** Modos com login por e-mail, cadastro com aprovação e permissões (D19–D23). */
export const usaAcessoPorEmail = isSupabase || isMock;

const FONTES: Record<DataSourceKind, DataSource> = {
  gas: gasDataSource,
  supabase: supabaseDataSource,
  mock: mockDataSource,
};
export const data: DataSource = FONTES[DATA_SOURCE];

if (isMock) console.warn("[dados] Modo de demonstração (mock): contas e senhas são de mentira. Ver src/lib/repositories/mock/contas.ts.");

export { BadgeRequiredError } from "./supabase";
export type * from "./types";
