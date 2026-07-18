# SaveMyControllers

Plateforme professionnelle de reparation, amelioration et personnalisation
de manettes de jeu — monolithe modulaire (NestJS + Next.js + PostgreSQL).

Voir :
- `docs/architecture/` — document d'architecture complet (phase 1)
- `docs/adr/` — decisions d'architecture (Architecture Decision Records)
- `docs/development/getting-started.md` — demarrage du projet
- `docs/api/` — contrat OpenAPI genere (`pnpm --filter @smc/api openapi:generate`)

## Structure

```
apps/        web (site public + client + pro), ops (admin + atelier), api (NestJS), worker (BullMQ)
packages/    ui, contracts, database (Prisma), logger, queue, storage, i18n, testing, api-client,
             config-typescript, eslint-config
prisma/      schema.prisma, migrations, seed
infra/       docker-compose, scripts d'exploitation locale
docs/        architecture, ADR, documentation API, guide de developpement
tests/e2e/   tests de bout en bout (a venir)
```

Demarrage : voir `docs/development/getting-started.md`.
