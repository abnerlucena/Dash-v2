import type { ProdRecord, Holiday } from "@/lib/api";
import { dispD, pctColor } from "@/lib/api";

export interface PDFFilters {
  dateFrom: string;
  dateTo: string;
  machine?: string;
  turno?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

export async function exportToPDF(
  records: ProdRecord[],
  filters: PDFFilters,
  filename?: string,
  holidays?: Holiday[]
): Promise<void> {
  // Dynamic import — keeps bundle clean if user never exports PDF
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const holidayMap = new Map<string, Holiday>();
  for (const h of holidays ?? []) holidayMap.set(h.date, h);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Cover / header banner ────────────────────────────────────
  const navy: [number, number, number] = [0, 29, 61];   // #001D3D
  const blue: [number, number, number] = [0, 102, 179]; // #0066B3

  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 28, "F");

  doc.setFillColor(...blue);
  doc.rect(0, 24, pageW, 4, "F");

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Produção — WEG", 12, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 210, 240);
  doc.text(
    `Período: ${dispD(filters.dateFrom)} a ${dispD(filters.dateTo)}   |   Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    12,
    22
  );

  // ── KPI summary bar ─────────────────────────────────────────
  const totalProd = records.reduce((s, r) => s + (r.producao || 0), 0);
  const totalMeta = records.reduce((s, r) => s + (r.meta || 0), 0);
  const globalPct = totalMeta > 0 ? Math.round((totalProd / totalMeta) * 100) : null;

  const kpis = [
    { label: "Registros", value: String(records.length) },
    { label: "Produção Total", value: totalProd.toLocaleString("pt-BR") + " pç" },
    { label: "Meta Total", value: totalMeta.toLocaleString("pt-BR") + " pç" },
    { label: "Atingimento", value: globalPct !== null ? globalPct + "%" : "—" },
  ];

  const kpiY = 32;
  const kpiW = pageW / kpis.length;
  kpis.forEach((kpi, idx) => {
    const x = idx * kpiW + 6;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label.toUpperCase(), x, kpiY + 5);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    if (kpi.label === "Atingimento" && globalPct !== null) {
      const rgb = hexToRgb(pctColor(globalPct));
      doc.setTextColor(...rgb);
    } else {
      doc.setTextColor(...navy);
    }
    doc.text(kpi.value, x, kpiY + 12);
  });

  // ── Data table ───────────────────────────────────────────────
  // Column widths (total ≈ 271mm, fits A4 landscape 277mm usable):
  // Data(20) Turno(14) Máquina(38) Meta(16) Prod(18) %(13) Por(20)
  // Edit.por(20) Edit.em(18) Obs(26) Feriado(20) Ordens(48)
  const head = [["Data", "Turno", "Máquina", "Meta", "Produção", "%", "Apontado por", "Edit. por", "Edit. em", "Obs", "Feriado", "Ordens"]];

  const body = records.map((r) => {
    const meta = r.meta || 0;
    const prod = r.producao || 0;
    const pct = meta > 0 ? Math.round((prod / meta) * 100) : null;

    const holiday = holidayMap.get(r.date);
    const feriadoStr = holiday
      ? `${holiday.label}\n(${holiday.type === "feriado" ? "Feriado" : "Dia Anulado"})`
      : "";

    const ordensStr = (r.ordensProducao || [])
      .map((o) => `#${o.ordemId} → ${o.quantidade} pç`)
      .join("\n");

    return [
      dispD(r.date),
      r.turno.replace("TURNO ", "T"),
      r.machineName,
      meta > 0 ? meta.toLocaleString("pt-BR") : "—",
      prod.toLocaleString("pt-BR"),
      pct !== null ? pct + "%" : "—",
      r.savedBy || "",
      r.editUser || "",
      r.editTime || "",
      r.obs || "",
      feriadoStr,
      ordensStr,
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: kpiY + 18,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0:  { cellWidth: 20 },
      1:  { cellWidth: 14 },
      2:  { cellWidth: 38 },
      3:  { cellWidth: 16, halign: "right" },
      4:  { cellWidth: 18, halign: "right", fontStyle: "bold" },
      5:  { cellWidth: 13, halign: "center" },
      6:  { cellWidth: 20 },
      7:  { cellWidth: 20 },
      8:  { cellWidth: 18 },
      9:  { cellWidth: 26 },
      10: { cellWidth: 20 },
      11: { cellWidth: 48 },
    },
    didParseCell(data) {
      // Color the % column based on value
      if (data.column.index === 5 && data.section === "body") {
        const raw = String(data.cell.raw).replace("%", "");
        const n = parseInt(raw, 10);
        if (!isNaN(n)) {
          const rgb = hexToRgb(pctColor(n));
          data.cell.styles.textColor = rgb;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Tint feriado cells light blue / light red
      if (data.column.index === 10 && data.section === "body") {
        const val = String(data.cell.raw);
        if (val.includes("Feriado")) {
          data.cell.styles.textColor = [29, 78, 216];
          data.cell.styles.fontStyle = "bold";
        } else if (val.includes("Dia Anulado")) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // ── Footer on each page ──────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      `WEG — Relatório de Produção   |   Página ${p} de ${totalPages}`,
      12,
      doc.internal.pageSize.getHeight() - 5
    );
  }

  doc.save(filename || `producao_${filters.dateFrom}_a_${filters.dateTo}.pdf`);
}
