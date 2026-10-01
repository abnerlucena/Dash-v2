import { describe, it, expect } from "vitest";
import { apagarSessaoSupabaseGuardada, lerRecuperacaoDoEndereco } from "@/lib/recovery";

// O que chega no endereço quando alguém abre o link de recuperação do e-mail.
// A leitura desse endereço é o ponto frágil da recuperação: o app usa
// HashRouter, então o hash serve de rota e de carteiro do token ao mesmo tempo.
describe("leitura do link de recuperação de senha", () => {
  it("visita comum não é recuperação", () => {
    expect(lerRecuperacaoDoEndereco("", "")).toBeNull();
    expect(lerRecuperacaoDoEndereco("", "#/")).toBeNull();
    expect(lerRecuperacaoDoEndereco("?x=1", "#/dashboard")).toBeNull();
  });

  it("fluxo implícito: token no hash vale como recuperação", () => {
    const pedido = lerRecuperacaoDoEndereco(
      "?recuperar=1",
      "#access_token=abc&refresh_token=def&type=recovery",
    );
    expect(pedido).toEqual({ tipo: "sessao" });
  });

  it("token no hash vale mesmo sem o nosso ?recuperar=1", () => {
    // Acontece se o redirect do painel do Supabase apontar para a raiz do app.
    expect(lerRecuperacaoDoEndereco("", "#access_token=abc&type=recovery"))
      .toEqual({ tipo: "sessao" });
  });

  it("fluxo PKCE: código na busca vale como recuperação", () => {
    expect(lerRecuperacaoDoEndereco("?recuperar=1&code=abc", "#/"))
      .toEqual({ tipo: "sessao" });
  });

  it("link expirado tem mensagem própria", () => {
    const pedido = lerRecuperacaoDoEndereco(
      "?recuperar=1",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(pedido?.tipo).toBe("erro");
    expect(pedido).toMatchObject({ mensagem: expect.stringMatching(/expirou/) });
  });

  it("erro do Supabase na busca também é lido", () => {
    const pedido = lerRecuperacaoDoEndereco("?recuperar=1&error=server_error", "#/");
    expect(pedido?.tipo).toBe("erro");
  });

  it("veio pelo link mas sem token nenhum: pede outro e-mail", () => {
    expect(lerRecuperacaoDoEndereco("?recuperar=1", "#/")).toEqual({
      tipo: "erro",
      mensagem: "O link de recuperação expirou ou já foi usado. Peça um novo e-mail.",
    });
  });
});

// Revisão da PR 23: com um link inválido, a sessão antiga do navegador
// continuava guardada e a tela de senha nova abria para a conta errada.
describe("a sessão antiga sai antes de ler o link", () => {
  function storage(inicial: Record<string, string>): Storage {
    const m = new Map(Object.entries(inicial));
    return {
      get length() { return m.size; },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
      clear: () => m.clear(),
    };
  }

  it("apaga a sessão do Supabase e mantém o code-verifier do PKCE", () => {
    const s = storage({
      "sb-abc-auth-token": "{sessao do usuario A}",
      "sb-abc-auth-token-code-verifier": "verificador",
      "outra-coisa": "fica",
    });
    apagarSessaoSupabaseGuardada(s);
    expect(s.getItem("sb-abc-auth-token")).toBeNull();
    expect(s.getItem("sb-abc-auth-token-code-verifier")).toBe("verificador");
    expect(s.getItem("outra-coisa")).toBe("fica");
  });

  it("sem storage não quebra", () => {
    expect(() => apagarSessaoSupabaseGuardada(undefined)).not.toThrow();
  });
});
