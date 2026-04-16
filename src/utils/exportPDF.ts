import type { ProdRecord, Holiday } from "@/lib/api";
import { dispD, pctColor } from "@/lib/api";

export interface PDFFilters {
  dateFrom: string;
  dateTo: string;
  machine?: string;
  turno?: string;
}

export interface PDFSectionConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export interface PDFExportConfig {
  sections: PDFSectionConfig[];
  chartImages?: { bar?: string; area?: string; pie?: string; hbar?: string };
  turnoBreakdown?: Array<{ machineName: string; t1: number; t2: number; t3: number; total: number }>;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

// Default config — all key sections enabled in natural order
const DEFAULT_CONFIG: PDFExportConfig = {
  sections: [
    { id: "resumo",    enabled: true,  order: 0 },
    { id: "graficos",  enabled: true,  order: 1 },
    { id: "detalhado", enabled: true,  order: 2 },
    { id: "turnos",    enabled: true,  order: 3 },
    { id: "analytics", enabled: false, order: 4 },
  ],
};

function isEnabled(config: PDFExportConfig, id: string): boolean {
  const s = config.sections.find(s => s.id === id);
  return s?.enabled ?? false;
}

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

export async function exportToPDF(
  records: ProdRecord[],
  filters: PDFFilters,
  config?: PDFExportConfig,
  filename?: string,
  holidays?: Holiday[]
): Promise<void> {
  const cfg = config ?? DEFAULT_CONFIG;

  // Determine active section IDs sorted by order
  const activeSections = [...cfg.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map(s => s.id);

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

  let cursorY = 32;

  // ── KPI summary bar ─────────────────────────────────────────
  if (activeSections.includes("resumo")) {
    const totalProd = records.reduce((s, r) => s + (r.producao || 0), 0);
    const totalMeta = records.reduce((s, r) => s + (r.meta || 0), 0);
    const globalPct = totalMeta > 0 ? Math.round((totalProd / totalMeta) * 100) : null;

    const kpis = [
      { label: "Registros",       value: String(records.length) },
      { label: "Produção Total",  value: totalProd.toLocaleString("pt-BR") + " pç" },
      { label: "Meta Total",      value: totalMeta.toLocaleString("pt-BR") + " pç" },
      { label: "Atingimento",     value: globalPct !== null ? globalPct + "%" : "—" },
    ];

    const kpiW = pageW / kpis.length;
    kpis.forEach((kpi, idx) => {
      const x = idx * kpiW + 6;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label.toUpperCase(), x, cursorY + 5);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      if (kpi.label === "Atingimento" && globalPct !== null) {
        const rgb = hexToRgb(pctColor(globalPct));
        doc.setTextColor(...rgb);
      } else {
        doc.setTextColor(...navy);
      }
      doc.text(kpi.value, x, cursorY + 12);
    });
    cursorY += 20;
  }

  // ── Chart images ─────────────────────────────────────────────
  if (activeSections.includes("graficos") && cfg.chartImages) {
    const imgs = cfg.chartImages;
    const imgKeys: Array<keyof typeof imgs> = ["bar", "area", "pie", "hbar"];
    const margin = 12;
    const imgW = pageW - 2 * margin;

    for (const key of imgKeys) {
      const dataUrl = imgs[key];
      if (!dataUrl) continue;
      doc.addPage();

      // Re-draw the header stripe on each chart page
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 8, "F");
      doc.setFontSize(8);
      doc.setTextColor(180, 210, 240);
      doc.setFont("helvetica", "normal");
      doc.text("Relatório de Produção — WEG", 12, 6);

      const imgH = Math.min(imgW * 0.55, doc.internal.pageSize.getHeight() - 20);
      try {
        doc.addImage(dataUrl, "JPEG", margin, 12, imgW, imgH, undefined, "FAST");
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gráfico "${key}" não disponível`, margin, 20);
      }
    }
    doc.addPage();
    cursorY = 12;
  } else if (activeSections.includes("graficos")) {
    // Charts section requested but no images captured
    // (user hadn't opened the Gráficos tab — skip silently)
  }

  // ── Detalhado table ──────────────────────────────────────────
  if (activeSections.includes("detalhado")) {
    if (cursorY < 40) cursorY = 40; // ensure below KPI bar

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
      startY: cursorY,
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
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
        if (data.column.index === 5 && data.section === "body") {
          const raw = String(data.cell.raw).replace("%", "");
          const n = parseInt(raw, 10);
          if (!isNaN(n)) {
            const rgb = hexToRgb(pctColor(n));
            data.cell.styles.textColor = rgb;
            data.cell.styles.fontStyle = "bold";
          }
        }
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
    cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY;
  }

  // ── Turnos breakdown table ────────────────────────────────────
  if (activeSections.includes("turnos")) {
    const breakdown = cfg.turnoBreakdown ?? computeTurnoBreakdown(records);

    if (breakdown.length > 0) {
      doc.addPage();
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 8, "F");
      doc.setFontSize(8);
      doc.setTextColor(180, 210, 240);
      doc.setFont("helvetica", "normal");
      doc.text("Breakdown por Turno", 12, 6);

      autoTable(doc, {
        head: [["Máquina", "Turno 1", "Turno 2", "Turno 3", "Total"]],
        body: breakdown.map(b => [
          b.machineName,
          b.t1 > 0 ? b.t1.toLocaleString("pt-BR") : "—",
          b.t2 > 0 ? b.t2.toLocaleString("pt-BR") : "—",
          b.t3 > 0 ? b.t3.toLocaleString("pt-BR") : "—",
          b.total.toLocaleString("pt-BR"),
        ]),
        startY: 12,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30, halign: "right" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
        },
      });
    }
  }

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
