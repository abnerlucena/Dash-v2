// ─── Adaptadores: formato do banco ⇄ formato atual das telas ──
// Funções puras (sem acesso a rede), testadas em src/test/adapters.test.ts.
//
// Regras de negócio aplicadas aqui, na fronteira, para que os gráficos
// atuais passem a seguir o desenho do banco sem serem reescritos:
//   • producao = produção BOA (good_quantity). Retrabalho não é produção
//     nova (D11); ele continua visível nas ordens marcadas como retrabalho.
//   • meta = 0 quando o apontamento NÃO conta para meta — hora extra (D27)
//     ou dia/turno anulado (D16). Os gráficos já ignoram meta 0 no cálculo
//     de atingimento; a produção continua somando no total.
import type { Tables } from "@/lib/database.types";
import type { Holiday, Machine, OrdemProducao, ProdRecord } from "@/lib/api";

export type SummaryRow = Tables<"production_summary">;
export type OrderRow = Pick<Tables<"production_orders">, "production_record_id" | "order_number" | "quantity" | "is_rework" | "notes">;
export type MachineRow = Pick<Tables<"machines">, "id" | "name" | "has_target" | "status">;
export type CalendarRow = Pick<Tables<"calendar_events">, "id" | "event_date" | "description" | "event_type" | "created_by" | "created_at"> & {
  calendar_event_shifts?: { shift_id: number }[] | null;
};

export const shiftName = (shiftId: number) => `TURNO ${shiftId}`;

export function shiftIdFromTurno(turno: string): number {
  const m = /(\d+)\s*$/.exec(String(turno || ""));
  if (!m) throw new Error(`Turno inválido: ${turno}`);
  return Number(m[1]);
}

export const MACHINE_STATUS_TO_LEGACY: Record<string, string> = {
  active: "ativo",
  inactive: "inativo",
  maintenance: "manutencao",
  preventive_maintenance: "preventiva",
};

/** Data/hora no mesmo formato que o legado gravava ("20/09/2026, 10:30:00"). */
export function toLegacyDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

export function toOrdens(orders: OrderRow[]): OrdemProducao[] {
  return orders.map(o => {
    const ordem: OrdemProducao = { ordemId: o.order_number, quantidade: o.quantity };
    if (o.notes) ordem.obs = o.notes;
    if (o.is_rework) ordem.retrabalho = true;
    return ordem;
  });
}

export function toProdRecord(row: SummaryRow, orders: OrderRow[], names: Map<string, string>): ProdRecord {
  const counts = row.counts_toward_target === true;
  const target = row.target_quantity ?? 0;
  const rec: ProdRecord = {
    id: row.id ?? undefined,
    date: row.production_date ?? "",
    turno: row.shift_name ?? shiftName(row.shift_id ?? 0),
    machineId: row.machine_id ?? 0,
    machineName: row.machine_name ?? "",
    meta: counts ? target : 0,
    producao: row.good_quantity ?? 0,
    savedBy: (row.created_by && names.get(row.created_by)) || "",
    savedAt: toLegacyDateTime(row.created_at),
    obs: row.notes ?? "",
    ordensProducao: toOrdens(orders),
    workMode: row.work_mode === "overtime" ? "overtime" : "regular",
    goodQuantity: row.good_quantity ?? 0,
    reworkQuantity: row.rework_quantity ?? 0,
    targetQuantity: target,
    countsTowardTarget: counts,
    isExcludedDay: row.is_excluded_day === true,
    operatorCount: row.operator_count,
  };
  if (row.updated_by) {
    rec.editUser = names.get(row.updated_by) || "";
    rec.editTime = toLegacyDateTime(row.updated_at);
  }
  return rec;
}

/** Junta os apontamentos com as ordens de cada um. */
export function buildProdRecords(rows: SummaryRow[], orders: OrderRow[], names: Map<string, string>): ProdRecord[] {
  const byRecord = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const list = byRecord.get(o.production_record_id);
    if (list) list.push(o); else byRecord.set(o.production_record_id, [o]);
  }
  return rows.map(r => toProdRecord(r, (r.id && byRecord.get(r.id)) || [], names));
}

/** Ordens da tela (formato legado) → JSON esperado por save_production_record. */
export function toOrdersJson(ordens: OrdemProducao[] | undefined) {
  return (ordens || [])
    .filter(o => Number(o.quantidade) > 0)
    .map(o => ({
      order_number: String(o.ordemId ?? "").trim(),
      quantity: Math.round(Number(o.quantidade)),
      is_rework: o.retrabalho === true,
      notes: o.obs ? String(o.obs) : null,
    }));
}

export function toMachine(row: MachineRow, target: number | undefined): Machine {
  return {
    id: row.id,
    name: row.name,
    hasMeta: row.has_target,
    defaultMeta: target ?? 0,
    status: MACHINE_STATUS_TO_LEGACY[row.status] ?? row.status,
  };
}

export function holidayTypeToEventType(type: Holiday["type"]): "holiday" | "excluded_day" {
  return type === "dia_anulado" ? "excluded_day" : "holiday";
}

export function toHoliday(row: CalendarRow, names: Map<string, string>): Holiday {
  const eventType = row.event_type as Holiday["eventType"];
  return {
    id: row.id,
    date: row.event_date,
    label: row.description,
    type: eventType === "excluded_day" ? "dia_anulado" : "feriado",
    createdBy: (row.created_by && names.get(row.created_by)) || "",
    createdAt: row.created_at,
    eventType,
    shiftIds: (row.calendar_event_shifts || []).map(s => s.shift_id).sort(),
  };
}

export const PROFILE_STATUS_TO_LEGACY: Record<string, string> = {
  active: "ativo",
  blocked: "bloqueado",
  pending: "pendente",
};
