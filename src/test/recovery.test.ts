import { describe, it, expect } from "vitest";
import { lerRecuperacaoDoEndereco } from "@/lib/recovery";

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
