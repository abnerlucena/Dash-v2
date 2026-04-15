import { useState, useEffect } from "react";
import { Bell, BellOff, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface AlertConfig {
  active: boolean;
  recipientEmail: string;
  thresholdPct: number;
  machines: number[];      // machineIds — empty = all
  frequency: "daily" | "immediate";
}

const FREQUENCIES = [
  { value: "daily",     label: "Diário (relatório)" },
  { value: "immediate", label: "Imediato (por registro)" },
] as const;

const AlertConfigPanel = () => {
  const { user, machines } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [config, setConfig] = useState<AlertConfig>({
    active: false,
    recipientEmail: "",
    thresholdPct: 80,
    machines: [],
    frequency: "daily",
  });

  useEffect(() => {
    api("getAlertConfig", {}, user)
      .then((r) => {
        if (r.config) {
          setConfig({
            active: r.config.active === true || r.config.active === "true",
            recipientEmail: r.config.recipientEmail || "",
            thresholdPct: Number(r.config.thresholdPct) || 80,
            machines: Array.isArray(r.config.machines) ? r.config.machines.map(Number) : [],
            frequency: r.config.frequency === "immediate" ? "immediate" : "daily",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMachine(id: number) {
    setConfig((prev) => ({
      ...prev,
      machines: prev.machines.includes(id)
        ? prev.machines.filter((m) => m !== id)
        : [...prev.machines, id],
    }));
  }

  async function handleSave() {
    if (config.active && !config.recipientEmail.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    try {
      await api("saveAlertConfig", { config }, user);
      toast.success("Configuração salva!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!config.recipientEmail.includes("@")) {
      toast.error("Informe um e-mail válido antes de testar.");
      return;
    }
    setTesting(true);
    try {
      await api("testAlertEmail", {}, user);
      toast.success("E-mail de teste enviado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar e-mail de teste.");
    }
    setTesting(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-3">
          {config.active
            ? <Bell size={18} className="text-primary" />
            : <BellOff size={18} className="text-muted-foreground" />}
          <div>
            <p className="text-sm font-bold text-foreground">Alertas por e-mail</p>
            <p className="text-[11px] text-muted-foreground">
              {config.active ? "Alertas ativados" : "Alertas desativados"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfig((p) => ({ ...p, active: !p.active }))}
          className={`relative w-12 h-6 rounded-full transition-colors ${config.active ? "bg-primary" : "bg-muted-foreground/30"}`}
          style={{ borderRadius: 12 }}>
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            style={{ transform: config.active ? "translateX(24px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {/* E-mail */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">
          E-mail de destino
        </label>
        <input
          type="email"
          value={config.recipientEmail}
          onChange={(e) => setConfig((p) => ({ ...p, recipientEmail: e.target.value }))}
          placeholder="operador@empresa.com"
          className={inputCls}
          disabled={!config.active}
        />
      </div>

      {/* Threshold */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 flex items-center justify-between">
          <span>Limiar de atenção</span>
          <span className="text-primary font-extrabold text-sm">{config.thresholdPct}%</span>
        </label>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={config.thresholdPct}
          onChange={(e) => setConfig((p) => ({ ...p, thresholdPct: Number(e.target.value) }))}
          disabled={!config.active}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>50%</span>
          <span>Alerta quando a produção ficar abaixo deste %</span>
          <span>100%</span>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">
          Frequência
        </label>
        <div className="flex gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setConfig((p) => ({ ...p, frequency: f.value }))}
              disabled={!config.active}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-50 ${
                config.frequency === f.value
                  ? "border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/20"
              }`}
              style={config.frequency === f.value ? { background: "#0066B310" } : {}}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Machine filter */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center justify-between">
          <span>Máquinas monitoradas</span>
          <button
            onClick={() => setConfig((p) => ({ ...p, machines: p.machines.length === machines.length ? [] : machines.map((m) => m.id) }))}
            disabled={!config.active}
            className="text-primary font-bold text-[10px] disabled:opacity-40">
            {config.machines.length === machines.length ? "Desmarcar todas" : "Todas"}
          </button>
        </label>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {machines.map((m) => {
            const checked = config.machines.length === 0 || config.machines.includes(m.id);
            return (
              <label key={m.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs font-medium ${
                  checked ? "border-primary/30 text-foreground" : "border-border text-muted-foreground"
                } ${!config.active ? "opacity-40 cursor-not-allowed" : "hover:border-primary/20"}`}
                style={checked ? { background: "#0066B308" } : {}}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => config.active && toggleMachine(m.id)}
                  className="accent-primary w-3 h-3"
                />
                <span className="truncate">{m.name}</span>
              </label>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {config.machines.length === 0
            ? "Todas as máquinas monitoradas"
            : `${config.machines.length} máquina${config.machines.length > 1 ? "s" : ""} selecionada${config.machines.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg,#003366,#0066B3)", borderRadius: 8 }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !config.recipientEmail}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-border text-foreground hover:bg-muted/50 disabled:opacity-40 transition-all"
          style={{ borderRadius: 8 }}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {testing ? "Enviando..." : "Testar e-mail"}
        </button>
      </div>
    </div>
  );
};

export default AlertConfigPanel;
