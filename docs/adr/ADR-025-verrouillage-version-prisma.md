# ADR-025 — Version Prisma verrouillee (5.22.0, sans caret)

## Contexte
Les phases precedentes ont teste Prisma 5.22.0 puis 7.8.0 pour tenter de
contourner le blocage reseau de `binaries.prisma.sh`, sans succes dans les
deux cas (le moteur requis — `libquery_engine` en v5, `schema-engine` en
v7 — reste sur le meme domaine bloque). Alterner les versions majeures
sans jamais pouvoir verifier ajoutait un risque non maitrise.

## Decision
`prisma` et `@prisma/client` sont figes a **exactement** `5.22.0` (sans
`^`) dans `packages/database/package.json`, verrouille dans
`pnpm-lock.yaml`. Aucune autre version ne doit etre installee pendant
cette phase.

## Justification du choix de la 5.x plutot que la 7.x
- Le code applicatif (`getPrismaClient()`, `Prisma.TransactionClient`,
  `$queryRaw` tagged templates) a ete ecrit et teste (structurellement)
  contre l'API Prisma 5.x.
- Prisma 7 introduit des changements d'architecture (query compiler
  TypeScript/WASM) non evalues dans ce projet ; y migrer sans pouvoir
  executer un seul test d'integration serait irresponsable.
- Aucun gain reel n'a ete observe avec la version 7 dans cet
  environnement : le blocage est identique.

## Consequence
Toute mise a niveau majeure de Prisma est explicitement hors perimetre
tant qu'un environnement CI avec acces reseau standard n'a pas valide la
version 5.22.0 de bout en bout (voir `.github/workflows/ci.yml`).
