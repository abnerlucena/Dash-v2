// ─── Teste de integração: camada de dados Supabase × banco real ──
// NÃO roda no `npm run test` (precisa de rede e de usuários de teste).
// Rodar com:  npm run test:integration
// Variáveis necessárias (fora do repositório):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (no .env.local)
//   TEST_MANAGER_EMAIL,  TEST_MANAGER_PASSWORD   (usuário com perfil Gestor)
//   TEST_OPERATOR_EMAIL, TEST_OPERATOR_PASSWORD  (usuário com perfil Operador)
// O teste cria dados próprios (máquina 18, TURNO 3, hora extra, e um evento
// em 01/01/2099) e os apaga no final.
import { describe, it, expect, afterAll } from "vitest";
import { supabaseDataSource as ds } from "@/lib/repositories/supabase";
import { getSupabase } from "@/lib/supabase";
import type { ProdRecord } from "@/lib/api";

const env = process.env;
const ready = !!(env.TEST_MANAGER_EMAIL && env.TEST_MANAGER_PASSWORD && env.TEST_OPERATOR_EMAIL && env.TEST_OPERATOR_PASSWORD);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const MACHINE = 18;
const mine = (records: ProdRecord[]) =>
  records.filter(r => r.machineId === MACHINE && r.date === today && r.workMode === "overtime");

