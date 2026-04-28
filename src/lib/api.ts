// ─── API Layer ────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyeiU8btjcJdhZkv6MRo-_M1jLx7s7YD6GWMfxVB7PIkeoRC5Aiq8FwzJkKgEIbgAz8Ag/exec";
export const SESSION_KEY = "prod_session_v3";
const CACHE_KEY = "prod_records_cache";
const CACHE_METAS_KEY = "prod_metas_cache";
const CACHE_HOLIDAYS_KEY = "prod_holidays_cache";

export interface Session {
  token: string;
  nome: string;
  role: "admin" | "user";
  expiresAt?: string;
}

export interface Machine {
  id: number;
  name: string;
  hasMeta: boolean;
  defaultMeta: number;
  status?: string;
}

export interface Holiday {
  id: string;
  date: string;
  label: string;
  type: "feriado" | "dia_anulado";
  createdBy?: string;
  createdAt?: string;
}

export interface OrdemProducao {
  ordemId: string;
  quantidade: number;
  obs?: string;
  retrabalho?: boolean;
}

export interface ProdRecord {
  id?: string;
  date: string;
  turno: string;
  machineId: number;
  machineName: string;
  meta: number;
  producao: number;
  savedBy: string;
  savedAt?: string;
  editUser?: string;
  editTime?: string;
  obs?: string;
  ordensProducao?: OrdemProducao[];
}

// ─── Session helpers ──────────────────────────────────────────
export const loadSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
};
export const saveSession = (u: Session) => {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch {}
};
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_METAS_KEY);
    localStorage.removeItem(CACHE_HOLIDAYS_KEY);
  } catch {}
};

// ─── Cache helpers ────────────────────────────────────────────
export const loadCachedRecords = (): ProdRecord[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); }
  catch { return []; }
};
export const saveCachedRecords = (data: ProdRecord[]) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
};
export const loadCachedMetas = (): Record<number, number> | null => {
  try { return JSON.parse(localStorage.getItem(CACHE_METAS_KEY) || "null"); }
  catch { return null; }
};
export const saveCachedMetas = (m: Record<number, number>) => {
  try { localStorage.setItem(CACHE_METAS_KEY, JSON.stringify(m)); } catch {}
};
export const loadCachedHolidays = (): Holiday[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_HOLIDAYS_KEY) || "[]"); }
  catch { return []; }
};
export const saveCachedHolidays = (h: Holiday[]) => {
  try { localStorage.setItem(CACHE_HOLIDAYS_KEY, JSON.stringify(h)); } catch {}
};

// ─── cellKey ──────────────────────────────────────────────────
export const cellKey = (mId: number, d: string, t: string) => `${mId}_${d}_${t}`;

// ─── Date helpers ─────────────────────────────────────────────
export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => fmt(new Date());

export const parseAny = (s: string | Date | undefined): Date => {
  if (!s) return new Date(0);
  if (s instanceof Date) return new Date(s);
  if (typeof s === 'string') {
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') return new Date(s.slice(0, 10) + 'T00:00:00');
    if (s.includes('/')) {
      const parts = s.split(' ')[0].split('/');
      if (parts.length === 3) { const [d, m, y] = parts; return new Date(`${y}-${m}-${d}T00:00:00`); }
    }
  }
  try { const d = new Date(s as string); if (!isNaN(d.getTime())) return d; } catch {}
  return new Date(0);
};

export const dispD = (s: string | undefined) => {
  if (!s) return "";
  const d = parseAny(s);
  if (!d.getTime()) return String(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const dispDH = (s: string | undefined) => {
  if (!s) return "";
  const d = parseAny(s);
  if (!d.getTime()) return String(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ─── API call ─────────────────────────────────────────────────
export async function api(action: string, body: Record<string, unknown> = {}, userSession?: Session | null): Promise<any> {
  const payload: Record<string, unknown> = { action, ...body };
  if (userSession?.token) payload.token = userSession.token;
  const obj = JSON.stringify(payload);
  const encoded = btoa(encodeURIComponent(obj).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
  const url = `${SCRIPT_URL}?payload=${encodeURIComponent(encoded)}&t=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("Tempo de resposta excedido. Tente novamente.");
    throw new Error("Não foi possível conectar ao servidor. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("Erro no servidor (HTTP " + res.status + ")");
  let j: any;
  try { j = await res.json(); }
  catch { throw new Error("Resposta inválida do servidor. Tente novamente."); }
  if (!j.ok && j.error && j.error.includes("Sessão")) {
    clearSession();
    window.location.reload();
    throw new Error("Sessão expirada. Reconectando...");
  }
  if (!j.ok) throw new Error(j.error || "Erro no servidor");
  return j;
}

// ─── Default machines (fallback) ──────────────────────────────
export const MACHINES_DEFAULT: Machine[] = [
  { id: 1, name: "HORIZONTAL 1", hasMeta: true, defaultMeta: 500 },
  { id: 2, name: "HORIZONTAL 2", hasMeta: true, defaultMeta: 500 },
  { id: 3, name: "VERTICAL PLACAS / SUP. 1", hasMeta: true, defaultMeta: 400 },
  { id: 4, name: "VERTICAL PLACAS / SUP. 2", hasMeta: true, defaultMeta: 400 },
  { id: 5, name: "VERTICAL MÓDULOS 1", hasMeta: true, defaultMeta: 350 },
  { id: 6, name: "VERTICAL MÓDULOS 2", hasMeta: true, defaultMeta: 350 },
  { id: 7, name: "A GRANEL", hasMeta: true, defaultMeta: 600 },
  { id: 8, name: "MÁQUINA INTERRUPTOR", hasMeta: true, defaultMeta: 300 },
  { id: 9, name: "TESTE INTERRUPTORES", hasMeta: true, defaultMeta: 250 },
  { id: 10, name: "MANUAL INTERRUPTOR", hasMeta: true, defaultMeta: 200 },
  { id: 11, name: "MONTAGEM DIVERSOS", hasMeta: true, defaultMeta: 150 },
  { id: 12, name: "MONTAGEM PLACA REFINATTO", hasMeta: true, defaultMeta: 180 },
  { id: 13, name: "KIT 1 PARAFUSO", hasMeta: true, defaultMeta: 220 },
  { id: 14, name: "KIT 2 PARAFUSO", hasMeta: true, defaultMeta: 220 },
  { id: 15, name: "MONTAGEM TOMADAS MANUAL", hasMeta: true, defaultMeta: 160 },
  { id: 16, name: "MÁQUINA DE TOMADAS AUTOMÁTICA", hasMeta: true, defaultMeta: 500 },
  { id: 17, name: "INSERÇÃO DOS CONTATOS INTERRUPTOR", hasMeta: true, defaultMeta: 0 },
  { id: 18, name: "FECHAMENTO TECLA INTERRUPTORES", hasMeta: true, defaultMeta: 0 },
  { id: 19, name: "RETRABALHO GERAL", hasMeta: true, defaultMeta: 0 },
];

export const TURNOS = ["TURNO 1", "TURNO 2", "TURNO 3"];

// ─── Utility ──────────────────────────────────────────────────
export const num = (v: unknown): number => { const x = Number(v); return isNaN(x) ? 0 : x; };
export const pctColor = (p: number | null): string =>
  p === null ? "#6B7280" : p >= 100 ? "#22C55E" : p >= 80 ? "#F59E0B" : "#EF4444";
