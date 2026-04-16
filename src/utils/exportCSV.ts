import type { ProdRecord, Holiday } from "@/lib/api";
import { dispD } from "@/lib/api";

export interface CSVFilters {
  dateFrom: string;
  dateTo: string;
  machine?: string;
  turno?: string;
}

export interface CSVSectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export interface CSVExportConfig {
  sections: CSVSectionConfig[];
  turnoBreakdown?: Array<{ machineName: string; t1: number; t2: number; t3: number; total: number }>;
}

const DEFAULT_CSV_CONFIG: CSVExportConfig = {
  sections: [
    { id: "resumo",    enabled: true,  order: 0 },
    { id: "detalhado", enabled: true,  order: 1 },
    { id: "turnos",    enabled: false, order: 2 },
  ],
};

function computeTurnoBreakdown(records: ProdRecord[]) {
  const map: Record<string, { t1: number; t2: number; t3: number; total: number }> = {};
  for (const r of records) {
    if (!map[r.machineName]) map[r.machineName] = { t1: 0, t2: 0, t3: 0, total: 0 };
    const e = map[r.machineName];
    if (r.turno === "TURNO 1") e.t1 += r.producao;
    else if (r.turno === "TURNO 2") e.t2 += r.producao;
    else if (r.turno === "TURNO 3") e.t3 += r.producao;
    e.total += r.producao;
  }
  return Object.entries(map)
    .map(([machineName, d]) => ({ machineName, ...d }))
    .sort((a, b) => b.total - a.total);
}

export function exportToCSV(
  records: ProdRecord[],
  filters: CSVFilters,
  config?: CSVExportConfig,
  filename?: string,
  holidays?: Holiday[]
): void {
  const cfg = config ?? DEFAULT_CSV_CONFIG;

  const activeSections = [...cfg.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map(s => s.id);

  const holidayMap = new Map<string, Holiday>();
  for (const h of holidays ?? []) holidayMap.set(h.date, h);

  const bom = "\uFEFF";
  const lines: string[] = ['"Relatório de Produção WEG"'];

  // ── Resumo section ──────────────────────────────────────────
  if (activeSections.includes("resumo")) {
    const totalProd = records.reduce((s, r) => s + (r.producao || 0), 0);
    const totalMeta = records.reduce((s, r) => s + (r.meta || 0), 0);
    const globalPct = totalMeta > 0 ? Math.round((totalProd / totalMeta) * 100) : null;

    lines.push(`"Período:";"${dispD(filters.dateFrom)} a ${dispD(filters.dateTo)}"`);
    lines.push(`"Total de registros:";${records.length}`);
    lines.push(`"Produção Total:";${totalProd.toLocaleString("pt-BR")} pç`);
    lines.push(`"Meta Total:";${totalMeta.toLocaleString("pt-BR")} pç`);
    lines.push(`"Atingimento:";${globalPct !== null ? globalPct + "%" : "—"}`);
    lines.push("");
  } else {
    lines.push(`"Período:";"${dispD(filters.dateFrom)} a ${dispD(filters.dateTo)}"`);
    lines.push("");
  }

  // ── Detalhado section ───────────────────────────────────────
  if (activeSections.includes("detalhado")) {
    lines.push('"Data";"Turno";"Máquina";"Meta";"Produção";"% Meta";"Apontado por";"Editado por";"Editado em";"Observação";"Feriado/Dia Anulado";"Ordens de Produção"');

    for (const r of records) {
      const meta = r.meta || 0;
      const prod = r.producao || 0;
      const pct = meta > 0 ? Math.round((prod / meta) * 100) + "%" : "";

      const holiday = holidayMap.get(r.date);
      const feriadoStr = holiday
        ? `${holiday.label} (${holiday.type === "feriado" ? "Feriado" : "Dia Anulado"})`
        : "";

      const ordensStr = (r.ordensProducao || [])
        .map((o) => `#${o.ordemId} → ${o.quantidade} pç${o.obs ? ` (${o.obs})` : ""}`)
        .join(" | ");

      lines.push(
        [
          dispD(r.date),
          r.turno,
          r.machineName,
          meta,
          prod,
          pct,
          r.savedBy || "",
          r.editUser || "",
          r.editTime || "",
          r.obs || "",
          feriadoStr,
          ordensStr,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    }
  }

  // ── Turnos breakdown section ────────────────────────────────
  if (activeSections.includes("turnos")) {
    const breakdown = cfg.turnoBreakdown ?? computeTurnoBreakdown(records);
    if (breakdown.length > 0) {
      lines.push("");
      lines.push('"— Breakdown por Turno —"');
      lines.push('"Máquina";"Turno 1";"Turno 2";"Turno 3";"Total"');
      for (const b of breakdown) {
        lines.push(
          [b.machineName, b.t1 || "—", b.t2 || "—", b.t3 || "—", b.total]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(";")
        );
      }
    }
  }

  const csv = bom + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || `producao_${filters.dateFrom}_a_${filters.dateTo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
}
