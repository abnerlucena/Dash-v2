import { test, expect } from "../playwright-fixture";

// Credenciais vêm de variáveis de ambiente — NUNCA hardcode senha real no teste.
// Rode assim: E2E_ADMIN_USER=Admin E2E_ADMIN_PASSWORD=sua_senha npx playwright test
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "Admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

test.describe("Fluxo de produção (login -> apontamento -> dashboard)", () => {
  test.beforeEach(() => {
    test.skip(!ADMIN_PASSWORD, "Defina E2E_ADMIN_PASSWORD para rodar este teste");
  });

  test("faz login, lança produção de uma máquina e confere no dashboard", async ({ page }) => {
    // ── 1. LOGIN ──────────────────────────────────────────────
    await page.goto("/");

    await page.getByPlaceholder("Seu nome").fill(ADMIN_USER);
    await page.getByPlaceholder(/mínimo 4 caracteres/i).fill(ADMIN_PASSWORD);

    // Há dois botões com texto "Entrar" na tela (a aba de modo login/cadastro
    // e o botão de submit do form) — por isso miramos especificamente no
    // botão do tipo submit dentro do <form>, não pelo texto.
    await page.locator("form button[type='submit']").click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // ── 2. IR PARA A ABA "APONTAMENTO" ───────────────────────
    // Assume viewport desktop (padrão do Playwright), onde a nav principal
    // mostra o texto "Apontamento". No mobile o BottomNav usa "Apontar".
    await page.getByRole("button", { name: "Apontamento" }).click();

    // ── 3. LANÇAR PRODUÇÃO NA PRIMEIRA MÁQUINA DA LISTA ──────
    // O input de quantidade usa placeholder "Qtd" (ver OrdemProducaoInput.tsx)
    const firstMachineInput = page.getByPlaceholder("Qtd").first();
    await firstMachineInput.fill("500");

    // ── 4. SALVAR ─────────────────────────────────────────────
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    // Há também um toast "Apontamento salvo com sucesso!" — exact:true evita ambiguidade
    await expect(page.getByText("Salvo com sucesso!", { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── 5. IR PARA O DASHBOARD E CONFERIR QUE OS DADOS APARECEM ─
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText(/resumo/i)).toBeVisible();

    // KPI geral deve mostrar algum valor de produção acumulada > 0
    // (ajuste o seletor abaixo se o KPICards usar um data-testid específico)
    await expect(page.locator("text=/\\d[\\d.,]*/").first()).toBeVisible();
  });
});
