import { describe, it, expect } from "vitest";
import {
  buildProdRecords, shiftIdFromTurno, toOrdersJson, toMachine, toHoliday, holidayTypeToEventType,
  type SummaryRow, type OrderRow,
} from "@/lib/repositories/supabase/adapters";

const baseRow: SummaryRow = {
  id: "r1", production_date: "2026-09-19", shift_id: 1, shift_name: "TURNO 1",
  machine_id: 1, machine_name: "HORIZONTAL 1", target_quantity: 500, operator_count: 2,
  work_mode: "regular", notes: "obs", created_by: "u1", updated_by: null,
  created_at: "2026-09-19T12:00:00Z", updated_at: "2026-09-19T12:00:00Z",
  good_quantity: 400, rework_quantity: 100, total_quantity: 500, order_count: 2,
  staffing_ratio: 1, adjusted_target: 500, is_excluded_day: false, counts_toward_target: true,
};
const orders: OrderRow[] = [
  { production_record_id: "r1", order_number: "000001004521", quantity: 400, is_rework: false, notes: null },
  { production_record_id: "r1", order_number: "000001004522", quantity: 100, is_rework: true, notes: "refeito" },
];
const names = new Map([["u1", "Operador Um"]]);

describe("adaptadores Supabase → formato das telas", () => {
  it("usa a produção BOA como producao (retrabalho não é produção nova — D11)", () => {
    const [r] = buildProdRecords([baseRow], orders, names);
    expect(r.producao).toBe(400);
    expect(r.meta).toBe(500);
    expect(r.turno).toBe("TURNO 1");
    expect(r.savedBy).toBe("Operador Um");
    expect(r.ordensProducao).toEqual([
      { ordemId: "000001004521", quantidade: 400 },
      { ordemId: "000001004522", quantidade: 100, obs: "refeito", retrabalho: true },
    ]);
  });

  it("zera a meta da hora extra e do dia anulado, sem perder a produção (D27, D16)", () => {
    const [extra, anulado] = buildProdRecords([
      { ...baseRow, id: "r2", work_mode: "overtime", counts_toward_target: false },
      { ...baseRow, id: "r3", is_excluded_day: true, counts_toward_target: false },
    ], [], names);
    expect(extra.meta).toBe(0);
    expect(extra.producao).toBe(400);
    expect(extra.workMode).toBe("overtime");
    expect(extra.targetQuantity).toBe(500);
    expect(anulado.meta).toBe(0);
    expect(anulado.isExcludedDay).toBe(true);
  });

  it("converte turno em id e recusa texto inválido", () => {
    expect(shiftIdFromTurno("TURNO 3")).toBe(3);
    expect(() => shiftIdFromTurno("NOITE")).toThrow();
  });

  it("monta as ordens para a RPC ignorando quantidade zero e preservando zeros à esquerda", () => {
    expect(toOrdersJson([
      { ordemId: "000123", quantidade: 10, retrabalho: true },
      { ordemId: "", quantidade: 0 },
    ])).toEqual([{ order_number: "000123", quantity: 10, is_rework: true, notes: null }]);
  });

  it("traduz status de máquina e tipo de evento para os valores do legado", () => {
    expect(toMachine({ id: 1, name: "X", has_target: true, status: "inactive" }, 300))
      .toEqual({ id: 1, name: "X", hasMeta: true, defaultMeta: 300, status: "inativo" });
    expect(holidayTypeToEventType("dia_anulado")).toBe("excluded_day");
    const h = toHoliday({
      id: "e1", event_date: "2026-12-25", description: "Natal", event_type: "holiday",
      created_by: null, created_at: "2026-09-20T00:00:00Z", calendar_event_shifts: [{ shift_id: 2 }],
    }, names);
    expect(h).toMatchObject({ date: "2026-12-25", label: "Natal", type: "feriado", shiftIds: [2] });
  });
});