describe.skipIf(!ready)("modo Supabase contra o banco real", () => {
  let createdId: string | undefined;

  afterAll(async () => {
    // Limpeza de segurança, caso algum passo tenha falhado no meio.
    try {
      await ds.auth.login(env.TEST_MANAGER_EMAIL!, env.TEST_MANAGER_PASSWORD!);
      const all = (await ds.production.getAll(null)).data as ProdRecord[];
      const ids = mine(all).map(r => r.id!).filter(Boolean);
      if (ids.length) await ds.production.bulkDelete(ids, null);
      const hol = ((await ds.calendar.getHolidays(null)).holidays || []) as { id: string; date: string }[];
      for (const h of hol.filter(h => h.date === "2099-01-01")) await ds.calendar.removeHoliday(h.id, null);
    } finally {
      await ds.auth.logout(null);
    }
  });

  it("gestor: login monta a sessão com as permissões do banco", async () => {
    const { session } = await ds.auth.login(env.TEST_MANAGER_EMAIL!, env.TEST_MANAGER_PASSWORD!);
    expect(session.source).toBe("supabase");
    expect(session.role).toBe("admin");
    expect(session.permissions).toContain("targets.manage");
    expect(await ds.auth.isSessionValid(session)).toBe(true);
  });

  it("gestor: lê máquinas, metas, calendário e todos os apontamentos (com paginação)", async () => {
    const m = await ds.machines.getMachines(null);
    expect(m.allMachines?.length).toBeGreaterThanOrEqual(18);
    const t = await ds.targets.getMetas(null);
    expect(Object.keys(t.metas || {}).length).toBeGreaterThanOrEqual(18);
    expect((await ds.targets.getHistory(null)).length).toBeGreaterThanOrEqual(18);

    const all = (await ds.production.getAll(null)).data as ProdRecord[];
    const { count } = await getSupabase().from("production_orders").select("*", { count: "exact", head: true });
    const ordersLoaded = all.reduce((s, r) => s + (r.ordensProducao?.length ?? 0), 0);
    expect(ordersLoaded).toBe(count);            // > 1.000 ordens: prova a paginação
    const r = all.find(x => x.workMode === "regular" && (x.reworkQuantity ?? 0) > 0);
    if (r) {
      expect(r.producao).toBe(r.goodQuantity);   // D11: produção boa
      const retr = r.ordensProducao!.filter(o => o.retrabalho).reduce((s, o) => s + o.quantidade, 0);
      expect(retr).toBe(r.reworkQuantity);
    }
    expect(all.filter(x => x.workMode === "overtime").every(x => x.meta === 0)).toBe(true); // D27
  });

  it("gestor: lista usuários e perfis", async () => {
    const u = await ds.users.listUsers(null);
    expect((u.users || []).some(x => x.nome === "Operador Teste (noturno)")).toBe(true);
    expect((await ds.users.listRoles(null)).length).toBe(7);
    await ds.auth.logout(null);
  });

  it("operador: aponta hora extra, completa o próprio e vê só o que é dele", async () => {
    const { session } = await ds.auth.login(env.TEST_OPERATOR_EMAIL!, env.TEST_OPERATOR_PASSWORD!);
    expect(session.permissions).toEqual(["production.create", "production.edit_own"]);
    const entry = {
      date: today, turno: "TURNO 3", machineId: MACHINE, machineName: "", meta: 0, producao: 0,
      savedBy: "", savedAt: "", obs: "", operatorCount: 1,
      ordensProducao: [
        { ordemId: "000009990001", quantidade: 120 },
        { ordemId: "000009990002", quantidade: 30, retrabalho: true },
      ],
    };
    await ds.production.saveEntries([entry], { workMode: "overtime" }, null);
    await ds.production.saveEntries([{ ...entry, ordensProducao: [{ ordemId: "000009990003", quantidade: 50 }] }], { workMode: "overtime" }, null);

    const all = (await ds.production.getAll(null)).data as ProdRecord[];
    expect(all.every(r => r.savedBy === "Operador Teste (noturno)")).toBe(true); // só os próprios (D33)
    const [rec] = mine(all);
    expect(rec).toBeDefined();
    createdId = rec.id;
    expect(rec.ordensProducao).toHaveLength(3);   // D30: acrescentou
    expect(rec.producao).toBe(170);                // boa = 120 + 50
    expect(rec.reworkQuantity).toBe(30);
    expect(rec.meta).toBe(0);                      // hora extra fora da meta
    expect(rec.operatorCount).toBe(1);
  });

  it("operador: é barrado em ação em massa e em metas", async () => {
    await expect(ds.production.bulkDelete([createdId!], null)).rejects.toThrow(/permissão/i);
    await expect(ds.targets.saveMetas({ [MACHINE]: 999 }, today, null)).rejects.toThrow(/permissão/i);
    await expect(ds.machines.toggleMachine(MACHINE, null)).rejects.toThrow(/permissão/i);
    await ds.auth.logout(null);
  });

  it("gestor: edita observação, troca turno em massa, cria/remove evento por turno e apaga", async () => {
    await ds.auth.login(env.TEST_MANAGER_EMAIL!, env.TEST_MANAGER_PASSWORD!);
    let all = (await ds.production.getAll(null)).data as ProdRecord[];
    let [rec] = mine(all);
    await ds.production.updateObs(rec, "Teste de integração", null);
    await ds.production.bulkEditTurno([rec.id!], "TURNO 2", null);
    all = (await ds.production.getAll(null)).data as ProdRecord[];
    rec = all.find(r => r.id === createdId)!;
    expect(rec.obs).toBe("Teste de integração");
    expect(rec.turno).toBe("TURNO 2");
    expect(rec.editUser).toBe("Gestor Teste (noturno)");

    await ds.calendar.addHoliday("2099-01-01", "Evento de teste", "dia_anulado", null, [2]);
    const hol = ((await ds.calendar.getHolidays(null)).holidays || []) as { id: string; date: string; shiftIds?: number[]; type: string }[];
    const ev = hol.find(h => h.date === "2099-01-01")!;
    expect(ev.type).toBe("dia_anulado");
    expect(ev.shiftIds).toEqual([2]);
    await ds.calendar.removeHoliday(ev.id, null);

    await ds.production.bulkDelete([rec.id!], null);
    all = (await ds.production.getAll(null)).data as ProdRecord[];
    expect(all.some(r => r.id === createdId)).toBe(false);
  });

  it("login errado e cadastro pendente dão mensagens em português", async () => {
    await ds.auth.logout(null);
    await expect(ds.auth.login(env.TEST_OPERATOR_EMAIL!, "senha-errada-123")).rejects.toThrow("E-mail ou senha incorretos.");
  });
});
