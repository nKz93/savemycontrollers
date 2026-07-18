# ADR-011 — import de valeur obligatoire pour toute classe injectee (NestJS)

## Contexte
La phase 2 utilisait systematiquement `import type` pour les classes
injectees dans les constructeurs (services, repositories, guards). Avec
`emitDecoratorMetadata`, TypeScript efface les imports de type a la
compilation ; NestJS lit `design:paramtypes` a l'execution pour resoudre
les dependances, et se retrouve avec `Object`/`Function` au lieu de la
classe reelle, rendant la resolution impossible.

## Decision
Toute classe utilisee comme type d'un parametre de constructeur injecte
par Nest est importee en **import de valeur**. Les DTO (`@smc/contracts`),
types Prisma, interfaces et types express (`Request`/`Response`) restent
en `import type`.

La regle ESLint `@typescript-eslint/consistent-type-imports` est
**desactivee** (voir `packages/eslint-config`) car elle ne peut pas
distinguer ces deux cas et avait initialement provoque cette regression
en "corrigeant" automatiquement des imports de valeur en imports de type.

## Garde-fou reel
Un test de demarrage (`apps/api/src/app.bootstrap.spec.ts`) construit
`AppModule` via `Test.createTestingModule` et appelle `app.init()`. Il
echoue immediatement si une dependance ne peut pas etre resolue — c'est la
protection efficace contre une regression future, pas une regle de lint.

## Conditions de reevaluation
Si une regle ESLint capable de distinguer "type utilise dans un
constructeur injecte Nest" devient disponible et fiable, elle pourra etre
reactivee.
