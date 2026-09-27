import { createContext, useContext } from "react";
import type { Session, Machine, ProdRecord, Holiday, OrdemProducao } from "@/lib/api";
import type { RegisterInput } from "@/lib/repositories";
import type { BaseDaMeta } from "@/lib/metas";

export type { OrdemProducao };

export interface MetaInfo {
  updatedBy: string;
  updatedAt: string;
  vigenciaInicio: string;
  /** Como ler o número: ver `src/lib/metas.ts` (D39, D47). */
  basis?: BaseDaMeta;
}

export type { Holiday };

interface AuthContextType {
  user: Session | null;
  machines: Machine[];
  metas: Record<number, number>;
  metasInfo: Record<number, MetaInfo>;
  records: ProdRecord[];
  holidays: Holiday[];
  loading: boolean;
  turnosAtivos: number;
  setTurnosAtivos: (n: number) => void;
  needsOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  login: (nome: string, senha: string, badgeNumber?: string) => Promise<void>;
  /** loggedIn=false no modo Supabase: cadastro enviado, aguardando aprovação (message). */
  register: (input: RegisterInput) => Promise<{ loggedIn: boolean; message?: string }>;
  logout: () => void;
  refreshData: () => Promise<void>;
  silentRefresh: () => Promise<void>;
  refreshMachines: () => Promise<void>;
  refreshMetas: () => Promise<void>;
  refreshHolidays: () => Promise<void>;
  setRecords: React.Dispatch<React.SetStateAction<ProdRecord[]>>;
}

// Exportado para o AuthProvider, que vive em AuthProvider.tsx: um arquivo que
// exporta componente E hook perde o recarregamento a quente (react-refresh).
export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
