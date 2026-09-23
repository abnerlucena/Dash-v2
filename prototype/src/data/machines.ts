/*
 * Dados de demonstração — março/2026 (22 dias úteis, referência 27/03).
 * Produção e meta vêm do briefing; dias, ordens e turnos são gerados de
 * forma determinística a partir deles. Todas as abas leem da MESMA fonte:
 * a sparkline, a grade diária, o painel e os gráficos sempre concordam.
 */

export type Accent = "blue" | "teal" | "green" | "lime" | "yellow" | "orange" | "red" | "magenta" | "purple" | "gray";
export type Shift = 1 | 2 | 3;
export const SHIFTS: Shift[] = [1, 2, 3];

export const SHIFT_META: Record<Shift, { label: string; hours: string }> = {
  1: { label: "Turno 1", hours: "06h–14h" },
  2: { label: "Turno 2", hours: "14h–22h" },
  3: { label: "Turno 3", hours: "22h–06h" },
};

export type Status = "critical" | "attention" | "near" | "achieved";

export const STATUS_META: Record<
  Status,
  { label: string; appearance: "danger" | "warning" | "information" | "success"; range: string }
> = {
  critical: { label: "Crítico", appearance: "danger", range: "abaixo de 70%" },
  attention: { label: "Atenção", appearance: "warning", range: "70% a 89%" },
  near: { label: "Próximo", appearance: "information", range: "90% a 99%" },
  achieved: { label: "Atingido", appearance: "success", range: "100% ou mais" },
};

export function statusFor(percent: number): Status {
  if (percent >= 100) return "achieved";
  if (percent >= 90) return "near";
  if (percent >= 70) return "attention";
  return "critical";
}

export const LINE_ACCENT: Record<string, Accent> = {
  Granel: "teal",
  Horizontais: "blue",
  Verticais: "purple",
  Placas: "orange",
  Suportes: "gray",
  "Linha 2": "gray",
  Montagem: "magenta",
  Interruptores: "lime",
  Teste: "yellow",
  Refinatto: "green",
};

/* ---------- Calendário ---------- */
const YEAR = 2026;
const MONTH = 2; // março (0-based)
export const REFERENCE_DAY = 27;
export const PERIOD_LABEL = "março de 2026";

/** Dias úteis (seg–sex) de março/2026 */
export const WORKING_DATES: Date[] = Array.from({ length: 31 }, (_, i) => new Date(YEAR, MONTH, i + 1)).filter(
  (d) => d.getDay() !== 0 && d.getDay() !== 6,
);
export const WORKING_DAYS = WORKING_DATES.length; // 22
/** Dias úteis já transcorridos até a data de referência */
export const ELAPSED_DATES = WORKING_DATES.filter((d) => d.getDate() <= REFERENCE_DAY);
export const REFERENCE_DATE = new Date(YEAR, MONTH, REFERENCE_DAY);

export const dayKey = (d: Date) => d.getDate();

/* ---------- Tipos ---------- */
export interface OrderNote {
  id: string;
  text: string;
  author: string;
}

export interface ProductionOrder {
  id: string;
  machineId: string;
  date: Date;
  shift: Shift;
  product: string;
  quantity: number;
  /** OP inteira marcada como retrabalho (como no app atual) */
  rework: boolean;
  reworkReason: string | null;
  /** Operador que registrou e horário do registro */
  operator: string;
  recordedAt: Date;
  /** Observação do operador (vira um "feedback") */
  note: OrderNote | null;
}

export interface DayPoint {
  date: Date;
  /** null = sem apontamento neste dia */
  value: number | null;
}

export interface Machine {
  id: string;
  name: string;
  lines: string[];
  days: number;
  produced: number;
  target: number;
  percent: number;
  status: Status;
  dailyTarget: number;
  /** produção por dia do mês (só dias com apontamento) */
  daily: Map<number, number>;
  /** últimos 14 dias úteis até a referência */
  trend: DayPoint[];
  byShift: Record<Shift, number>;
  ordersByShift: Record<Shift, number>;
  /** null quando não há apontamento no recorte (ex.: turno sem produção) */
  lastEntry: { date: Date; shift: Shift } | null;
  orders: ProductionOrder[];
}

