# ADR-018 — Validation centralisee et stricte de l'environnement

## Contexte
Plusieurs valeurs de secours dangereuses existaient dans le code
(`dev-only-insecure-secret-change-me` utilisable comme secret JWT
reel si la variable d'environnement manquait), sans aucune verification
au demarrage.

## Decision
`apps/api/src/config/env.schema.ts` (Zod) valide `process.env` avant toute
autre initialisation (`main.ts` appelle `validateEnv()` en toute premiere
ligne de `bootstrap()`). En production, des regles additionnelles
refusent explicitement :
- l'usage de la valeur de secours `dev-only-insecure-secret-change-me` ;
- un `ACCESS_TOKEN_SECRET` de moins de 32 caracteres ;
- les identifiants MinIO de developpement connus ;
- tout domaine `localhost`/`.example` dans `API_URL`, `STORAGE_ENDPOINT`,
  `COOKIE_DOMAIN`, `SMTP_FROM` ;
- la presence de `SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD` ;
- l'absence de `PAYLOAD_ENCRYPTION_KEY`.

`TokenService` refuse desormais de s'instancier sans
`ACCESS_TOKEN_SECRET` (aucun fallback utilisable, y compris en dehors de
`validateEnv` — double protection).

## Consequences
Un demarrage en production avec une configuration dangereuse echoue
immediatement avec un message explicite listant chaque probleme, plutot
que de demarrer silencieusement dans un etat non securise.
