# ADR-005 — Frontieres strictes entre modules NestJS

## Contexte
Un monolithe modulaire (ADR-001) ne conserve ses avantages que si les
modules restent reellement isoles.

## Decision
1. Un module ne peut jamais importer le repository (`repositories/*`) d'un
   autre module — uniquement son "public API" (`<module>.public-api.ts`) ou
   son service expose via `exports` du `Module`.
2. Regle ESLint `no-restricted-imports` fait respecter le point 1
   automatiquement (voir `packages/eslint-config`).
3. Aucun acces global non encapsule a `PrismaClient` : chaque module
   possede son ou ses repositories dedies (`getPrismaClient()` n'est
   appele que depuis `repositories/*.ts`).
4. `forwardRef` proscrit sauf necessite absolue documentee en commentaire.
5. Les entites Prisma ne sont jamais retournees telles quelles par un
   controleur : les DTO de `@smc/contracts` font l'interface.

## Exemple applique dans cette phase
`OrdersModule` ne connait pas `RepairCaseRepository` : il appelle
`RepairsPublicApi.createCasesForOrderInTransaction(tx, ...)`, qui elle-meme
delegue a `RepairCaseService`. Le meme principe s'applique a
`ConfiguratorModule` consomme par `OrdersModule`, et a `IdentityModule`
consomme par les guards d'autres modules.

## Consequences
- Legere verbosite additionnelle (une classe `*.public-api.ts` par module
  expose a d'autres modules) en echange d'un couplage explicite et
  controlable.

## Conditions de reevaluation
Si un module public-api devient un point de congestion (trop de
responsabilites), envisager de le scinder en plusieurs interfaces
specialisees plutot que d'assouplir la regle.
