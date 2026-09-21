import { describe, it, expect } from "vitest";
import { toAuthError } from "@/lib/repositories/supabase/helpers";

describe("mensagens de erro do login/cadastro (modo Supabase)", () => {
  it("limite de e-mails do Supabase tem mensagem própria", () => {
    expect(toAuthError({ message: "email rate limit exceeded" }).message).toMatch(/limite de envio de e-mails/);
  });
  it("outros limites continuam com a mensagem genérica", () => {
    expect(toAuthError({ message: "Request rate limit reached" }).message).toBe("Muitas tentativas em pouco tempo. Aguarde alguns minutos.");
  });
  it("senha errada e e-mail já cadastrado", () => {
    expect(toAuthError({ message: "Invalid login credentials" }).message).toBe("E-mail ou senha incorretos.");
    expect(toAuthError({ message: "User already registered" }).message).toBe("Este e-mail já está cadastrado.");
  });
});
