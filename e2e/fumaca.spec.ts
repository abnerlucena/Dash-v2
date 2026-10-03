import { expect, test, type Page } from "@playwright/test";

const entrar = async (page: Page, email: string) => {
  await page.goto("/");
  await page.getByLabel(/e-mail/i).first().fill(email);
  await page.getByLabel(/senha/i).first().fill("demo123");
  await page.getByRole("button", { name: /^entrar$/i }).click();
};

test("gestor entra e navega pelas telas principais", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await entrar(page, "gestor@demo.weg");
  await expect(page.getByRole("heading", { name: "Máquinas", level: 1 })).toBeVisible();
  for (const [rota, titulo] of [
    ["historico", "Histórico"],
    ["metas", "Metas"],
    ["relatorios", "Relatórios"],
    ["ranking", "Ranking de máquinas"],
    ["usuarios", "Usuários"],
  ]) {
    await page.goto(`/#/${rota}`);
    await expect(page.getByRole("heading", { name: titulo, level: 1 })).toBeVisible();
  }
  expect(erros).toEqual([]);
});

test("operador não vê a gestão de usuários", async ({ page }) => {
  await entrar(page, "operador@demo.weg");
  await page.goto("/#/usuarios");
  await expect(page.getByText("Sem permissão para esta tela")).toBeVisible();
});

test("senha errada mostra o motivo", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-mail/i).first().fill("gestor@demo.weg");
  await page.getByLabel(/senha/i).first().fill("errada");
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
