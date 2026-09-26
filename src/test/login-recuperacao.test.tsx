import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// A tela de login só fala com a camada de dados por esta fachada, então trocá-la
// por uma de mentira basta para testar as telas de recuperação sem rede.
// `vi.hoisted` porque as fábricas de mock sobem para o topo do arquivo.
const { requestPasswordReset, setNewPassword, recuperacaoEmAndamento } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  setNewPassword: vi.fn().mockResolvedValue(undefined),
  // Chegada pelo link do e-mail: controlada por teste.
  recuperacaoEmAndamento: vi.fn<() => { tela: string; erro?: string } | null>(() => null),
}));

vi.mock("@/lib/repositories", () => ({
  isSupabase: true,
  DATA_SOURCE: "supabase",
  data: {
    auth: {
      requestPasswordReset,
      setNewPassword,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      completeOnboarding: vi.fn(),
      isSessionValid: vi.fn().mockResolvedValue(false),
      watchSession: () => () => {},
    },
  },
}));

vi.mock("@/lib/recovery", () => ({ recuperacaoEmAndamento }));

import { AuthProvider } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";

function montar() {
  return render(
    <MemoryRouter>
      <AuthProvider><LoginPage /></AuthProvider>
    </MemoryRouter>,
  );
}

describe("tela de login: recuperação de senha (modo Supabase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recuperacaoEmAndamento.mockReturnValue(null);
    localStorage.clear();
  });

  it("o login oferece a recuperação, e ela pede o e-mail", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /recuperar por e-mail/i }));

    expect(screen.getByRole("button", { name: /enviar link de recuperação/i })).toBeInTheDocument();
    // As abas "Entrar / Criar Conta" saem de cena: o cartão é outro.
    expect(screen.queryByRole("button", { name: /^criar conta$/i })).not.toBeInTheDocument();
  });

  it("enviar o pedido responde igual exista a conta ou não", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /recuperar por e-mail/i }));
    fireEvent.change(screen.getByPlaceholderText(/seu.email@empresa.com/i), { target: { value: "alguem@weg.net" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    expect(requestPasswordReset).toHaveBeenCalledWith("alguem@weg.net");
    expect(await screen.findByText(/se existir uma conta com esse e-mail/i)).toBeInTheDocument();
  });

  it("chegando pelo link do e-mail, a tela abre na senha nova", async () => {
    recuperacaoEmAndamento.mockReturnValue({ tela: "novaSenha" });
    montar();

    expect(screen.getByRole("button", { name: /salvar senha nova/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^entrar$/i })).not.toBeInTheDocument();
  });

  it("senhas diferentes não chegam a ser enviadas", async () => {
    recuperacaoEmAndamento.mockReturnValue({ tela: "novaSenha" });
    montar();
    fireEvent.change(screen.getByPlaceholderText(/mínimo 6 caracteres/i), { target: { value: "senha-nova" } });
    fireEvent.change(screen.getByPlaceholderText(/repita a senha/i), { target: { value: "outra-coisa" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar senha nova/i }));

    expect(setNewPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/as senhas não coincidem/i)).toBeInTheDocument();
  });

  it("link velho: a tela abre pedindo outro e-mail, com o motivo", () => {
    recuperacaoEmAndamento.mockReturnValue({ tela: "recuperar", erro: "O link de recuperação expirou. Peça um novo e-mail." });
    montar();

    expect(screen.getByText(/o link de recuperação expirou/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar link de recuperação/i })).toBeInTheDocument();
  });
});
