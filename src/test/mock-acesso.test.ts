import { describe, it, expect, beforeEach } from "vitest";
import { mockAuth, mockUsers, resetarMock } from "@/lib/repositories/mock/acesso";
import { SENHA_DEMO } from "@/lib/repositories/mock/contas";
import { codigoDoErro } from "@/lib/erros";

// O mock é o chão sobre o qual a sessão da interface vai construir as telas de
// acesso. Estes testes garantem que cada estado existe e se comporta como no
// modo Supabase — mesma mensagem, mesmo erro.
beforeEach(() => resetarMock());

const entrar = (email: string, cracha?: string) => mockAuth.login(email, SENHA_DEMO, cracha);

describe("mock de acesso: entrar", () => {
  it("operador entra com as permissões do perfil", async () => {
    const { session } = await entrar("operador@demo.local");
    expect(session.source).toBe("mock");
    expect(session.permissions).toEqual(["production.create", "production.edit_own"]);
    expect(session.role).toBe("user");
  });

  it("gestor entra como admin e pode aprovar", async () => {
    const { session } = await entrar("gestor@demo.local");
    expect(session.role).toBe("admin");
    expect(session.permissions).toContain("users.approve");
  });

  it("senha errada e e-mail inexistente dão a MESMA mensagem", async () => {
    await expect(mockAuth.login("operador@demo.local", "errada")).rejects.toThrow("E-mail ou senha incorretos.");
    await expect(mockAuth.login("ninguem@demo.local", SENHA_DEMO)).rejects.toThrow("E-mail ou senha incorretos.");
  });

  it("pendente e bloqueado não entram, com a mensagem do modo Supabase", async () => {
    await expect(entrar("pendente@demo.local")).rejects.toThrow("aguardando aprovação");
    await expect(entrar("bloqueado@demo.local")).rejects.toThrow("Usuário bloqueado");
  });

  it("conta compartilhada pede crachá, e identifica quem está nela", async () => {
    const erro = await entrar("admin@demo.local").catch(e => e);
    expect(codigoDoErro(erro)).toBe("BADGE_REQUIRED");
    await expect(entrar("admin@demo.local", "9999")).rejects.toThrow("Crachá não encontrado");
    const { session } = await entrar("admin@demo.local", "1001");
    expect(session.nome).toBe("Carla Demonstração (Administração)");
    expect(session.accountType).toBe("shared");
  });

  it("conta de TV só vê o Modo TV", async () => {
    const { session } = await entrar("tv@demo.local");
    expect(session.permissions).toEqual(["tv_mode.view"]);
  });
});

describe("mock de acesso: cadastro e aprovação", () => {
  it("cadastro nasce pendente; o gestor aprova e a pessoa entra", async () => {
    const r = await mockAuth.register({ nome: "Nova Pessoa", senha: "abcdef", email: "nova@demo.local", badgeNumber: "3001" });
    expect(r.loggedIn).toBe(false);
    await expect(mockAuth.login("nova@demo.local", "abcdef")).rejects.toThrow("aguardando aprovação");

    const { session: gestor } = await entrar("gestor@demo.local");
    const { users } = await mockUsers.listUsers(gestor);
    const nova = users!.find(u => u.nome === "Nova Pessoa")!;
    expect(nova.status).toBe("pendente");
    expect(users![0].status).toBe("pendente");       // pendentes primeiro, como no banco

    await mockUsers.approveUser(nova.id!, 1, gestor);
    const { session } = await mockAuth.login("nova@demo.local", "abcdef");
    expect(session.permissions).toContain("production.create");
  });

  it("recusa e-mail e crachá repetidos", async () => {
    await expect(mockAuth.register({ nome: "X", senha: "abcdef", email: "operador@demo.local", badgeNumber: "9" }))
      .rejects.toThrow("já está cadastrado");
    await expect(mockAuth.register({ nome: "X", senha: "abcdef", email: "x@demo.local", badgeNumber: "2001" }))
      .rejects.toThrow("nº do crachá");
  });

  it("sem users.approve: vê só a si mesmo e não altera ninguém", async () => {
    const { session: op } = await entrar("operador@demo.local");
    const { users } = await mockUsers.listUsers(op);
    expect(users!.map(u => u.nome)).toEqual(["Ana Operadora"]);
    await expect(mockUsers.approveUser("u-pendente", 1, op)).rejects.toThrow("permissão para aprovar");
  });

  it("bloquear derruba o acesso; pendente se aprova, não se bloqueia", async () => {
    const { session: gestor } = await entrar("gestor@demo.local");
    const { users } = await mockUsers.listUsers(gestor);
    const ana = users!.find(u => u.nome === "Ana Operadora")!;
    const paulo = users!.find(u => u.nome === "Paulo Pendente")!;
    await expect(mockUsers.toggleUser(paulo, gestor)).rejects.toThrow('use "Aprovar"');
    expect((await mockUsers.toggleUser(ana, gestor)).newStatus).toBe("bloqueado");
    await expect(entrar("operador@demo.local")).rejects.toThrow("Usuário bloqueado");
  });
});

describe("mock de acesso: recuperação de senha", () => {
  it("pedido responde igual exista a conta ou não", async () => {
    await expect(mockAuth.requestPasswordReset("operador@demo.local")).resolves.toBeUndefined();
    await expect(mockAuth.requestPasswordReset("ninguem@demo.local")).resolves.toBeUndefined();
  });

  it("sem pedido antes, o link vale como expirado", async () => {
    await expect(mockAuth.setNewPassword("nova123")).rejects.toThrow("expirou ou já foi usado");
  });

  it("depois do pedido, troca a senha — e o link vale uma vez só", async () => {
    await mockAuth.requestPasswordReset("operador@demo.local");
    await mockAuth.setNewPassword("nova123");
    await expect(mockAuth.login("operador@demo.local", SENHA_DEMO)).rejects.toThrow("incorretos");
    await expect(mockAuth.login("operador@demo.local", "nova123")).resolves.toBeTruthy();
    await expect(mockAuth.setNewPassword("outra123")).rejects.toThrow("expirou ou já foi usado");
  });
});
