# Demarrage du projet — SaveMyControllers

## Prerequis
- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker + Docker Compose (infrastructure locale : PostgreSQL, Redis, MinIO,
  Mailpit)

## Installation

```bash
git clone <repo>
cd savemycontrollers
cp .env.example .env
pnpm install
```

## Demarrage de l'infrastructure locale

```bash
docker compose up -d --wait
```

Cela demarre PostgreSQL (5432), Redis (6379), MinIO (9000/9001) et Mailpit
(1025/8025). Le script `infra/docker/postgres/init-test-db.sql` cree
automatiquement la base `smc_test` utilisee par les tests d'integration.

## Base de donnees

```bash
pnpm db:generate   # genere le client Prisma
pnpm db:migrate    # applique les migrations (developpement)
pnpm db:seed       # charge permissions, roles, statuts, parametres essentiels
```

Le compte super-administrateur local est cree automatiquement par le seed
si `SEED_SUPERADMIN_EMAIL` et `SEED_SUPERADMIN_PASSWORD` sont definis dans
`.env` (voir `.env.example`) — jamais en environnement de production.

## Lancer les applications

```bash
pnpm dev
```

Demarre en parallele (via Turborepo) : `apps/api` (http://localhost:3001,
documentation OpenAPI sur `/docs`), `apps/worker`, `apps/web`
(http://localhost:3000) et `apps/ops` (http://localhost:3002).

## Tests

```bash
pnpm test:unit          # tests unitaires, aucune dependance externe requise (53 tests, dont un test de demarrage Nest et un test HTTP Supertest)
pnpm test:integration   # necessite DATABASE_URL_TEST (voir docker compose ci-dessus) — actuellement non executes dans le sandbox de generation, voir rapport de phase
```

## Nouvelles variables d'environnement (phase de stabilisation)

En plus des variables de la phase precedente : `JWT_ISSUER`,
`JWT_AUDIENCE`, `CSRF_SECRET`, `PAYLOAD_ENCRYPTION_KEY` (obligatoire en
production), `TRUSTED_PROXY_COUNT`. Voir `.env.example` pour la liste
complete et `docs/adr/ADR-018-validation-environnement.md` pour les regles
de refus au demarrage en production.

## Audit des dependances

```bash
pnpm audit --prod
```

Au moment de la redaction : 39 avertissements, dont 1 critique
(`handlebars`, uniquement via une dependance de developpement
`eslint-plugin-boundaries`, pas de risque en production) et plusieurs
`high` sur `next` (14.2.x, necessitera une montee vers 15.5.16+ dans une
phase dediee) et `multer` (via `@nestjs/platform-express`). Voir le
rapport de la phase de stabilisation pour le detail complet.

## Remise a zero complete de l'environnement local

```bash
bash infra/scripts/reset-local-env.sh
```

## Lint / typecheck

```bash
pnpm lint
pnpm typecheck
```

## Limitation connue de l'environnement de generation initial

Le code de cette phase a ete produit dans un environnement sandbox dont
l'acces reseau est restreint a une liste blanche de domaines qui
n'inclut pas `binaries.prisma.sh` (domaine standard utilise par Prisma
pour distribuer son moteur de requete natif). En consequence,
`pnpm db:generate` / `db:validate` / `db:migrate` / `db:seed` n'ont pas pu
etre executes avec succes dans cet environnement — ils fonctionneront
normalement dans un environnement de developpement ou de CI disposant d'un
acces internet standard. Le schema Prisma a ete relu manuellement en
detail ; les packages independants de Prisma (`@smc/contracts`,
`@smc/logger`, `@smc/queue`, `@smc/storage`, `@smc/testing`, `@smc/i18n`,
`@smc/ui`, `@smc/api-client`) et les 27 tests unitaires de l'API compilent
et s'executent avec succes dans cet environnement (voir rapport de fin de
phase pour le detail exact des commandes executees).
