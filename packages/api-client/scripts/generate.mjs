#!/usr/bin/env node
// Regenere le client TypeScript a partir du contrat OpenAPI reel de
// l'API. Deux etapes :
//   1) apps/api genere docs/api/openapi.json a partir des controleurs
//      reels (voir apps/api/src/generate-openapi.spec.ts — execute via
//      l'infrastructure de test car c'est le seul mecanisme disponible
//      dans cet environnement pour bootstrap l'application NestJS sans
//      le client Prisma genere, voir le rapport de phase) ;
//   2) openapi-typescript transforme ce contrat en types TypeScript.
//
// CI : ce script doit etre suivi de `git diff --exit-code` sur
// `docs/api/openapi.json` et `packages/api-client/src/generated/` pour
// garantir qu'aucun fichier genere n'est obsolete (voir .github/workflows/ci.yml).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

console.log("[1/2] Generation du contrat OpenAPI depuis l'API reelle...");
execSync("pnpm --filter @smc/api exec jest --config jest.config.cjs --selectProjects unit --testPathPattern generate-openapi --forceExit", {
  cwd: repoRoot,
  stdio: "inherit",
});

const openapiPath = resolve(repoRoot, "docs/api/openapi.json");
if (!existsSync(openapiPath)) {
  console.error("Echec : docs/api/openapi.json n'a pas ete genere.");
  process.exit(1);
}

console.log("[2/2] Generation des types TypeScript (openapi-typescript)...");
execSync(`node_modules/.bin/openapi-typescript ${openapiPath} -o src/generated/schema.d.ts`, {
  cwd: resolve(repoRoot, "packages/api-client"),
  stdio: "inherit",
});

console.log("OK : client API regenere avec succes.");
