/*
 * Dados de demonstração — março/2026 (22 dias úteis, referência 27/03).
 *
 * Centros de trabalho: os 22 centros ativos da planilha "Capacidade vs Pessoas"
 * (Seção Tomadas & Interruptores, Itajaí), com os NOMES reais e NÚMEROS
 * FICTÍCIOS (o repositório é público). 12 centros têm meta; os 10 "por demanda"
 * produzem, mas ficam fora do atingimento.
 *
 * Dias, apontamentos, OPs e conversas são gerados de forma determinística:
 * todas as abas leem da MESMA fonte e sempre concordam.
 */

export type Accent = "blue" | "teal" | "green" | "lime" | "yellow" | "orange" | "red" | "magenta" | "purple" | "gray";
export type Shift = 1 | 2 | 3;
export const SHIFTS: Shift[] = [1, 2, 3];

export const SHIFT_META: Record<Shift, { label: string; hours: string }> = {
  1: { label: "Turno 1", hours: "04h55–14h18" },
  2: { label: "Turno 2", hours: "14h18–23h24" },
  3: { label: "Turno 3", hours: "23h24–05h00" },
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

/* ---------- Linhas ---------- */
export type Line = "Montagem" | "Embalagem" | "Granel";
export const LINES: Line[] = ["Montagem", "Embalagem", "Granel"];
export const LINE_ACCENT: Record<string, Accent> = {
  Montagem: "magenta",
  Embalagem: "blue",
  Granel: "teal",
  "Por demanda": "gray",
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
/** "Agora" do protótipo: manhã seguinte à data de referência (turnos do dia 27 já fechados) */
export const NOW = new Date(YEAR, MONTH, REFERENCE_DAY + 1, 7, 0);

/** Chave do dia (mês e dia): períodos que cruzam meses não misturam 05/02 com 05/03 */
export const dayKey = (d: Date) => d.getMonth() * 100 + d.getDate();

/* ---------- Tipos ---------- */
export interface OrderNote {
  id: string;
  text: string;
  author: string;
}

/**
 * Apontamento: o que um turno produziu numa OP, num dia. Várias linhas
 * (dias/turnos diferentes) somam na mesma OP (`opId`).
 */
export interface ProductionOrder {
  /** identificador único do apontamento */
  id: string;
  /** número da OP ("OP 4501234"), compartilhado pelos apontamentos da mesma ordem */
  opId: string;
  machineId: string;
  date: Date;
  shift: Shift;
  /** material da OP (anda junto com a ordem) */
  material: string;
  product: string;
  quantity: number;
  /** minutos produtivos do turno nesta OP (para peças/minuto) */
  minutes: number;
  /** apontamento marcado como retrabalho (como no app atual) */
  rework: boolean;
  reworkReason: string | null;
  /** Operador que registrou e horário do registro */
  operator: string;
  recordedAt: Date;
  /** Observação do operador (vira mensagem na conversa da OP) */
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
  line: Line;
  /** etiquetas exibidas (linha e, nos centros sem meta, "Por demanda") */
  lines: string[];
  /** false = centro "por demanda": produz, mas não tem meta nem entra no atingimento */
  hasTarget: boolean;
  /** turnos em que o centro trabalha (2 = T1 e T2; 3 = os três) */
  regime: 2 | 3;
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
  /** minutos de produção por turno no mês (para peças/minuto) */
  minutesByShift: Record<Shift, number>;
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

interface RawCenter {
  id: string;
  name: string;
  line: Line;
  regime: 2 | 3;
  /** meta por turno (FICTÍCIA); null = por demanda */
  perShift: number | null;
  /** atingimento do mês (fictício) — ou, sem meta, produção total do mês */
  attainment?: number;
  demandVolume?: number;
  days: number;
  lastDay: number;
  reworkRate: number;
  products: string[];
}

// Ids iguais aos do simulador de capacidade (m = montagem, e = embalagem)
const RAW: RawCenter[] = [
  // ---- Montagem com meta
  { id: "m1", name: "Máquina de interruptores Composé nº 1", line: "Montagem", regime: 3, perShift: 4000, attainment: 0.66, days: 19, lastDay: 27, reworkRate: 0.08, products: ["Interruptor simples", "Interruptor paralelo"] },
  { id: "m4", name: "Máquina de tomadas Composé (Aumaq)", line: "Montagem", regime: 3, perShift: 11000, attainment: 0.91, days: 20, lastDay: 27, reworkRate: 0.05, products: ["Tomada 10A", "Tomada 20A"] },
  { id: "m11", name: "Máquina de plugue Slin (Aumaq)", line: "Montagem", regime: 2, perShift: 5800, attainment: 0.52, days: 14, lastDay: 25, reworkRate: 0.12, products: ["Plugue Slin 10A", "Plugue Slin 20A"] },
  // ---- Montagem por demanda (sem meta)
  { id: "m2", name: "Embaladora kit parafusos nº 1", line: "Montagem", regime: 2, perShift: null, demandVolume: 184000, days: 12, lastDay: 27, reworkRate: 0.02, products: ["Kit parafusos 4x2", "Kit parafusos 4x4"] },
  { id: "m3", name: "Embaladora kit parafusos nº 2", line: "Montagem", regime: 2, perShift: null, demandVolume: 141000, days: 10, lastDay: 26, reworkRate: 0.02, products: ["Kit parafusos 4x2", "Kit parafusos 4x4"] },
  { id: "m5", name: "Bancada nº 1 · teste de interruptores", line: "Montagem", regime: 3, perShift: null, demandVolume: 52000, days: 14, lastDay: 27, reworkRate: 0.14, products: ["Interruptor bipolar", "Interruptor intermediário"] },
  { id: "m6", name: "Bancada nº 2 · montagem de interruptores", line: "Montagem", regime: 2, perShift: null, demandVolume: 23500, days: 11, lastDay: 26, reworkRate: 0.1, products: ["Interruptor paralelo", "Pulsador campainha"] },
  { id: "m7", name: "Bancada nº 3 · diversos", line: "Montagem", regime: 2, perShift: null, demandVolume: 31000, days: 9, lastDay: 27, reworkRate: 0.06, products: ["Tomada dupla", "Conjunto sob medida"] },
  { id: "m8", name: "Bancada nº 4 · diversos", line: "Montagem", regime: 2, perShift: null, demandVolume: 27800, days: 8, lastDay: 24, reworkRate: 0.06, products: ["Tomada dupla", "Conjunto sob medida"] },
  { id: "m9", name: "Bancada nº 5 · eletrônicos", line: "Montagem", regime: 2, perShift: null, demandVolume: 18600, days: 10, lastDay: 27, reworkRate: 0.09, products: ["Módulo USB", "Sensor de presença"] },
  { id: "m10", name: "Prensa de inserção de contatos", line: "Montagem", regime: 2, perShift: null, demandVolume: 26400, days: 12, lastDay: 26, reworkRate: 0.07, products: ["Contato de tomada 10A", "Contato de tomada 20A"] },
  { id: "m12", name: "Prensa Tox", line: "Montagem", regime: 2, perShift: null, demandVolume: 39500, days: 13, lastDay: 27, reworkRate: 0.05, products: ["Placa rebitada 4x2", "Placa rebitada 4x4"] },
  { id: "m13", name: "Prensa placa Refinatto", line: "Montagem", regime: 2, perShift: null, demandVolume: 15200, days: 6, lastDay: 23, reworkRate: 0.08, products: ["Placa Refinatto 4x2", "Placa Refinatto 4x4"] },
  // ---- Embalagem
  { id: "e1", name: "Embaladora vertical conjuntos nº 1", line: "Embalagem", regime: 2, perShift: 4400, attainment: 0.62, days: 17, lastDay: 27, reworkRate: 0.06, products: ["Conjunto 4x2 1 tecla", "Conjunto 4x2 tomada 10A"] },
  { id: "e2", name: "Embaladora vertical conjuntos nº 2", line: "Embalagem", regime: 2, perShift: 4400, attainment: 0.55, days: 15, lastDay: 26, reworkRate: 0.07, products: ["Conjunto 4x4 2 módulos", "Conjunto 4x2 tomada 20A"] },
  { id: "e3", name: "Embaladora horizontal nº 1", line: "Embalagem", regime: 2, perShift: 9200, attainment: 0.84, days: 19, lastDay: 27, reworkRate: 0.05, products: ["Placa 4x2 branca", "Placa cega 4x2"] },
  { id: "e4", name: "Embaladora horizontal nº 2", line: "Embalagem", regime: 2, perShift: 9200, attainment: 0.93, days: 20, lastDay: 27, reworkRate: 0.04, products: ["Placa 4x4 branca", "Placa 4x2 branca"] },
  { id: "e5", name: "Embaladora 4x2 suportes/placas nº 1", line: "Embalagem", regime: 2, perShift: 6800, attainment: 0.71, days: 18, lastDay: 27, reworkRate: 0.09, products: ["Suporte 4x2", "Placa 4x2 grafite"] },
  { id: "e6", name: "Embaladora 4x2 suportes/placas nº 2", line: "Embalagem", regime: 2, perShift: 6800, attainment: 0.48, days: 12, lastDay: 24, reworkRate: 0.11, products: ["Suporte 4x2", "Suporte 4x4"] },
  { id: "e7", name: "Embaladora vertical módulos nº 1", line: "Embalagem", regime: 2, perShift: 11600, attainment: 1.02, days: 20, lastDay: 27, reworkRate: 0.03, products: ["Módulo tomada 10A", "Módulo interruptor simples"] },
  { id: "e8", name: "Embaladora vertical módulos nº 2", line: "Embalagem", regime: 2, perShift: 11600, attainment: 0.88, days: 19, lastDay: 27, reworkRate: 0.04, products: ["Módulo tomada 20A", "Módulo interruptor paralelo"] },
  // ---- Granel
  { id: "e9", name: "Bancada de embalagem a granel", line: "Granel", regime: 2, perShift: 21000, attainment: 0.77, days: 18, lastDay: 27, reworkRate: 0.03, products: ["Tampa avulsa", "Parafuso borne M3", "Mola de contato"] },
];

/* ---------- Pessoas, motivos e observações (fictícios) ---------- */
export const OPERATORS: Record<Shift, string[]> = {
  1: ["Ana Paula Ribeiro", "Carlos Eduardo Lima", "Juliana Martins", "Bruno Teixeira", "Camila Duarte", "Eduardo Farias"],
  2: ["Marcos Vieira", "Patrícia Gomes", "Rodrigo Alves", "Larissa Monteiro", "Thiago Barros", "Vanessa Cardoso"],
  3: ["Fernanda Costa", "Lucas Pereira", "Gustavo Rezende"],
};
/** Quem responde e movimenta as OPs (conversas: preparadores para cima) */
export const SETTERS: Record<Shift, string> = { 1: "Otávio Mendes", 2: "Renata Sales", 3: "Caio Fontes" };
export const LEADERS: Record<Shift, string> = { 1: "Beatriz Nunes", 2: "Diego Ramos", 3: "Helena Prado" };
export const MANAGER = "Rafael Souza";

const SHIFT_END_HOUR: Record<Shift, number> = { 1: 13, 2: 22, 3: 4 };

export const REWORK_REASONS = [
  "Rebarba na peça",
  "Cor fora do padrão",
  "Montagem invertida",
  "Falha no teste elétrico",
  "Encaixe com folga",
];

const NOTES = [
  "Máquina parada 40 min para troca de molde.",
  "Falta de matéria-prima no início do turno; produção começou às 5h50.",
  "Setup demorado por ajuste de temperatura.",
  "Operador novo em treinamento neste turno.",
  "Troca de bobina de filme fora do previsto.",
  "Parada de 25 min por queda de energia na linha.",
  "Produção normal, sem ocorrências.",
  "Ajuste de ferramenta depois do intervalo.",
  "Aguardando manutenção no alimentador vibratório.",
  "Lote de tampas com variação de cor; separado para inspeção.",
];
const REPLIES = [
  "Obrigado pelo aviso. Já acionei a manutenção.",
  "Ok. Separa o lote e identifica para a qualidade.",
  "O material chega no início do próximo turno.",
  "Registrado, vamos acompanhar no próximo turno.",
  "Pode seguir com o setup e avisa quando liberar.",
  "Ciente. Se repetir, abre chamado para a engenharia.",
];
const FOLLOW_UPS = ["Resolvido, máquina voltou ao normal.", "Lote liberado pela qualidade.", "Material chegou, produção retomada."];
const PAUSE_REASONS = ["Falta de material", "Máquina em manutenção", "Aguardando liberação da qualidade"];

/** Divide `total` em partes inteiras proporcionais aos pesos, somando exatamente `total`. */
function split(total: number, weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  parts[parts.length - 1] += total - parts.reduce((s, p) => s + p, 0);
  return parts;
}

const trendFrom = (daily: Map<number, number>): DayPoint[] =>
  ELAPSED_DATES.slice(-14).map((date) => ({ date, value: daily.get(dayKey(date)) ?? null }));

const at = (date: Date, hour: number, minute: number) => new Date(YEAR, MONTH, date.getDate(), hour, minute);

function buildMachine(raw: RawCenter, index: number): Machine {
  const random = rng(index * 7919 + 17);
  const extra = rng(index * 104729 + 7);
  const hasTarget = raw.perShift != null;
  const target = hasTarget ? raw.perShift! * raw.regime * WORKING_DAYS : 0;
  const produced = hasTarget ? Math.round(target * raw.attainment!) : raw.demandVolume!;
  const percent = hasTarget ? Math.round((produced / target) * 100) : 0;
  // Peso de cada turno: o T3 só existe no regime 3 (hoje, hora extra)
  const shiftProfile: [number, number, number] = raw.regime === 3 ? [0.4, 0.36, 0.24] : [0.52, 0.48, 0];

  // Dias apontados: o último é fixo; os demais saem de um embaralhamento determinístico
  const candidates = WORKING_DATES.filter((d) => d.getDate() < raw.lastDay);
  const shuffled = candidates
    .map((d) => ({ d, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.d);
  const lastDate = new Date(YEAR, MONTH, raw.lastDay);
  const entryDates = [lastDate, ...shuffled.slice(0, raw.days - 1)].sort((a, b) => b.getTime() - a.getTime());

  const perDay = split(
    produced,
    entryDates.map(() => 0.7 + random() * 0.6),
  );

  const daily = new Map<number, number>();
  const orders: ProductionOrder[] = [];
  const byShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const ordersByShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const minutesByShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const USEFUL: Record<Shift, number> = { 1: 493, 2: 481, 3: 271 };
  let seq = 0;

  entryDates.forEach((date, d) => {
    daily.set(dayKey(date), perDay[d]);
    let shifts = SHIFTS.filter((s) => shiftProfile[s - 1] > 0 && random() < 0.55 + shiftProfile[s - 1]);
    if (shifts.length === 0) shifts = [1];
    const quantities = split(
      perDay[d],
      shifts.map((s) => shiftProfile[s - 1] * (0.8 + random() * 0.4)),
    );
    shifts.forEach((shift, i) => {
      byShift[shift] += quantities[i];
      ordersByShift[shift] += 1;
      // tempo produtivo do turno: tempo útil menos paradas (fictício)
      const worked = Math.round(USEFUL[shift] * (0.72 + extra() * 0.22));
      minutesByShift[shift] += worked;
      const rework = extra() < raw.reworkRate;
      const operators = OPERATORS[shift];
      const operator = operators[(index + Math.floor(extra() * operators.length)) % operators.length];
      const minutes = 5 + Math.floor(extra() * 45);
      const noteRoll = extra();
      const reworkReason = rework ? REWORK_REASONS[Math.floor(extra() * REWORK_REASONS.length)] : null;
      const REWORK_NOTES = [
        "peças separadas e identificadas na caixa.",
        "lote segregado para inspeção da qualidade.",
        "retrabalho feito no próprio turno.",
      ];
      const id = `e-${raw.id}-${seq++}`;
      orders.push({
        id,
        opId: "", // preenchido ao montar as OPs
        machineId: raw.id,
        date,
        shift,
        material: "",
        product: "",
        quantity: quantities[i],
        minutes: worked,
        rework,
        reworkReason,
        operator,
        recordedAt: at(date, SHIFT_END_HOUR[shift], minutes),
        note:
          noteRoll < 0.22 || rework
            ? {
                id: `n-${id}`,
                text: rework
                  ? `${reworkReason}: ${REWORK_NOTES[Math.floor(noteRoll * 3)]}`
                  : NOTES[Math.floor(noteRoll * 45) % NOTES.length],
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
    line: raw.line,
    lines: hasTarget ? [raw.line] : [raw.line, "Por demanda"],
    hasTarget,
    regime: raw.regime,
    days: raw.days,
    produced,
    target,
    percent,
    status: statusFor(percent),
    dailyTarget: Math.round(target / WORKING_DAYS),
    daily,
    trend: trendFrom(daily),
    byShift,
    ordersByShift,
    minutesByShift,
    lastEntry: { date: last.date, shift: lastShift },
    orders,
  };
}

/* ============================================================
 * OPs (ordens de produção) e a conversa de cada uma
 * ============================================================ */

/** Etapas: Aguardando liberação → Em produção ⇄ Pausada → Concluída */
export type OpStage = "waiting" | "running" | "paused" | "done";

export const OP_STAGE_META: Record<OpStage, { label: string; appearance: "neutral" | "information" | "warning" | "success" }> = {
  waiting: { label: "Aguardando liberação", appearance: "neutral" },
  running: { label: "Em produção", appearance: "information" },
  paused: { label: "Pausada", appearance: "warning" },
  done: { label: "Concluída", appearance: "success" },
};

/** operator = observação vinda do apontamento (o operador não acessa a conversa) */
export type MessageRole = "operator" | "setter" | "leader" | "manager" | "system";

export interface OpMessage {
  id: string;
  opId: string;
  at: Date;
  author: string;
  role: MessageRole;
  shift?: Shift;
  text: string;
  /** mensagem nascida de um apontamento com retrabalho */
  rework?: boolean;
}

export interface WorkOrder {
  /** número da OP ("OP 4501234") */
  id: string;
  machineId: string;
  /** código do material (8 dígitos) que anda junto com a OP */
  material: string;
  /** descrição do material */
  product: string;
  /** quantidade pedida na OP */
  planned: number;
  /** soma dos apontamentos */
  produced: number;
  stage: OpStage;
  releasedAt: Date;
  closedAt: Date | null;
  pauseReason: string | null;
  entryIds: string[];
  messages: OpMessage[];
}

/** Atingiu a quantidade da OP: o sistema sugere concluir, uma pessoa confirma */
export const isReadyToClose = (op: WorkOrder) => op.stage === "running" && op.produced >= op.planned;

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** Código de material fictício e estável por produto (mesmo produto → mesmo material) */
export function materialOf(product: string) {
  let h = 7;
  for (const ch of product) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(10000000 + (h % 9000000));
}
const minutesLater = (d: Date, min: number) => new Date(d.getTime() + min * 60000);

function buildWorkOrders(m: Machine, index: number, products: string[]): WorkOrder[] {
  const random = rng(index * 31337 + 11);
  const entries = [...m.orders].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const avg = m.produced / Math.max(1, entries.length);
  const ops: WorkOrder[] = [];
  let seq = 0;
  const nextId = () => `OP ${4510000 + index * 1009 + seq++ * 17}`;

  let current: WorkOrder | null = null;
  const open = (first: Date) => {
    const product = products[Math.floor(random() * products.length)];
    const releasedAt = at(new Date(first.getTime() - 86400000 * (random() < 0.5 ? 1 : 0)), 7, Math.floor(random() * 50));
    const op: WorkOrder = {
      id: nextId(),
      machineId: m.id,
      material: materialOf(product),
      product,
      planned: roundTo(avg * (2 + Math.floor(random() * 4)), 500),
      produced: 0,
      stage: "running",
      releasedAt: releasedAt < first ? releasedAt : minutesLater(first, -120),
      closedAt: null,
      pauseReason: null,
      entryIds: [],
      messages: [],
    };
    const leader = LEADERS[1];
    op.messages.push({ id: `${op.id}-rel`, opId: op.id, at: op.releasedAt, author: leader, role: "leader", shift: 1, text: "OP liberada para produção." });
    ops.push(op);
    return op;
  };

  for (const e of entries) {
    if (!current) current = open(e.recordedAt);
    const op: WorkOrder = current;
    e.opId = op.id;
    e.material = op.material;
    e.product = op.product;
    op.produced += e.quantity;
    op.entryIds.push(e.id);
    if (e.note) {
      op.messages.push({ id: e.note.id, opId: op.id, at: e.recordedAt, author: e.operator, role: "operator", shift: e.shift, text: e.note.text, rework: e.rework });
      const roll = random();
      if (roll < 0.6) {
        // quem responde: gestor, líder ou preparador do turno
        const role: MessageRole = roll < 0.1 ? "manager" : roll < 0.3 ? "leader" : "setter";
        const replier = role === "manager" ? MANAGER : role === "leader" ? LEADERS[e.shift] : SETTERS[e.shift];
        const replyAt = minutesLater(e.recordedAt, 20 + Math.floor(random() * 70));
        op.messages.push({
          id: `${e.note.id}-r`,
          opId: op.id,
          at: replyAt,
          author: replier,
          role,
          shift: role === "manager" ? undefined : e.shift,
          text: REPLIES[Math.floor(random() * REPLIES.length)],
        });
        // o preparador fecha o assunto quando resolve
        if (roll < 0.3)
          op.messages.push({
            id: `${e.note.id}-f`,
            opId: op.id,
            at: minutesLater(replyAt, 30 + Math.floor(random() * 60)),
            author: SETTERS[e.shift],
            role: "setter",
            shift: e.shift,
            text: FOLLOW_UPS[Math.floor(random() * FOLLOW_UPS.length)],
          });
      }
    }
    // Atingiu a quantidade: fecha (menos a última, que fica "pronta para concluir" às vezes)
    if (op.produced >= op.planned && e !== entries[entries.length - 1]) {
      const closer = LEADERS[e.shift === 3 ? 1 : e.shift];
      op.stage = "done";
      op.closedAt = minutesLater(e.recordedAt, 15 + Math.floor(random() * 40));
      op.messages.push({ id: `${op.id}-done`, opId: op.id, at: op.closedAt, author: closer, role: "system", text: `OP concluída por ${closer}.` });
      current = null;
    }
  }

  // A OP em andamento: parada há dias → pausada com motivo
  const live = ops[ops.length - 1];
  if (live && live.stage === "running" && m.lastEntry && REFERENCE_DAY - m.lastEntry.date.getDate() >= 2) {
    const reason = PAUSE_REASONS[index % PAUSE_REASONS.length];
    live.stage = "paused";
    live.pauseReason = reason;
    const pausedAt = at(new Date(YEAR, MONTH, m.lastEntry.date.getDate() + 1), 6, 10);
    live.messages.push({ id: `${live.id}-pause`, opId: live.id, at: pausedAt, author: LEADERS[1], role: "system", text: `Pausada por ${LEADERS[1]}: ${reason}.` });
  }

  // Próximas OPs já cadastradas, esperando ir para a produção
  const waiting = Math.floor(random() * 3);
  for (let i = 0; i < waiting; i++) {
    const releasedAt = at(new Date(YEAR, MONTH, REFERENCE_DAY - Math.floor(random() * 3)), 8 + i, Math.floor(random() * 50));
    const id = nextId();
    const product = products[Math.floor(random() * products.length)];
    ops.push({
      id,
      machineId: m.id,
      material: materialOf(product),
      product,
      planned: roundTo(avg * (2 + Math.floor(random() * 3)), 500),
      produced: 0,
      stage: "waiting",
      releasedAt,
      closedAt: null,
      pauseReason: null,
      entryIds: [],
      messages: [{ id: `${id}-in`, opId: id, at: releasedAt, author: MANAGER, role: "system", text: "OP cadastrada no sistema. Aguardando liberação para a produção." }],
    });
  }

  for (const op of ops) op.messages.sort((a, b) => a.at.getTime() - b.at.getTime());
  return ops;
}

export const MACHINES: Machine[] = RAW.map(buildMachine);
export const machineById = (id: string) => MACHINES.find((m) => m.id === id)!;
/** Centros com meta: são os que entram no atingimento (Dashboard, gráficos, TV, ranking) */
export const TARGET_MACHINES = MACHINES.filter((m) => m.hasTarget);
export const DEMAND_MACHINES = MACHINES.filter((m) => !m.hasTarget);

/** Todas as OPs do mês (inclusive as que aguardam liberação) */
export const WORK_ORDERS: WorkOrder[] = MACHINES.flatMap((m, i) => buildWorkOrders(m, i, RAW[i].products));

/** Todos os apontamentos do mês, do mais recente para o mais antigo */
export const ALL_ORDERS: ProductionOrder[] = MACHINES.flatMap((m) => m.orders).sort(
  (a, b) => b.recordedAt.getTime() - a.recordedAt.getTime(),
);

/* ---------- Linhas ---------- */
export interface MachineGroup {
  id: string;
  label: Line;
  machineIds: string[];
}
export const MACHINE_GROUPS: MachineGroup[] = LINES.map((line) => ({
  id: line.toLowerCase(),
  label: line,
  machineIds: MACHINES.filter((m) => m.line === line).map((m) => m.id),
}));
export const groupOf = (machineId: string) => MACHINE_GROUPS.find((g) => g.machineIds.includes(machineId))!;

/* ---------- Metas ---------- */
export const ACTIVE_SHIFTS = 3;
export const META_EFFECTIVE_FROM = new Date(YEAR, MONTH, 1);
/** Meta por turno derivada da meta do mês (meta/mês = meta/turno × turnos do centro × dias úteis) */
export const metaPerShift = (m: Machine, shifts: number = m.regime) => Math.round(m.target / (WORKING_DAYS * shifts));

export interface MetaChange {
  id: string;
  date: Date;
  author: string;
  summary: string;
}
export const META_CHANGES: MetaChange[] = [
  { id: "c3", date: new Date(YEAR, MONTH, 1, 8, 12), author: MANAGER, summary: `Metas de março publicadas para ${TARGET_MACHINES.length} centros` },
  { id: "c2", date: new Date(YEAR, 1, 24, 16, 40), author: MANAGER, summary: "Embaladora vertical módulos nº 1: meta por turno de 11.000 para 11.600" },
  { id: "c1", date: new Date(YEAR, 1, 2, 9, 5), author: LEADERS[1], summary: "Composé nº 1 e tomadas Composé passam a rodar no 3º turno" },
];

/* ---------- Feedbacks (observações dos apontamentos) ---------- */
export const FEEDBACKS = ALL_ORDERS.filter((o) => o.note);
/** As 12 mensagens mais recentes de operadores começam como não lidas */
export const INITIAL_UNREAD = WORK_ORDERS.flatMap((op) => op.messages)
  .filter((msg) => msg.role === "operator")
  .sort((a, b) => b.at.getTime() - a.at.getTime())
  .slice(0, 12)
  .map((msg) => msg.id);

/* ---------- Período de análise ---------- */
/** Intervalo de datas (inclusivo). Os dados do protótipo cobrem março/2026 até o dia 27. */
export interface DateRange {
  from: Date;
  to: Date;
}
/** Mês inteiro (dias futuros contam só na meta) — é o recorte padrão */
export const MONTH_RANGE: DateRange = { from: new Date(YEAR, MONTH, 1), to: new Date(YEAR, MONTH, 31) };
export const DATA_START = new Date(YEAR, MONTH, 1);
export const DATA_END = REFERENCE_DATE;

const inRange = (d: Date, r: DateRange) => d >= r.from && d <= r.to;
export const workingDatesIn = (r: DateRange) => WORKING_DATES.filter((d) => inRange(d, r));
export const isMonthRange = (r: DateRange) => r.from.getTime() === MONTH_RANGE.from.getTime() && r.to.getTime() === MONTH_RANGE.to.getTime();

/**
 * Recorta o centro por turno e por período: produção, dias, ordens, turnos,
 * minutos e tendência só do recorte. A meta acompanha: a do turno (meta ÷
 * turnos do centro) e proporcional aos dias úteis do período.
 */
export function scopeMachine(m: Machine, shift: Shift | "all", range: DateRange = MONTH_RANGE): Machine {
  if (shift === "all" && isMonthRange(range)) return m;
  const orders = m.orders.filter((o) => (shift === "all" || o.shift === shift) && inRange(o.date, range));
  const daily = new Map<number, number>();
  const byShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const ordersByShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  const minutesByShift: Record<Shift, number> = { 1: 0, 2: 0, 3: 0 };
  for (const o of orders) {
    daily.set(dayKey(o.date), (daily.get(dayKey(o.date)) ?? 0) + o.quantity);
    byShift[o.shift] += o.quantity;
    ordersByShift[o.shift] += 1;
    minutesByShift[o.shift] += o.minutes;
  }
  const produced = orders.reduce((s, o) => s + o.quantity, 0);
  const monthTarget = shift === "all" ? m.target : shift <= m.regime ? m.target / m.regime : 0;
  const target = Math.round(monthTarget * (workingDatesIn(range).length / WORKING_DAYS));
  const percent = target ? Math.round((produced / target) * 100) : 0;
  const last = orders[0];
  return {
    ...m,
    orders,
    daily,
    produced,
    target,
    percent,
    status: statusFor(percent),
    days: daily.size,
    dailyTarget: Math.round(monthTarget / WORKING_DAYS),
    trend: ELAPSED_DATES.filter((d) => d <= range.to)
      .slice(-14)
      .map((date) => ({ date, value: daily.get(dayKey(date)) ?? null })),
    byShift,
    ordersByShift,
    minutesByShift,
    lastEntry: last ? { date: last.date, shift: last.shift } : null,
  };
}

/** Recorte só por turno (mês inteiro) */
export const scopeToShift = (m: Machine, shift: Shift | "all") => scopeMachine(m, shift);

/** Totais do recorte; `workingDays` = dias úteis do período (taxa de apontamento) */
export function aggregate(machines: Machine[], workingDays = WORKING_DAYS) {
  const produced = machines.reduce((s, m) => s + m.produced, 0);
  const target = machines.reduce((s, m) => s + m.target, 0);
  const days = machines.reduce((s, m) => s + m.days, 0);
  return {
    count: machines.length,
    produced,
    target,
    percent: target ? Math.round((produced / target) * 100) : 0,
    entryRate: machines.length ? Math.round((days / (machines.length * Math.max(1, workingDays))) * 100) : 0,
  };
}

/** Produção por turno somando os centros (ordem fixa 1, 2, 3); meta só dos turnos em que cada centro roda */
export function shiftTotals(machines: Machine[]) {
  return SHIFTS.map((shift) => {
    const running = machines.filter((m) => shift <= m.regime);
    const produced = machines.reduce((s, m) => s + m.byShift[shift], 0);
    const minutes = machines.reduce((s, m) => s + m.minutesByShift[shift], 0);
    return {
      shift,
      produced,
      orders: machines.reduce((s, m) => s + m.ordersByShift[shift], 0),
      target: Math.round(running.reduce((s, m) => s + m.target / m.regime, 0)),
      /** peças por minuto de produção */
      perMinute: minutes ? produced / minutes : 0,
      rework: machines.reduce((s, m) => s + m.orders.filter((o) => o.shift === shift && o.rework).length, 0),
    };
  });
}

/** Série diária da fábrica no período (dias úteis) e acumulado vs meta */
export function plantSeries(machines: Machine[], range: DateRange = MONTH_RANGE) {
  // soma das metas diárias (já no recorte de turno de cada máquina)
  const dailyTarget = machines.reduce((s, m) => s + m.dailyTarget, 0);
  let cumulative = 0;
  return workingDatesIn(range).map((date, i) => {
    const elapsed = date <= DATA_END;
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

/** Produção de fevereiro dos centros com meta (fictícia): março está 12,4% acima */
export const PREVIOUS_MONTH_PRODUCED = Math.round(aggregate(TARGET_MACHINES).produced / 1.124);
