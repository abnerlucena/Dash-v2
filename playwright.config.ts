import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Carrega credenciais locais de teste (.env.local), se existir. Não versionado.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 8080;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}/Dash-v2/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
