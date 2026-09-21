// ─── Implementação GAS (Google Apps Script) ───────────────────
// Repassa cada operação para o api() atual com EXATAMENTE o mesmo payload que
// as telas enviavam antes da camada de dados existir. É o modo padrão.
import { api, type Session } from "@/lib/api";
import type { DataSource } from "./types";

const toSession = (raw: { token: string; nome: string; role: Session["role"]; expiresAt?: string }): Session => ({
  token:     raw.token,
  nome:      raw.nome,
  role:      raw.role,
  expiresAt: raw.expiresAt,
});

export const gasDataSource: DataSource = {
  kind: "gas",

  auth: {
    async login(nome, senha) {
      const r = await api("login", { nome, senha });
      const onboardingPending = r.session.onboardingDone === false || r.session.onboardingDone === "false";
      return { session: toSession(r.session), onboardingDone: !onboardingPending };
    },
    async register({ nome, senha, inviteCode }) {
      const r = await api("register", { nome, senha, inviteCode });
      return { loggedIn: true, session: toSession(r.session), onboardingDone: true };
    },
    async logout() { /* sessão do GAS é só local: nada a fazer no servidor */ },
    async completeOnboarding(session) { await api("completeOnboarding", {}, session); },
    async isSessionValid() { return true; },
  },

  production: {
    getAll: (session) => api("getAll", {}, session),
    async saveEntries(records, _options, session) { await api("upsert", { records }, session); },
    async updateObs(r, obs, session) {
      const nowBR = new Date().toLocaleString("pt-BR");
      await api("upsert", {
        records: [{
          date: r.date,
          turno: r.turno,
          machineId: r.machineId,
          machineName: r.machineName,
          meta: r.meta,
          producao: r.producao,
          savedBy: r.savedBy,
          savedAt: r.savedAt || "",
          obs,
          editUser: session?.nome || "",
          editTime: nowBR,
        }],
      }, session);
    },
    async bulkDelete(ids, session) { await api("bulkDelete", { ids }, session); },
    async bulkMove(ids, newDate, session) { await api("bulkMove", { ids, newDate }, session); },
    async bulkEditTurno(ids, newTurno, session) { await api("bulkEditTurno", { ids, newTurno }, session); },
  },

  machines: {
    getMachines: (session) => api("getMachines", {}, session),
    async addMachine(name, defaultMeta, session) {
      await api("addMachine", { name, hasMeta: true, defaultMeta }, session);
    },
    toggleMachine: (machineId, session) => api("toggleMachine", { machineId }, session),
  },

  targets: {
    getMetas: (session) => api("getMetas", {}, session),
    async saveMetas(metas, vigenciaInicio, session) { await api("saveMetas", { metas, vigenciaInicio }, session); },
    async getHistory() { return []; },
  },

  calendar: {
    getHolidays: (session) => api("getHolidays", {}, session),
    async addHoliday(date, label, type, session) { await api("addHoliday", { date, label, type }, session); },
    async removeHoliday(id, session) { await api("removeHoliday", { id }, session); },
  },

  users: {
    listUsers: (session) => api("listUsers", {}, session),
    toggleUser: (target, session) => api("toggleUser", { targetNome: target.nome }, session),
    async adminCreateUser(nome, senha, session) { await api("adminCreateUser", { nome, senha }, session); },
    async resetPassword(targetNome, novaSenha, session) { await api("resetPassword", { targetNome, novaSenha }, session); },
    generateInviteCode: (session) => api("generateInviteCode", {}, session),
    async approveUser() { throw new Error("Aprovação de cadastro só existe no modo Supabase."); },
    async listRoles() { return []; },
  },

  alerts: {
    getAlertConfig: (session) => api("getAlertConfig", {}, session),
    async saveAlertConfig(config, session) { await api("saveAlertConfig", { config }, session); },
    async testAlertEmail(session) { await api("testAlertEmail", {}, session); },
  },
};
