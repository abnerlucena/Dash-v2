// A meta e a base valem POR DATA (D13, D47), e o apontamento guarda a foto do
// seu dia (D08). Quem lança um turno atrasado precisa da meta daquele dia —
// usar a de hoje grava uma foto errada, e meta antiga não se reescreve.
//
// Aqui se testa a regra de escolha do degrau: de todos os que já começaram na
// data pedida, vale o mais recente. É a mesma regra da view
// `current_machine_targets`, só que para um dia qualquer em vez de hoje.
import { describe, it, expect, vi, beforeEach } from "vitest";

const linhas = [
  // Horizontal N°1: 8.000 por turno desde fevereiro, 10.000 rateada desde 27/09.
  { machine_id: 1, quantity_per_shift: 10000, valid_from: "2026-09-27", basis: "per_shift_prorated", created_by: null, created_at: "2026-09-27T00:00:00Z" },
  { machine_id: 1, quantity_per_shift: 8000, valid_from: "2026-03-02", basis: "per_shift", created_by: null, created_at: "2026-03-02T00:00:00Z" },
  { machine_id: 1, quantity_per_shift: 7000, valid_from: "2026-02-01", basis: "per_shift", created_by: null, created_at: "2026-02-01T00:00:00Z" },
  // A Granél: por pessoa desde 25/09.
  { machine_id: 7, quantity_per_shift: 25000, valid_from: "2026-09-25", basis: "per_operator", created_by: null, created_at: "2026-09-25T00:00:00Z" },
  { machine_id: 7, quantity_per_shift: 15000, valid_from: "2026-02-01", basis: "per_shift", created_by: null, created_at: "2026-02-01T00:00:00Z" },
];

/** O `.lte(...)` do Supabase, imitado: só os degraus que já começaram na data. */
function consultaAte(data: string) {
  return linhas
    .filter(l => l.valid_from <= data)
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1));
}

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: () => {
      let ate = "";
      const q = {
        select: () => q,
        lte: (_col: string, v: string) => { ate = v; return q; },
        order: () => Promise.resolve({ data: consultaAte(ate), error: null }),
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/repositories/supabase/helpers", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  loadProfileNames: async () => new Map<string, string>(),
}));

let getMetasEm: (d: string, s: null) => Promise<{
  metas: Record<number, number>;
  metasInfo: Record<number, { basis: string; vigenciaInicio: string }>;
}>;

beforeEach(async () => {
  const mod = await import("@/lib/repositories/supabase/catalog");
  getMetasEm = mod.supabaseTargets.getMetasEm as typeof getMetasEm;
});

describe("a meta que valia numa data (D08, D13)", () => {
  it("hoje: pega o degrau mais recente", async () => {
    const r = await getMetasEm("2026-09-30", null);
    expect(r.metas[1]).toBe(10000);
    expect(r.metasInfo[1].basis).toBe("per_shift_prorated");
    expect(r.metas[7]).toBe(25000);
    expect(r.metasInfo[7].basis).toBe("per_operator");
  });

  it("uma data passada: pega o degrau que valia NAQUELE dia, não o de hoje", async () => {
    const r = await getMetasEm("2026-06-15", null);
    expect(r.metas[1]).toBe(8000);
    expect(r.metasInfo[1].basis).toBe("per_shift");
    // A Granél ainda era meta fixa do turno em junho, não por pessoa.
    expect(r.metas[7]).toBe(15000);
    expect(r.metasInfo[7].basis).toBe("per_shift");
  });

  it("no dia exato em que o degrau começa, o degrau novo já vale", async () => {
    const r = await getMetasEm("2026-09-27", null);
    expect(r.metas[1]).toBe(10000);
    expect(r.metasInfo[1].vigenciaInicio).toBe("2026-09-27");
  });

  it("na véspera, ainda vale o degrau anterior", async () => {
    const r = await getMetasEm("2026-09-26", null);
    expect(r.metas[1]).toBe(8000);
  });

  it("antes de qualquer meta, a máquina não aparece", async () => {
    const r = await getMetasEm("2025-12-01", null);
    expect(r.metas[1]).toBeUndefined();
    expect(Object.keys(r.metas)).toHaveLength(0);
  });
});
