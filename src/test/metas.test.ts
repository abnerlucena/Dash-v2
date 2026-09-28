import { describe, it, expect } from "vitest";
import { metaDoTurno, dependeDaLotacao, rotuloDaBase } from "@/lib/metas";

describe("a meta do turno conforme a base (D39, D47)", () => {
  it("per_shift: a lotação não muda nada", () => {
    const m = metaDoTurno({ cadastrada: 13000, base: "per_shift", pessoas: 5, lotacaoPadrao: 2 });
    expect(m.valor).toBe(13000);
    expect(m.dependeDaLotacao).toBe(false);
  });

  it("sem base informada, trata como per_shift (modo Apps Script)", () => {
    expect(metaDoTurno({ cadastrada: 500 }).valor).toBe(500);
    expect(metaDoTurno({ cadastrada: 500, base: null, pessoas: 9 }).valor).toBe(500);
  });

  it("per_operator: A Granél, 25.000 por pessoa", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 3, lotacaoPadrao: 1 }).valor)
      .toBe(75000);
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 1, lotacaoPadrao: 1 }).valor)
      .toBe(25000);
  });

  it("per_shift_prorated: horizontal com 3 das 4 pessoas rende 7.500", () => {
    const m = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 3, lotacaoPadrao: 4 });
    expect(m.valor).toBe(7500);
    expect(m.pessoas).toBe(3);
    expect(m.lotacaoPadrao).toBe(4);
  });

  it("per_shift_prorated: com a lotação cheia é a meta cheia, e com gente a mais sobe", () => {
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 4, lotacaoPadrao: 4 }).valor)
      .toBe(10000);
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 6, lotacaoPadrao: 4 }).valor)
      .toBe(15000);
  });

  it("sem pessoas informadas, cai na lotação padrão — não em uma pessoa", () => {
    // Rateada: lotação padrão = meta cheia.
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: "", lotacaoPadrao: 4 }).valor)
      .toBe(10000);
    // Por pessoa: a lotação padrão é o palpite do banco (A Granél tem 1).
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: null, lotacaoPadrao: 2 }).valor)
      .toBe(50000);
  });

  it("meta desconhecida: depende de gente, e não há nem pessoas nem lotação", () => {
    const m = metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: "", lotacaoPadrao: null });
    // Mesmo palpite da view: × 1 — mas marcado, para a tela pedir o dado.
    expect(m.valor).toBe(25000);
    expect(m.estimada).toBe(true);
    expect(m.cadastrada).toBe(25000);
    const h = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: null, lotacaoPadrao: null });
    expect(h.valor).toBe(10000);
    expect(h.estimada).toBe(true);
  });

  // Espelha os casos 13 e 14 de supabase/tests/06_meta_por_lotacao.sql (D48):
  // 0 pessoas nunca vira meta 0, que tiraria o turno do atingimento.
  it("0 pessoas é não informado: cai na lotação padrão, igual à view", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 0, lotacaoPadrao: 1 }).valor)
      .toBe(25000);
    const h = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: "0", lotacaoPadrao: 4 });
    expect(h.valor).toBe(10000);
    expect(h.estimada).toBe(false);
  });

  it("texto inválido no campo de pessoas conta como não informado", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: "abc", lotacaoPadrao: 2 }).valor)
      .toBe(50000);
    // Fração é arredondada para baixo: meia pessoa não existe no chão de fábrica.
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 2.7, lotacaoPadrao: 1 }).valor)
      .toBe(50000);
  });

  it("quais bases dependem de gente, e como se chamam na tela", () => {
    expect(dependeDaLotacao("per_operator")).toBe(true);
    expect(dependeDaLotacao("per_shift_prorated")).toBe(true);
    expect(dependeDaLotacao("per_shift")).toBe(false);
    expect(dependeDaLotacao(undefined)).toBe(false);
    expect(rotuloDaBase("per_operator")).toBe("por pessoa");
    expect(rotuloDaBase("per_shift_prorated")).toBe("conforme a lotação");
    expect(rotuloDaBase("per_shift")).toBeNull();
  });
});
