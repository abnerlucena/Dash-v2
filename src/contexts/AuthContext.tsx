import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  type Session, type Machine, type ProdRecord,
  loadSession, saveSession, clearSession,
  loadCachedRecords, saveCachedRecords,
  loadCachedMetas, saveCachedMetas,
  api, MACHINES_DEFAULT, today,
} from "@/lib/api";

interface AuthContextType {
  user: Session | null;
  machines: Machine[];
  metas: Record<number, number>;
  records: ProdRecord[];
  loading: boolean;
  login: (nome: string, senha: string) => Promise<void>;
  register: (nome: string, senha: string, inviteCode: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  refreshMachines: () => Promise<void>;
  setRecords: React.Dispatch<React.SetStateAction<ProdRecord[]>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(loadSession);
  const [machines, setMachines] = useState<Machine[]>(MACHINES_DEFAULT);
  const [metas, setMetas] = useState<Record<number, number>>(() => {
    const cached = loadCachedMetas();
    if (cached) return cached;
    const m: Record<number, number> = {};
    MACHINES_DEFAULT.forEach(mac => { m[mac.id] = mac.defaultMeta; });
    return m;
  });
  const [records, setRecords] = useState<ProdRecord[]>(loadCachedRecords);
  const [loading, setLoading] = useState(false);

  const refreshMachines = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api("getMachines", {}, user);
      const list = (r.machines || r.allMachines || MACHINES_DEFAULT) as Machine[];
      setMachines(list.filter(m => m.status !== "inativo"));
      // Update metas from defaultMeta on each machine
      const newMetas: Record<number, number> = {};
      list.forEach(m => { newMetas[m.id] = m.defaultMeta; });
      setMetas(newMetas);
      saveCachedMetas(newMetas);
    } catch {}
  }, [user]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await api("getAll", {}, user);
      const data = (r.data || []) as ProdRecord[];
      setRecords(data);
      saveCachedRecords(data);
    } catch {}
    setLoading(false);
  }, [user]);

  // Initial load on login
  useEffect(() => {
    if (user) {
      refreshMachines();
      refreshData();
    }
  }, [user, refreshMachines, refreshData]);

  // Polling: refresh data every 15 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshData();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, refreshData]);

  const login = async (nome: string, senha: string) => {
    const r = await api("login", { nome, senha });
    const session: Session = {
      token: r.session.token,
      nome: r.session.nome,
      role: r.session.role,
      expiresAt: r.session.expiresAt,
    };
    saveSession(session);
    setUser(session);
  };

  const register = async (nome: string, senha: string, inviteCode: string) => {
    const r = await api("register", { nome, senha, inviteCode });
    const session: Session = {
      token: r.session.token,
      nome: r.session.nome,
      role: r.session.role,
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
    <AuthContext.Provider value={{ user, machines, metas, records, loading, login, register, logout, refreshData, refreshMachines, setRecords }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
