/**
 * Sanitiza input de texto antes de enviar ao backend.
 * Remove caracteres de formula injection e limita o comprimento.
 */
export function sanitizeInput(value: string, maxLength = 200): string {
  if (!value) return "";
  return String(value)
    .replace(/[=+\-@\t\r\n\x00\xFF]/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .slice(0, maxLength)
    .trim();
}

/**
 * Valida se um número está dentro dos limites esperados.
 */
export function validateNumber(value: number, min: number, max: number): boolean {
  return !isNaN(value) && isFinite(value) && value >= min && value <= max;
}

/**
 * Remove campos sensíveis de objetos antes de logar no console.
 * Útil para evitar exposição de tokens, hashes de senha, etc.
 */
export function redactSensitive<T extends object>(obj: T, fields: string[]): Partial<T> {
  const result = { ...obj } as Record<string, unknown>;
  fields.forEach(f => {
    if (f in result) result[f] = "[REDACTED]";
  });
  return result as Partial<T>;
}
