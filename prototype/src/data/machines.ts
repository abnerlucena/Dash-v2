/*
 * Dados de demonstração — março/2026.
 * Produção e meta vêm do briefing; o resto (dias, tendência, ordens) é
 * gerado de forma determinística para o protótipo ter sempre a mesma cara.
 */

export type Accent = "blue" | "teal" | "green" | "lime" | "yellow" | "orange" | "red" | "magenta" | "purple" | "gray";
export type Shift = 1 | 2 | 3;

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

export interface ProductionOrder {
  id: string;
  date: Date;
  shift: Shift;
  product: string;
  quantity: number;
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
  trend: number[];
  dailyTarget: number;
  lastEntry: { date: Date; shift: Shift };
  orders: ProductionOrder[];
}

export const WORKING_DAYS = 22;
export const PERIOD_LABEL = "março de 2026";

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
  lastShift: Shift;
  products: string[];
}> = [
  {
    id: "granel",
    name: "A GRANEL",
    lines: ["Granel"],
    days: 17,
    produced: 483126,
    target: 630000,
    lastDay: 21,
    lastShift: 2,
    products: ["Parafuso borne M3", "Mola de contato", "Terminal olhal"],
  },
  {
    id: "horizontal-1",
    name: "HORIZONTAL 1",
    lines: ["Horizontais", "Placas"],
    days: 10,
    produced: 158100,
    target: 440000,
    lastDay: 20,
    lastShift: 1,
    products: ["Placa 4x2 branca", "Placa 4x4 branca", "Placa cega 4x2"],
  },
  {
    id: "vertical-placas-2",
    name: "VERTICAL PLACAS / SUP. 2",
    lines: ["Verticais", "Placas", "Suportes", "Linha 2"],
    days: 9,
    produced: 155382,
    target: 440000,
    lastDay: 21,
    lastShift: 3,
    products: ["Suporte 4x2", "Placa 4x2 grafite", "Suporte 4x4"],
  },
  {
    id: "montagem-diversos",
    name: "MONTAGEM DIVERSOS",
    lines: ["Montagem"],
    days: 10,
    produced: 32584,
    target: 88000,
    lastDay: 19,
    lastShift: 2,
    products: ["Tomada 10A", "Tomada 20A", "Interruptor paralelo"],
  },
  {
    id: "teste-interruptores",
    name: "TESTE INTERRUPTORES",
    lines: ["Teste", "Interruptores"],
    days: 8,
    produced: 23779,
    target: 72000,
    lastDay: 18,
    lastShift: 1,
    products: ["Interruptor simples", "Interruptor bipolar", "Pulsador campainha"],
  },
  {
    id: "montagem-refinatto",
    name: "MONTAGEM PLACA REFINATTO",
    lines: ["Montagem", "Placas", "Refinatto"],
    days: 4,
    produced: 12755,
    target: 84000,
    lastDay: 17,
    lastShift: 2,
    products: ["Placa Refinatto 4x2", "Placa Refinatto 4x4", "Módulo Refinatto USB"],
  },
];

function buildMachine(raw: (typeof RAW)[number], index: number): Machine {
  const random = rng(index * 7919 + 17);
  const percent = Math.round((raw.produced / raw.target) * 100);
  const dailyAverage = raw.produced / raw.days;
  const dailyTarget = raw.target / WORKING_DAYS;
  const trend = Array.from({ length: 14 }, () => Math.round(dailyAverage * (0.55 + random() * 0.75)));

  // Ordens: distribui a produção pelos dias apontados (os mais recentes primeiro)
  const orders: ProductionOrder[] = [];
  let remaining = raw.produced;
  for (let d = 0; d < raw.days; d++) {
    const day = raw.lastDay - d;
    const date = new Date(2026, 2, Math.max(day, 1));
    const perDay = d === raw.days - 1 ? remaining : Math.round(dailyAverage * (0.7 + random() * 0.6));
    remaining -= perDay;
    const parts = 1 + Math.floor(random() * 2);
    let dayLeft = perDay;
    for (let p = 0; p < parts; p++) {
      const qty = p === parts - 1 ? dayLeft : Math.round(perDay * (0.35 + random() * 0.3));
      dayLeft -= qty;
      orders.push({
        id: `OP ${4501000 + index * 997 + d * 13 + p}`,
        date,
        shift: (d === 0 && p === 0 ? raw.lastShift : ((1 + Math.floor(random() * 3)) as Shift)) as Shift,
        product: raw.products[Math.floor(random() * raw.products.length)],
        quantity: Math.max(qty, 0),
      });
    }
  }

  return {
    id: raw.id,
    name: raw.name,
    lines: raw.lines,
    days: raw.days,
    produced: raw.produced,
    target: raw.target,
    percent,
    status: statusFor(percent),
    trend,
    dailyTarget: Math.round(dailyTarget),
    lastEntry: { date: new Date(2026, 2, raw.lastDay), shift: raw.lastShift },
    orders,
  };
}

export const MACHINES: Machine[] = RAW.map(buildMachine);

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

export const PREVIOUS_MONTH_PRODUCED = 770220; // fevereiro/2026 → +12,4%
