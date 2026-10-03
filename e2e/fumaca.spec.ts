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

test("apontamento valida a OP e salva (demonstração)", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const maquina = "Máquina de tomadas Composé (Aumaq)";
  await page.getByLabel(`Quantidade, linha 1, ${maquina}`).fill("5000");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Corrija os campos destacados")).toBeVisible();
  await page.getByLabel(`Nº da OP, linha 1, ${maquina}`).fill("4511111");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
});

test("meta por pessoa exige o nº de operadores; OP aceita até 15 dígitos", async ({ page }) => {
  await entrar(page, "gestor@demo.weg");
  await page.goto("/#/apontamento");
  const granel = "Bancada de embalagem a granel";
  await page.getByLabel(`Nº da OP, linha 1, ${granel}`).fill("1234567890123");
  await page.getByLabel(`Quantidade, linha 1, ${granel}`).fill("20000");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Informe o nº de operadores")).toBeVisible();
  await expect(page.getByText("Informe quantas pessoas trabalharam")).toBeVisible();
  await page.locator("li", { has: page.locator("h3", { hasText: granel }) }).getByLabel("Nº de operadores").fill("3");
  await page.getByRole("button", { name: "Salvar apontamento" }).click();
  await expect(page.getByText("Apontamento salvo")).toBeVisible();
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
