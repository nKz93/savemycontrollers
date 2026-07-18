// Configuration ESLint partagee du monorepo SaveMyControllers (flat config,
// standard ESLint 9+). Objectifs :
//  - interdire `any` explicite non justifie
//  - interdire l'import direct entre modules metier NestJS (chaque module
//    ne doit dependre que de l'interface publique exposee par un autre
//    module, jamais de son repository interne)
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/coverage/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // consistent-type-imports est desactivee volontairement : avec
      // emitDecoratorMetadata (NestJS), une classe injectee dans un
      // constructeur doit rester un import de VALEUR meme si elle n'est
      // utilisee que comme annotation de type dans le code source — sinon
      // TypeScript emet `design:paramtypes` avec `Object`/`Function` et
      // NestJS ne peut plus resoudre la dependance a l'execution. Cette
      // regle ESLint ne sait pas distinguer "type utilise dans un
      // constructeur injecte" de "type utilise ailleurs" ; l'activer a
      // deja provoque une regression reelle (voir ADR-011). La garde
      // reelle contre les regressions futures est le test de demarrage
      // Nest (`app.bootstrap.spec.ts`), qui echoue si une dependance ne
      // peut pas etre resolue.
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-floating-promises": "off", // necessite un programme type-checke ; reactive en phase suivante avec parserOptions.project
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/*/repositories/*", "**/modules/*/repository/*"],
              message:
                "Interdit : un module metier ne doit jamais importer le repository interne d'un autre module. Passez par le service public (index.ts) du module.",
            },
            {
              group: ["**/generated/prisma*"],
              message:
                "Interdit hors du package @smc/database : n'importez pas directement les types Prisma generes dans un module metier.",
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
];
