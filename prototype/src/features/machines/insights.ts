import { REWORK_REASONS, SHIFTS, dayKey, type DateRange, type Machine, type Shift, type WorkOrder } from "@/data/machines";

/*
 * Indicadores da aba Gráficos, calculados sobre o recorte atual (máquinas
 * filtradas, turno e período) e sobre o que se movimenta no sistema:
 * apontamentos (produção, minutos, retrabalho, observações) e OPs (conclusão
 * e tempo entre liberação e conclusão).
 */

const HOUR = 3600000;
const inRange = (d: Date, r: DateRange) => d >= r.from && d < new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate() + 1);

/** Faixas do tempo de OP (liberação → conclusão) */
export const LEAD_BUCKETS = [
  { label: "até 1 dia", max: 24 },
  { label: "1 a 2 dias", max: 48 },
  { label: "2 a 4 dias", max: 96 },
  { label: "4 a 7 dias", max: 168 },
  { label: "mais de 7 dias", max: Infinity },
];

/** Limite de retrabalho usado no app (mesmo da aba Retrabalho) */
export const REWORK_LIMIT = 10;

export function insights(rows: Machine[], dates: Date[], range: DateRange, ops: WorkOrder[]) {
  const orders = rows.flatMap((m) => m.orders);
  const produced = orders.reduce((s, o) => s + o.quantity, 0);
  const minutes = orders.reduce((s, o) => s + o.minutes, 0);
  const reworkOrders = orders.filter((o) => o.rework);
  const reworkQty = reworkOrders.reduce((s, o) => s + o.quantity, 0);

  // Produção por dia, por turno
  const byDayShift = dates.map((date) => {
    const that = orders.filter((o) => dayKey(o.date) === dayKey(date));
    return { date, byShift: SHIFTS.map((s) => that.filter((o) => o.shift === s).reduce((q, o) => q + o.quantity, 0)) as [number, number, number] };
  });

  // Peças por minuto de cada máquina no recorte
  const perMinute = rows
    .map((m) => {
      const mins = m.orders.reduce((s, o) => s + o.minutes, 0);
      return { machine: m, value: mins ? m.produced / mins : 0 };
    })
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  // OPs concluídas no período (das máquinas do recorte)
  const ids = new Set(rows.map((m) => m.id));
  const done = ops.filter((op) => ids.has(op.machineId) && op.stage === "done" && op.closedAt && inRange(op.closedAt, range));
  const leadHours = (op: WorkOrder) => (op.closedAt!.getTime() - op.releasedAt.getTime()) / HOUR;
  const opsByDay = dates.map((date) => {
    const that = done.filter((op) => dayKey(op.closedAt!) === dayKey(date) && op.closedAt!.getMonth() === date.getMonth());
    const avg = that.length ? that.reduce((s, op) => s + leadHours(op), 0) / that.length : null;
    return { date, count: that.length, avgDays: avg == null ? null : avg / 24 };
  });
  const leadBuckets = LEAD_BUCKETS.map((b, i) => ({
    label: b.label,
    count: done.filter((op) => {
      const h = leadHours(op);
      return h <= b.max && (i === 0 || h > LEAD_BUCKETS[i - 1].max);
    }).length,
  }));
  const avgLeadDays = done.length ? done.reduce((s, op) => s + leadHours(op), 0) / done.length / 24 : 0;
  const openNow = ops.filter((op) => ids.has(op.machineId) && op.stage !== "done");

  // Retrabalho por dia (peças e taxa) e motivos (Pareto)
  const reworkByDay = dates.map((date) => {
    const that = orders.filter((o) => dayKey(o.date) === dayKey(date));
    const total = that.reduce((s, o) => s + o.quantity, 0);
    const rw = that.filter((o) => o.rework).reduce((s, o) => s + o.quantity, 0);
    return { date, qty: rw, rate: total ? (rw / total) * 100 : null };
  });
  const reasons = REWORK_REASONS.map((reason) => ({
    reason,
    count: reworkOrders.filter((o) => o.reworkReason === reason).length,
  }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalReasons = reasons.reduce((s, r) => s + r.count, 0);
  let acc = 0;
  const pareto = reasons.map((r) => {
    acc += r.count;
    return { ...r, cumulative: totalReasons ? (acc / totalReasons) * 100 : 0 };
  });

  return {
    produced,
    perMinuteTotal: minutes ? produced / minutes : 0,
    reworkRate: produced ? (reworkQty / produced) * 100 : 0,
    notes: orders.filter((o) => o.note).length,
    entries: orders.length,
    byDayShift,
    perMinute,
    opsDone: done.length,
    opsOpen: openNow.length,
    opsPaused: openNow.filter((op) => op.stage === "paused").length,
    avgLeadDays,
    opsByDay,
    leadBuckets,
    reworkByDay,
    pareto,
  };
}

export type Insights = ReturnType<typeof insights>;
export const SHIFT_NAMES: Record<Shift, string> = { 1: "Turno 1", 2: "Turno 2", 3: "Turno 3" };
