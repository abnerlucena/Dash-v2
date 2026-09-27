// ─── A meta do turno: as três bases ───────────────────────────
// Por que isto existe em vez de ser uma linha na tela: são três regras, e a
// D39 foi explícita ao rejeitar "cada tela lembra da exceção" — quem esquecesse
// mostraria 300% de atingimento. Aqui a conta é uma só, e tem teste
// (src/test/metas.test.ts).
//
// Quem manda é a base da meta da máquina (D39, D47):
//
//   per_shift            A meta é do turno e a lotação não muda nada. É o caso
//                        de quase toda máquina: o ritmo é da máquina, mais gente
//                        na volta não faz sair mais peça.
//   per_shift_prorated   A meta é do turno COM A LOTAÇÃO PADRÃO, e é rateada
//                        pela real. Embaladoras Horizontais: a linha precisa de
//                        4 pessoas para render 10.000; com 3, render 7.500 é o
//                        esperado, não um fracasso.
//   per_operator         A meta é de CADA pessoa. Bancada A Granél: trabalho
//                        manual, 25.000 por pessoa — 3 pessoas, 75.000.

export type BaseDaMeta = "per_shift" | "per_shift_prorated" | "per_operator";

export interface MetaDoTurno {
  /**
   * A meta do turno, ou `null` quando ela depende de gente e ninguém disse
   * quantas pessoas eram — nem a máquina tem lotação padrão cadastrada. Nulo
   * significa "desconhecida": é para a tela pedir o dado, nunca para mostrar
   * zero nem o número cru como se fosse a meta.
   */
  valor: number | null;
  /** O número como está cadastrado, sem conta nenhuma. */
  cadastrada: number;
  base: BaseDaMeta;
  /** Quantas pessoas a conta usou (informadas, ou a lotação padrão). */
  pessoas: number;
  /** A lotação padrão da máquina, quando o banco a conhece. */
  lotacaoPadrao: number | null;
  /** `true` quando o nº de pessoas muda a meta desta máquina. */
  dependeDaLotacao: boolean;
}

export interface EntradaMeta {
  /** A meta cadastrada da máquina (`quantity_per_shift`). */
  cadastrada: number;
  /** A base; vazio = `per_shift`, que é a regra de quase todas. */
  base?: BaseDaMeta | null;
  /** Pessoas informadas no apontamento. Vazio, 0 ou inválido = não informado. */
  pessoas?: number | string | null;
  /** `machines.standard_operator_count`. */
  lotacaoPadrao?: number | null;
}

/** A meta depende de quantas pessoas trabalharam no posto? */
export function dependeDaLotacao(base?: BaseDaMeta | null): boolean {
  return base === "per_operator" || base === "per_shift_prorated";
}

export function metaDoTurno({ cadastrada, base, pessoas, lotacaoPadrao }: EntradaMeta): MetaDoTurno {
  const baseFinal: BaseDaMeta = dependeDaLotacao(base) ? (base as BaseDaMeta) : "per_shift";
  const lotacao = lotacaoPadrao && lotacaoPadrao > 0 ? lotacaoPadrao : null;
  // Number("") é 0 e Number("abc") é NaN: os dois querem dizer "não informado".
  const informadas = Number(pessoas);
  const pessoasInformadas = Number.isFinite(informadas) && informadas > 0 ? Math.floor(informadas) : 0;

  if (baseFinal === "per_shift") {
    return {
      valor: cadastrada, cadastrada, base: baseFinal,
      pessoas: pessoasInformadas, lotacaoPadrao: lotacao, dependeDaLotacao: false,
    };
  }

  // "Não informaram" não é "trabalharam sozinhos": cai na lotação padrão.
  const usadas = pessoasInformadas || lotacao || 0;
  const comum = { cadastrada, base: baseFinal, pessoas: usadas, lotacaoPadrao: lotacao, dependeDaLotacao: true };

  if (!usadas) return { ...comum, valor: null };

  if (baseFinal === "per_operator") return { ...comum, valor: cadastrada * usadas };

  // per_shift_prorated: sem lotação padrão não há do que ratear — a meta
  // cadastrada já é a do turno, e é o melhor que se pode dizer.
  if (!lotacao) return { ...comum, valor: cadastrada };
  return { ...comum, valor: Math.round((cadastrada * usadas) / lotacao) };
}

/** Texto curto da base, para etiqueta de tela. */
export function rotuloDaBase(base?: BaseDaMeta | null): string | null {
  if (base === "per_operator") return "por pessoa";
  if (base === "per_shift_prorated") return "conforme a lotação";
  return null;
}
