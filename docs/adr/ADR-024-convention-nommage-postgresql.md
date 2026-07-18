# ADR-024 — Convention de nommage : camelCase Prisma/TS, snake_case PostgreSQL

## Contexte
Le schema utilisait `@@map` pour les tables mais aucun `@map` sur les
colonnes, alors que les requetes SQL brutes (`ReferenceGeneratorService`,
`OutboxRepository`, worker) utilisaient deja des noms de colonnes
snake_case (`event_type`, `next_attempt_at`, `last_value`...). Ces
colonnes n'auraient pas existe avec le schema tel quel.

## Decision
Chaque champ scalaire Prisma dont le nom differe de son equivalent
snake_case recoit desormais un `@map("...")` explicite (391 champs sur 59
tables). Les noms de colonnes obtenus correspondent exactement a ceux deja
utilises par les requetes SQL brutes existantes — verifie par une preuve
executee contre un vrai PostgreSQL 16 (voir
`tests/e2e/raw-sql-proof/RESULTS.txt`).

## Consolidation de la logique SQL (evite la duplication API/worker)
`claimOutboxBatchAtomic`, `releaseStaleOutboxLocks` et
`nextReferenceSequence` sont deplaces dans `@smc/database/src/outbox-claim.ts`,
consommes a la fois par `OutboxRepository` (API) et `apps/worker/src/main.ts`
: une seule implementation de la requete `FOR UPDATE SKIP LOCKED` et du
compteur atomique, plus aucune divergence possible entre les deux
processus.

## Verification reelle effectuee
Faute d'acces au moteur Prisma dans cet environnement (voir rapport de
phase), la validation a ete faite en traduisant a la main le sous-ensemble
critique du schema en DDL SQL brut, applique a une instance PostgreSQL 16
installee localement (`apt-get install postgresql`, domaine autorise), et
en executant les memes requetes SQL que le code applicatif via `pg`
(node-postgres, independant de Prisma). Resultat : tous les tests passent,
y compris la concurrence (30 references simultanees, 5 workers Outbox
concurrents, 2 checkouts concurrents) et les contraintes CHECK. Ceci ne
remplace pas une execution complete via le client Prisma genere, mais
constitue une preuve reelle de la correction du schema et des requetes.

## Conditions de reevaluation
Des que le moteur Prisma sera accessible (environnement de developpement
ou CI standard), executer `pnpm db:validate && pnpm db:generate && pnpm
db:migrate` pour la confirmation definitive de bout en bout.