// PRNG determinístico (mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RAW: Array<{
  id: string;
  name: string;
  lines: string[];
  days: number;
  produced: number;
  target: number;
  lastDay: number;
  /** peso de cada turno na produção da máquina */
  shiftProfile: [number, number, number];
  /** chance de uma OP ser de retrabalho */
  reworkRate: number;
  products: string[];
}> = [
  {
    id: "granel",
    name: "A GRANEL",
    lines: ["Granel"],
    days: 17,
    produced: 483126,
    target: 630000,
    lastDay: 27,
    shiftProfile: [0.4, 0.35, 0.25],
    reworkRate: 0.04,
    products: ["Parafuso borne M3", "Mola de contato", "Terminal olhal"],
  },
  {
    id: "horizontal-1",
    name: "HORIZONTAL 1",
    lines: ["Horizontais", "Placas"],
    days: 10,
    produced: 158100,
    target: 440000,
    lastDay: 26,
    shiftProfile: [0.5, 0.35, 0.15],
    reworkRate: 0.1,
    products: ["Placa 4x2 branca", "Placa 4x4 branca", "Placa cega 4x2"],
  },
  {
    id: "vertical-placas-2",
    name: "VERTICAL PLACAS / SUP. 2",
    lines: ["Verticais", "Placas", "Suportes", "Linha 2"],
    days: 9,
    produced: 155382,
    target: 440000,
    lastDay: 27,
    shiftProfile: [0.3, 0.3, 0.4],
    reworkRate: 0.16,
    products: ["Suporte 4x2", "Placa 4x2 grafite", "Suporte 4x4"],
  },
  {
    id: "montagem-diversos",
    name: "MONTAGEM DIVERSOS",
    lines: ["Montagem"],
    days: 10,
    produced: 32584,
    target: 88000,
    lastDay: 25,
    shiftProfile: [0.55, 0.45, 0],
    reworkRate: 0.06,
    products: ["Tomada 10A", "Tomada 20A", "Interruptor paralelo"],
  },
  {
    id: "teste-interruptores",
    name: "TESTE INTERRUPTORES",
    lines: ["Teste", "Interruptores"],
    days: 8,
    produced: 23779,
    target: 72000,
    lastDay: 24,
    shiftProfile: [0.6, 0.4, 0],
    reworkRate: 0.2,
    products: ["Interruptor simples", "Interruptor bipolar", "Pulsador campainha"],
  },
  {
    id: "montagem-refinatto",
    name: "MONTAGEM PLACA REFINATTO",
    lines: ["Montagem", "Placas", "Refinatto"],
    days: 4,
    produced: 12755,
    target: 84000,
    lastDay: 23,
    shiftProfile: [1, 0, 0],
    reworkRate: 0.08,
    products: ["Placa Refinatto 4x2", "Placa Refinatto 4x4", "Módulo Refinatto USB"],
  },
];

/* ---------- Pessoas, motivos e observações (fictícios) ---------- */
export const OPERATORS: Record<Shift, string[]> = {
  1: ["Ana Paula Ribeiro", "Carlos Eduardo Lima", "Juliana Martins"],
  2: ["Marcos Vieira", "Patrícia Gomes", "Rodrigo Alves"],
  3: ["Fernanda Costa", "Lucas Pereira"],
};
const SHIFT_END_HOUR: Record<Shift, number> = { 1: 13, 2: 21, 3: 5 };

export const REWORK_REASONS = [
  "Rebarba na peça",
  "Cor fora do padrão",
  "Montagem invertida",
  "Falha no teste elétrico",
  "Encaixe com folga",
];

const NOTES = [
  "Máquina parada 40 min para troca de molde.",
  "Falta de matéria-prima no início do turno; produção começou às 7h20.",
  "Setup demorado por ajuste de temperatura.",
  "Operador novo em treinamento neste turno.",
  "Troca de bobina fora do previsto.",
  "Parada de 25 min por queda de energia na linha.",
  "Produção normal, sem ocorrências.",
  "Ajuste de ferramenta depois do intervalo.",
  "Aguardando manutenção no alimentador vibratório.",
  "Lote de tampas com variação de cor; separado para inspeção.",
];

/** Divide `total` em partes inteiras proporcionais aos pesos, somando exatamente `total`. */
function split(total: number, weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  parts[parts.length - 1] += total - parts.reduce((s, p) => s + p, 0);
  return parts;
}

const trendFrom = (daily: Map<number, number>): DayPoint[] =>
  ELAPSED_DATES.slice(-14).map((date) => ({ date, value: daily.get(dayKey(date)) ?? null }));

