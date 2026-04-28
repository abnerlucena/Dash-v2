import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, X, FileText, Download, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import type { ProdRecord, Holiday } from "@/lib/api";
import { dispD } from "@/lib/api";
import { exportToCSV, type CSVExportConfig } from "@/utils/exportCSV";
import { exportToPDF, type PDFExportConfig } from "@/utils/exportPDF";

interface ExportSection {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  order: number;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  format: "csv" | "pdf";
  records: ProdRecord[];
  filters: { dateFrom: string; dateTo: string; machine?: string; turno?: string };
  holidays?: Holiday[];
}

const PDF_SECTIONS: ExportSection[] = [
  { id: "resumo",    label: "KPIs Resumidos",             description: "Produção total, meta, atingimento e período",         enabled: true,  order: 0 },
  { id: "graficos",  label: "Imagens dos Gráficos",       description: "Capturas dos 4 gráficos (requer aba Gráficos aberta)", enabled: false, order: 1 },
  { id: "detalhado", label: "Tabela Detalhada",           description: "Todos os registros com data, turno, máquina e ordens", enabled: true,  order: 2 },
  { id: "turnos",    label: "Breakdown por Turno",        description: "Produção comparativa por turno para cada máquina",     enabled: true,  order: 3 },
];

const CSV_SECTIONS: ExportSection[] = [
  { id: "resumo",    label: "Totais no Cabeçalho",  description: "Produção total, meta e % de atingimento no início do arquivo", enabled: true,  order: 0 },
  { id: "detalhado", label: "Registros Individuais", description: "Uma linha por registro com todos os campos disponíveis",        enabled: true,  order: 1 },
  { id: "turnos",    label: "Breakdown por Turno",   description: "Tabela comparativa por turno ao final do arquivo",             enabled: false, order: 2 },
];

const ExportModal = ({ open, onClose, format, records, filters, holidays }: ExportModalProps) => {
  const initialSections = format === "pdf" ? PDF_SECTIONS : CSV_SECTIONS;
  const [sections, setSections] = useState<ExportSection[]>(() => initialSections.map(s => ({ ...s })));
  const [exporting, setExporting] = useState(false);

  const enabledCount = sections.filter(s => s.enabled).length;

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function moveSection(id: string, direction: "up" | "down") {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(s => s.id === id);
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;

      // Swap orders
      const newOrder = [...prev];
      const aIdx = newOrder.findIndex(s => s.id === sorted[idx].id);
      const bIdx = newOrder.findIndex(s => s.id === sorted[targetIdx].id);
      const tempOrder = newOrder[aIdx].order;
      newOrder[aIdx] = { ...newOrder[aIdx], order: newOrder[bIdx].order };
      newOrder[bIdx] = { ...newOrder[bIdx], order: tempOrder };
      return newOrder;
    });
  }

  async function handleExport() {
    if (enabledCount === 0) return;
    setExporting(true);

    const sectionConfig = sections.map(s => ({ id: s.id, enabled: s.enabled, order: s.order }));

    try {
      if (format === "csv") {
        const cfg: CSVExportConfig = { sections: sectionConfig };
        exportToCSV(records, filters, cfg, undefined, holidays);
        toast.success("CSV exportado com sucesso!");
        onClose();
      } else {
        const cfg: PDFExportConfig = { sections: sectionConfig };
        await exportToPDF(records, filters, cfg, undefined, holidays);
        toast.success("PDF exportado com sucesso!");
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  // Reset sections when format changes (via reopening)
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="export-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden"
          style={{ borderRadius: 14 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between" style={{ background: "#003366" }}>
            <div className="flex items-center gap-2.5">
              {format === "pdf" ? <FileText size={16} className="text-blue-300" /> : <Download size={16} className="text-blue-300" />}
              <div>
                <p className="text-sm font-bold text-white">
                  Configurar Exportação — {format.toUpperCase()}
                </p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {dispD(filters.dateFrom)} a {dispD(filters.dateTo)} · {records.length} registros
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Section list */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Seções a incluir
            </p>
            {sorted.map((section, idx) => (
              <div
                key={section.id}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${section.enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: "#0066B3" }}
                />

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${section.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {section.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {section.description}
                  </p>
                </div>

                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveSection(section.id, "up")}
                    disabled={idx === 0}
                    className="w-6 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveSection(section.id, "down")}
                    disabled={idx === sorted.length - 1}
                    className="w-6 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 bg-muted/30">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckSquare size={12} className="text-primary" />
              {enabledCount} de {sections.length} seção(ões) selecionada(s)
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={exporting}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || enabledCount === 0}
                className="px-4 py-2 text-sm font-bold rounded-lg text-white transition-all disabled:opacity-50"
                style={{ background: "#0066B3" }}
              >
                {exporting ? "Exportando..." : `Exportar ${format.toUpperCase()}`}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportModal;
