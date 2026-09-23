import { clsx, type ClassValue } from "clsx";

// Sem tailwind-merge: os nomes de token (text-subtle, font-body…) não são
// reconhecidos por ele e seriam "mesclados" incorretamente.
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

const numberFormat = new Intl.NumberFormat("pt-BR");
export const formatNumber = (n: number) => numberFormat.format(n);

const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const formatDecimal = (n: number) => percentFormat.format(n);

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
/** "21 mar" (sem o ponto de abreviação) */
export const formatShortDate = (d: Date) => shortDate.format(d).replace(".", "").replace(" de ", " ");

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long" });
export const formatLongDate = (d: Date) => longDate.format(d).replace(".", "");

/** Lê um token do tokens.css: tamanhos em px (rem/px), durações em ms (ms/s) ou número puro. */
export function readToken(name: string): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith("rem")) {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parseFloat(raw) * root;
  }
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw);
}

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado / armazenamento bloqueado: segue sem persistir */
  }
}

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