function buildMachine(raw: (typeof RAW)[number], index: number): Machine {
  const random = rng(index * 7919 + 17);
  const percent = Math.round((raw.produced / raw.target) * 100);

  // Dias apontados: o último dia é fixo; os demais saem de um embaralhamento determinístico
  const candidates = WORKING_DATES.filter((d) => d.getDate() < raw.lastDay);
  const shuffled = candidates
    .map((d) => ({ d, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.d);
  const lastDate = new Date(YEAR, MONTH, raw.lastDay);
  const entryDates = [lastDate, ...shuffled.slice(0, raw.days - 1)].sort((a, b) => b.getTime() - a.getTime());

  const perDay = split(
    raw.produced,
    entryDates.map(() => 0.7 + random() * 0.6),
  );

  const daily = new Map<number, number>();
  const orders: ProductionOrder[] = [];
  const byShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const ordersByShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  let seq = 0;
  // Gerador separado para os campos de apoio: não altera produção, dias nem turnos
  const extra = rng(index * 104729 + 7);

  entryDates.forEach((date, d) => {
    daily.set(dayKey(date), perDay[d]);
    // Turnos que apontaram neste dia (pelo menos um, respeitando o perfil da máquina)
    let shifts = SHIFTS.filter((s) => raw.shiftProfile[s - 1] > 0 && random() < 0.55 + raw.shiftProfile[s - 1]);
    if (shifts.length === 0) shifts = [SHIFTS.find((s) => raw.shiftProfile[s - 1] > 0)!];
    const quantities = split(
      perDay[d],
      shifts.map((s) => raw.shiftProfile[s - 1] * (0.8 + random() * 0.4)),
    );
    shifts.forEach((shift, i) => {
      byShift[shift] += quantities[i];
      ordersByShift[shift] += 1;
      const product = raw.products[Math.floor(random() * raw.products.length)];
      const rework = extra() < raw.reworkRate;
      const operators = OPERATORS[shift];
      const operator = operators[Math.floor(extra() * operators.length)];
      const minutes = 20 + Math.floor(extra() * 35);
      const noteRoll = extra();
      const id = `OP ${4501000 + index * 997 + seq++ * 13}`;
      orders.push({
        id,
        machineId: raw.id,
        date,
        shift,
        product,
        quantity: quantities[i],
        rework,
        reworkReason: rework ? REWORK_REASONS[Math.floor(extra() * REWORK_REASONS.length)] : null,
        operator,
        recordedAt: new Date(YEAR, MONTH, date.getDate(), SHIFT_END_HOUR[shift], minutes),
        note:
          noteRoll < 0.3 || rework
            ? {
                id: `n-${id}`,
                text: rework
                  ? "Peças separadas para retrabalho; lote identificado na caixa."
                  : NOTES[Math.floor(noteRoll * 33) % NOTES.length],
                author: operator,
              }
            : null,
      });
    });
  });

  const last = orders[0]; // entryDates já está do mais recente para o mais antigo
  const lastDayOrders = orders.filter((o) => o.date.getTime() === last.date.getTime());
  const lastShift = lastDayOrders[lastDayOrders.length - 1].shift;

  return {
    id: raw.id,
    name: raw.name,
    lines: raw.lines,
    days: raw.days,
    produced: raw.produced,
    target: raw.target,
    percent,
    status: statusFor(percent),
    dailyTarget: Math.round(raw.target / WORKING_DAYS),
    daily,
    trend: trendFrom(daily),
    byShift,
    ordersByShift,
    lastEntry: { date: last.date, shift: lastShift },
    orders,
  };
}

export const MACHINES: Machine[] = RAW.map(buildMachine);
export const machineById = (id: string) => MACHINES.find((m) => m.id === id)!;

/** Todas as OPs do mês, da mais recente para a mais antiga */
export const ALL_ORDERS: ProductionOrder[] = MACHINES.flatMap((m) => m.orders).sort(
  (a, b) => b.recordedAt.getTime() - a.recordedAt.getTime(),
);

/* ---------- Linhas (mesmos grupos do apontamento no app atual) ---------- */
export interface MachineGroup {
  id: string;
  label: string;
  machineIds: string[];
}
export const MACHINE_GROUPS: MachineGroup[] = [
  { id: "horizontais", label: "Horizontais", machineIds: ["horizontal-1"] },
  { id: "verticais", label: "Verticais", machineIds: ["vertical-placas-2"] },
  { id: "granel", label: "Granel & Interruptores", machineIds: ["granel", "teste-interruptores"] },
  { id: "montagem", label: "Montagem", machineIds: ["montagem-diversos", "montagem-refinatto"] },
];
export const groupOf = (machineId: string) => MACHINE_GROUPS.find((g) => g.machineIds.includes(machineId))!;

/* ---------- Metas ---------- */
export const ACTIVE_SHIFTS = 3;
export const META_EFFECTIVE_FROM = new Date(YEAR, MONTH, 1);
/** Meta por turno derivada da meta do mês (meta/mês = meta/turno × turnos × dias úteis) */
export const metaPerShift = (m: Machine, shifts = ACTIVE_SHIFTS) => Math.round(m.target / (WORKING_DAYS * shifts));

export interface MetaChange {
  id: string;
  date: Date;
  author: string;
  summary: string;
}
export const META_CHANGES: MetaChange[] = [
  { id: "c3", date: new Date(YEAR, MONTH, 1, 8, 12), author: "Rafael Souza", summary: "Metas de março publicadas para 6 máquinas" },
  { id: "c2", date: new Date(YEAR, 1, 24, 16, 40), author: "Rafael Souza", summary: "MONTAGEM PLACA REFINATTO: meta por turno de 1.100 para 1.273" },
  { id: "c1", date: new Date(YEAR, 1, 2, 9, 5), author: "Juliana Martins", summary: "Turnos ativos alterados de 2 para 3" },
];

/* ---------- Feedbacks (observações das OPs) ---------- */
export const FEEDBACKS = ALL_ORDERS.filter((o) => o.note);
/** Os 12 mais recentes começam como não lidos */
export const INITIAL_UNREAD = FEEDBACKS.slice(0, 12).map((o) => o.note!.id);

/**
 * Recorta a máquina para um turno: produção, dias, ordens e tendência só
 * daquele turno, contra 1/3 da meta. "all" devolve a máquina inteira.
 */
export function scopeToShift(m: Machine, shift: Shift | "all"): Machine {
  if (shift === "all") return m;
  const orders = m.orders.filter((o) => o.shift === shift);
  const daily = new Map<number, number>();
  for (const o of orders) daily.set(dayKey(o.date), (daily.get(dayKey(o.date)) ?? 0) + o.quantity);
  const produced = orders.reduce((s, o) => s + o.quantity, 0);
  const target = Math.round(m.target / SHIFTS.length);
  const percent = Math.round((produced / target) * 100);
  return {
    ...m,
    orders,
    daily,
    produced,
    target,
    percent,
    status: statusFor(percent),
    days: daily.size,
    dailyTarget: Math.round(target / WORKING_DAYS),
    trend: trendFrom(daily),
    lastEntry: orders[0] ? { date: orders[0].date, shift } : null,
  };
}

export function aggregate(machines: Machine[]) {
  const produced = machines.reduce((s, m) => s + m.produced, 0);
  const target = machines.reduce((s, m) => s + m.target, 0);
  const days = machines.reduce((s, m) => s + m.days, 0);
  return {
    count: machines.length,
    produced,
    target,
    percent: target ? Math.round((produced / target) * 100) : 0,
    entryRate: machines.length ? Math.round((days / (machines.length * WORKING_DAYS)) * 100) : 0,
  };
}

/** Produção por turno somando as máquinas (ordem fixa 1, 2, 3) */
export function shiftTotals(machines: Machine[]) {
  return SHIFTS.map((shift) => ({
    shift,
    produced: machines.reduce((s, m) => s + m.byShift[shift], 0),
    orders: machines.reduce((s, m) => s + m.ordersByShift[shift], 0),
    target: Math.round(machines.reduce((s, m) => s + m.target, 0) / SHIFTS.length),
  }));
}

/** Série diária da fábrica (dias úteis transcorridos) e acumulado vs meta */
export function plantSeries(machines: Machine[]) {
  const target = machines.reduce((s, m) => s + m.target, 0);
  const dailyTarget = target / WORKING_DAYS;
  let cumulative = 0;
  return WORKING_DATES.map((date, i) => {
    const elapsed = date.getDate() <= REFERENCE_DAY;
    const value = elapsed ? machines.reduce((s, m) => s + (m.daily.get(dayKey(date)) ?? 0), 0) : null;
    if (value != null) cumulative += value;
    return {
      date,
      value,
      cumulative: elapsed ? cumulative : null,
      targetCumulative: Math.round(dailyTarget * (i + 1)),
      dailyTarget: Math.round(dailyTarget),
    };
  });
}

export const PREVIOUS_MONTH_PRODUCED = 770220; // fevereiro/2026 → +12,4%
