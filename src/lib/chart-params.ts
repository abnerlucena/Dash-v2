// ─── Ler os parâmetros que o ECharts entrega nos callbacks ────
// Os formatadores de tooltip e de rótulo recebem formas diferentes conforme o
// gráfico: um item só (`trigger: "item"`) ou uma lista (`trigger: "axis"`), e o
// `value` pode ser um número ou uma tupla (é o caso do heatmap, `[x, y, valor]`).
//
// Estas funções existem para que os gráficos não precisem tipar esses
// parâmetros como `any` — que era o que havia antes, em quatro arquivos, e o que
// escondeu por meses um formatador com a assinatura errada em chart-options.ts.

/** O mínimo que os nossos gráficos leem de um item do ECharts. */
export interface ItemDeGrafico {
  name?: string;
  seriesName?: string;
  dataIndex?: number;
  value?: unknown;
  data?: unknown;
}

/** Normaliza o parâmetro do tooltip para lista, venha item só ou lista. */
export function itensDoGrafico(params: unknown): ItemDeGrafico[] {
  const lista = Array.isArray(params) ? params : [params];
  return lista.filter((p): p is ItemDeGrafico => typeof p === "object" && p !== null);
}

/** O primeiro item, ou um vazio — para o formatador nunca quebrar o gráfico. */
export function primeiroItem(params: unknown): ItemDeGrafico {
  return itensDoGrafico(params)[0] ?? {};
}

/**
 * Número dentro de `value`. Com `indice`, lê a posição de uma tupla (heatmap).
 * Devolve 0 para o que não é número: um tooltip é informação, não lugar de
 * `NaN` nem de `undefined` aparecendo para quem está no chão de fábrica.
 */
export function numeroDoItem(valor: unknown, indice?: number): number {
  const bruto = indice !== undefined && Array.isArray(valor) ? valor[indice] : valor;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : 0;
}

/** Tupla numérica de um ponto de heatmap (`data` = `[dia, máquina, pct]`). */
export function tuplaNumerica(dado: unknown): number[] {
  return Array.isArray(dado) ? dado.map(v => numeroDoItem(v)) : [];
}

/** O item de uma série pelo nome (gráficos com barra e linha juntas). */
export function itemDaSerie(params: unknown, serie: string): ItemDeGrafico | undefined {
  return itensDoGrafico(params).find(p => p.seriesName === serie);
}
