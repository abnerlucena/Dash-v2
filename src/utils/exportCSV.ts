import type { ProdRecord, Holiday } from "@/lib/api";
import { dispD } from "@/lib/api";

export interface CSVFilters {
  dateFrom: string;
  dateTo: string;
  machine?: string;
  turno?: string;
}

export function exportToCSV(
  records: ProdRecord[],
  filters: CSVFilters,
  filename?: string,
  holidays?: Holiday[]
): void {
  const holidayMap = new Map<string, Holiday>();
  for (const h of holidays ?? []) holidayMap.set(h.date, h);

  const bom = "\uFEFF";
  const lines = [
    '"Relatório de Produção WEG"',
    `"Período:";"${dispD(filters.dateFrom)} a ${dispD(filters.dateTo)}"`,
    "",
    '"Data";"Turno";"Máquina";"Meta";"Produção";"% Meta";"Apontado por";"Editado por";"Editado em";"Observação";"Feriado/Dia Anulado";"Ordens de Produção"',
  ];

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

  const csv = bom + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || `producao_${filters.dateFrom}_a_${filters.dateTo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5_000);
}
