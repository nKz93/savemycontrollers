#!/usr/bin/env node
// Verifie que chaque package construit declare des points d'entree
// (main/types) reellement presents sur disque APRES `pnpm build`. A
// executer en CI juste apres l'etape de build (voir .github/workflows/ci.yml
// et section 6 du prompt de phase "preparation du depot GitHub").
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const packagesDir = "packages";
let failures = 0;

for (const name of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, name);
  if (!statSync(pkgDir).isDirectory()) continue;
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  if (!pkg.main && !pkg.types) continue; // package sans point d'entree publie (ex. config-typescript)

  for (const field of ["main", "types"]) {
    if (!pkg[field]) continue;
    const target = join(pkgDir, pkg[field]);
    if (!existsSync(target)) {
      console.error(`MANQUANT: ${name} declare "${field}": "${pkg[field]}" mais ${target} n'existe pas.`);
      failures++;
    } else {
      console.log(`OK: ${name} -> ${field} (${pkg[field]})`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} point(s) d'entree manquant(s).`);
  process.exit(1);
}
console.log("\nTous les points d'entree declares sont presents.");
