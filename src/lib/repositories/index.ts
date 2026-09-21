// ─── Fachada da camada de dados ───────────────────────────────
// Ponto único que as telas e o AuthContext usam para ler e gravar dados.
//
// Chave liga/desliga: variável de ambiente VITE_DATA_SOURCE
//   "gas"      → Google Apps Script + planilhas (PADRÃO; comportamento de hoje)
//   "supabase" → banco Supabase (precisa de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
// Qualquer outro valor, ou a variável ausente, cai no "gas".
import type { DataSource, DataSourceKind } from "./types";
import { gasDataSource } from "./gas";
import { supabaseDataSource } from "./supabase";

export const DATA_SOURCE: DataSourceKind =
  import.meta.env.VITE_DATA_SOURCE === "supabase" ? "supabase" : "gas";

export const isSupabase = DATA_SOURCE === "supabase";

export const data: DataSource = isSupabase ? supabaseDataSource : gasDataSource;

export { BadgeRequiredError } from "./supabase";
export type * from "./types";
