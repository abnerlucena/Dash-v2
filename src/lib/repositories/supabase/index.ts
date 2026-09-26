// ─── Implementação Supabase ───────────────────────────────────
import type { DataSource } from "../types";
import { supabaseAuth } from "./auth";
import { supabaseProduction } from "./production";
import { supabaseCalendar, supabaseMachines, supabaseTargets } from "./catalog";
import { supabaseAlerts, supabaseUsers } from "./users";

export const supabaseDataSource: DataSource = {
  kind: "supabase",
  auth: supabaseAuth,
  production: supabaseProduction,
  machines: supabaseMachines,
  targets: supabaseTargets,
  calendar: supabaseCalendar,
  users: supabaseUsers,
  alerts: supabaseAlerts,
};

export { BadgeRequiredError } from "./auth";
