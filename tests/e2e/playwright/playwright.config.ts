import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright pour la validation fonctionnelle du parcours
 * client (voir tests/customer-order-flow.spec.ts). Suppose que l'API
 * (port 3001) et apps/web (port 3000) sont deja demarres et sains contre
 * une vraie base PostgreSQL/Redis — voir .github/workflows/e2e.yml pour
 * la sequence complete (migrations, seed, build, demarrage, attente des
 * healthchecks) executee en CI. N'est PAS execute dans le sandbox de
 * developpement de ce projet (meme blocage Prisma que d'habitude, voir
 * docs/development/prisma-runtime-blocker-proof.txt).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
