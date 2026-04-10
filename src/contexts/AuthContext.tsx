import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  type Session, type Machine, type ProdRecord,
  loadSession, saveSession, clearSession,
  loadCachedRecords, saveCachedRecords,
  loadCachedMetas, saveCachedMetas,
  api, MACHINES_DEFAULT,
} from "@/lib/api";

export interface MetaInfo {
  updatedBy: string;
  updatedAt: string;
  vigenciaInicio: string;
}

interface AuthContextType {
  user: Session | null;
  machines: Machine[];
  metas: Record<number, number>;
  metasInfo: Record<number, MetaInfo>;
  records: ProdRecord[];
  loading: boolean;
  turnosAtivos: number;
  setTurnosAtivos: (n: number) => void;
  login: (nome: string, senha: string) => Promise<void>;
  register: (nome: string, senha: string, inviteCode: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  refreshMachines: () => Promise<void>;
  refreshMetas: () => Promise<void>;
  setRecords: React.Dispatch<React.SetStateAction<ProdRecord[]>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Normalize numeric fields — backend returns everything as strings
function normalizeRecords(raw: any[]): ProdRecord[] {
  return (raw || [])
    .map((rec: any) => ({
      ...rec,
      machineId: Number(rec.machineId) || 0,
      meta:      Number(rec.meta)      || 0,
      producao:  Number(rec.producao)  || 0,
    }))
    .filter((rec: ProdRecord) => rec.machineId > 0 && rec.date);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<Session | null>(loadSession);
  const [machines, setMachines] = useState<Machine[]>(MACHINES_DEFAULT);
  const [metas, setMetas]     = useState<Record<number, number>>(() => {
    const cached = loadCachedMetas();
    if (cached) return cached;
    const m: Record<number, number> = {};
    MACHINES_DEFAULT.forEach(mac => { m[mac.id] = mac.defaultMeta; });
    return m;
  });
  const [metasInfo, setMetasInfo] = useState<Record<number, MetaInfo>>({});
  // Pre-populate from cache — shown instantly while fresh data loads in background
  const [records, setRecords] = useState<ProdRecord[]>(() => normalizeRecords(loadCachedRecords()));
  const [loading, setLoading] = useState(false);
  const [turnosAtivos, setTurnosAtivosState] = useState<number>(() => {
    const v = localStorage.getItem("turnosAtivos");
    return v ? Number(v) : 2;
  });
  const setTurnosAtivos = (n: number) => {
    setTurnosAtivosState(n);
    localStorage.setItem("turnosAtivos", String(n));
  };

  // ── Fetch helpers ─────────────────────────────────────────────

  const refreshMachines = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api("getMachines", {}, user);
      const list = (r.machines || r.allMachines || MACHINES_DEFAULT) as Machine[];
      setMachines(list.filter(m => m.status !== "inativo"));
    } catch {}
  }, [user]);

  const refreshMetas = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api("getMetas", {}, user);
      if (r.metas) {
        const newMetas = r.metas as Record<number, number>;
        setMetas(newMetas);
        saveCachedMetas(newMetas);
      }
      if (r.metasInfo) setMetasInfo(r.metasInfo as Record<number, MetaInfo>);
    } catch {}
  }, [user]);

  // Full refresh — shows loading skeleton (use only when cache is empty)
  const refreshData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await api("getAll", {}, user);
      const data = normalizeRecords(r.data);
      setRecords(data);
      saveCachedRecords(data);
    } catch {}
    setLoading(false);
  }, [user]);

  // Silent refresh — updates data in background, no skeleton flicker
  const silentRefreshData = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api("getAll", {}, user);
      const data = normalizeRecords(r.data);
      setRecords(data);
      saveCachedRecords(data);
    } catch {}
  }, [user]);

  // ── Initial load ──────────────────────────────────────────────
  // Run all 3 fetches in parallel.
  // If cache exists: show stale data immediately + silent background refresh.
  // If no cache: show loading skeleton until data arrives.
  useEffect(() => {
    if (!user) return;
    const hasCached = loadCachedRecords().length > 0;
    refreshMachines();
    refreshMetas();
    if (hasCached) {
      silentRefreshData(); // cache already displayed — no skeleton
    } else {
      refreshData();       // nothing to show — use skeleton
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Polling every 60 s — always silent ───────────────────────
  useEffect(() => {
    if (!user) return;
    const id = setInterval(silentRefreshData, 60_000);
    return () => clearInterval(id);
  }, [user, silentRefreshData]);

  // ── Auth actions ──────────────────────────────────────────────

  const login = async (nome: string, senha: string) => {
    const r = await api("login", { nome, senha });
    const session: Session = {
      token:     r.session.token,
      nome:      r.session.nome,
      role:      r.session.role,
      expiresAt: r.session.expiresAt,
    };
    saveSession(session);
    setUser(session);
  };

  const register = async (nome: string, senha: string, inviteCode: string) => {
    const r = await api("register", { nome, senha, inviteCode });
    const session: Session = {
      token:     r.session.token,
      nome:      r.session.nome,
      role:      r.session.role,
      expiresAt: r.session.expiresAt,
    };
    saveSession(session);
    setUser(session);
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setRecords([]);
  };

  return (
    <AuthContext.Provider value={{
      user, machines, metas, metasInfo, records, loading,
      turnosAtivos, setTurnosAtivos,
      login, register, logout,
      refreshData, refreshMachines, refreshMetas,
      setRecords,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
