// ─── Contrato da camada de dados ──────────────────────────────
// Uma operação por ação que o Apps Script oferece hoje. Existem duas
// implementações: `gas.ts` (repassa para o api() atual, com o MESMO payload)
// e `supabase/` (fala com o banco novo). A fachada em `index.ts` escolhe
// uma delas pela variável VITE_DATA_SOURCE.
//
// As respostas mantêm o formato das respostas do Apps Script, para que as
// telas não precisem ser reescritas agora.
import type { Session, Machine, Holiday, ProdRecord, OrdemProducao } from "@/lib/api";

export type DataSourceKind = "gas" | "supabase";

export interface MetaInfoRaw {
  updatedBy: string;
  updatedAt: string;
  vigenciaInicio: string;
}

export interface LoginResponse {
  session: Session;
  onboardingDone: boolean;
}

export interface RegisterInput {
  nome: string;
  senha: string;
  inviteCode?: string;   // GAS
  email?: string;        // Supabase
  badgeNumber?: string;  // Supabase
}

/** Resultado do cadastro: com sessão (GAS entra direto) ou aguardando aprovação (Supabase). */
export type RegisterResponse =
  | { loggedIn: true; session: Session; onboardingDone: boolean }
  | { loggedIn: false; message: string };

/** Linha de apontamento enviada pela tela de Apontamento (formato do legado). */
export interface ProductionEntryPayload {
  date: string;
  turno: string;
  machineId: number;
  machineName: string;
  meta: number;
  producao: number;
  ordensProducao: OrdemProducao[];
  savedBy: string;
  savedAt: string;
  obs: string;
  /** Só modo Supabase: nº de operadores do turno (D12). Vazio = lotação padrão. */
  operatorCount?: number;
}

export interface SaveEntriesOptions {
  /** Só modo Supabase: 'overtime' marca o lote como hora extra (D27). */
  workMode?: "regular" | "overtime";
}

export interface AdminUser {
  nome: string;
  status: string;          // "ativo" | "bloqueado" | "pendente"
  role?: string;           // "admin" | "user"
  // Modo Supabase
  id?: string;
  badgeNumber?: string | null;
  roleName?: string | null;
  accountType?: string;
}

export interface RoleOption {
  id: number;
  code: string;
  name: string;
}

export interface TargetHistoryItem {
  machineId: number;
  quantity: number;
  validFrom: string;
  createdBy: string;
  createdAt: string;
}

/** Configuração de alertas no formato do Apps Script (campos podem vir como texto). */
export interface AlertConfigRaw {
  active?: boolean | string;
  recipientEmail?: string;
  thresholdPct?: number | string;
  machines?: Array<number | string>;
  frequency?: string;
}

export interface DataSource {
  kind: DataSourceKind;

  auth: {
    login(identifier: string, password: string, badgeNumber?: string): Promise<LoginResponse>;
    register(input: RegisterInput): Promise<RegisterResponse>;
    logout(session: Session | null): Promise<void>;
    completeOnboarding(session: Session | null): Promise<void>;
    /** Confere se a sessão salva ainda vale (Supabase). No GAS sempre true. */
    isSessionValid(session: Session): Promise<boolean>;
  };

  production: {
    getAll(session: Session | null): Promise<{ data: ProdRecord[] | unknown[] }>;
    saveEntries(entries: ProductionEntryPayload[], options: SaveEntriesOptions, session: Session | null): Promise<void>;
    updateObs(record: ProdRecord, obs: string, session: Session | null): Promise<void>;
    bulkDelete(ids: string[], session: Session | null): Promise<void>;
    bulkMove(ids: string[], newDate: string, session: Session | null): Promise<void>;
    bulkEditTurno(ids: string[], newTurno: string, session: Session | null): Promise<void>;
  };

  machines: {
    getMachines(session: Session | null): Promise<{ machines?: Machine[]; allMachines?: Machine[] }>;
    addMachine(name: string, defaultMeta: number, session: Session | null): Promise<void>;
    toggleMachine(machineId: number, session: Session | null): Promise<{ newStatus: string }>;
  };

  targets: {
    getMetas(session: Session | null): Promise<{ metas?: Record<number, number>; metasInfo?: Record<number, MetaInfoRaw> }>;
    saveMetas(metas: Record<string, number>, vigenciaInicio: string, session: Session | null): Promise<void>;
    /** Só Supabase: histórico de metas (D13). No GAS devolve lista vazia. */
    getHistory(session: Session | null): Promise<TargetHistoryItem[]>;
  };

  calendar: {
    getHolidays(session: Session | null): Promise<{ holidays?: Holiday[] | unknown[] }>;
    addHoliday(date: string, label: string, type: Holiday["type"], session: Session | null, shiftIds?: number[]): Promise<void>;
    removeHoliday(id: string, session: Session | null): Promise<void>;
  };

  users: {
    listUsers(session: Session | null): Promise<{ users?: AdminUser[] }>;
    toggleUser(target: AdminUser, session: Session | null): Promise<{ newStatus: string }>;
    adminCreateUser(nome: string, senha: string, session: Session | null): Promise<void>;
    resetPassword(targetNome: string, novaSenha: string, session: Session | null): Promise<void>;
    generateInviteCode(session: Session | null): Promise<{ code: string }>;
    /** Só Supabase (D20/D22). */
    approveUser(userId: string, roleId: number, session: Session | null): Promise<void>;
    listRoles(session: Session | null): Promise<RoleOption[]>;
  };

  alerts: {
    getAlertConfig(session: Session | null): Promise<{ config?: AlertConfigRaw }>;
    saveAlertConfig(config: AlertConfigRaw, session: Session | null): Promise<void>;
    testAlertEmail(session: Session | null): Promise<void>;
  };
}
