// Gera as capturas de tela dos estados principais do protótipo.
// Uso: com o servidor rodando (npm run proto:dev), execute
//   node prototype/scripts/capture.mjs [url]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const URL = process.argv[2] ?? "http://localhost:8090/";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "screenshots");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, { width = 1440, height = 900, scheme = "light", storage = {}, act } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  await context.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
  }, { "dash-proto.banner.dismissed": true, ...storage });
  const page = await context.newPage();
  await page.goto(URL);
  await page.waitForSelector("table");
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await context.close();
  console.log("ok", name);
}

const openRow = (label) => async (page) => {
  await page.locator(`tbody tr[aria-label^="${label}"]`).click();
};
const demoState = (label) => async (page) => {
  await page.getByRole("button", { name: "Estados do protótipo" }).click();
  await page.getByRole("menuitemradio", { name: label }).click();
};

await shot("01-maquinas-claro", {});
await shot("02-maquinas-escuro", { scheme: "dark" });
await shot("03-painel-claro", { act: openRow("A GRANEL") });
await shot("04-painel-escuro", { scheme: "dark", act: openRow("HORIZONTAL 1") });
await shot("05-nav-recolhida", { storage: { "dash-proto.sidenav.expanded": false } });
await shot("06-nav-flyout", {
  storage: { "dash-proto.sidenav.expanded": false },
  act: async (page) => {
    await page.getByRole("button", { name: "Expandir navegação lateral" }).hover();
    await page.waitForTimeout(500);
  },
});
await shot("07-tablet-900", { width: 900, height: 1000 });
await shot("08-mobile-overlay", {
  width: 390,
  height: 844,
  act: async (page) => {
    await page.getByRole("button", { name: "Expandir navegação lateral" }).click();
    await page.waitForTimeout(400);
  },
});
await shot("09-mobile-pagina", { width: 390, height: 844 });
await shot("10-estado-carregando", { act: demoState("Carregando") });
await shot("11-estado-vazio", { act: demoState("Vazio") });
await shot("12-estado-erro", { act: demoState("Erro") });
await shot("13-filtro-sem-resultado", {
  act: async (page) => {
    await page.getByRole("button", { name: /^Status:/ }).click();
    await page.getByRole("menuitemradio", { name: /Atingido/ }).click();
  },
});
await shot("14-menu-filtro-escuro", {
  scheme: "dark",
  act: async (page) => {
    await page.locator('tbody tr[aria-label^="TESTE"] input[type=checkbox]').check();
    await page.locator('tbody tr[aria-label^="HORIZONTAL"] input[type=checkbox]').check();
    await page.getByRole("button", { name: /^Período:/ }).click();
  },
});

await shot("15-mobile-busca", {
  width: 390,
  height: 844,
  act: async (page) => {
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.keyboard.type("placa");
  },
});
await shot("16-tablet-painel-overlay", { width: 900, height: 1000, act: openRow("VERTICAL") });

const tab = (name) => (page) => page.getByRole("tab", { name }).click();
const pick = async (page, filter, option) => {
  await page.getByRole("button", { name: new RegExp(`^${filter}:`) }).click();
  await page.getByRole("menuitemradio", { name: option }).click();
};

await shot("17-detalhado-claro", { act: tab("Detalhado") });
await shot("18-detalhado-percentual-escuro", {
  scheme: "dark",
  act: async (page) => {
    await tab("Detalhado")(page);
    await page.getByRole("radio", { name: "% da meta diária" }).click();
  },
});
await shot("19-turnos-claro", { act: tab("Turnos") });
await shot("20-turnos-foco-t3-escuro", {
  scheme: "dark",
  act: async (page) => {
    await tab("Turnos")(page);
    await pick(page, "Turno", /Turno 3/);
  },
});
await shot("21-graficos-claro", {
  height: 1200,
  act: async (page) => {
    await tab("Gráficos")(page);
    const box = await page.getByRole("group", { name: /Produção acumulada/ }).boundingBox();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
  },
});
await shot("22-graficos-escuro", {
  scheme: "dark",
  height: 1200,
  act: async (page) => {
    await tab("Gráficos")(page);
    const box = await page.getByRole("group", { name: /^Produção diária/ }).boundingBox();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  },
});
await shot("23-graficos-turno2-tabela", {
  height: 1200,
  act: async (page) => {
    await tab("Gráficos")(page);
    await pick(page, "Turno", /Turno 2/);
    await page.getByRole("radio", { name: "Tabela" }).first().click();
  },
});
await shot("24-mobile-graficos", { width: 390, height: 1400, act: tab("Gráficos") });
await shot("25-graficos-painel", {
  height: 1200,
  act: async (page) => {
    await tab("Gráficos")(page);
    await page.getByRole("button", { name: /^HORIZONTAL 1: .*Abrir ordens/ }).click();
  },
});

await browser.close();
