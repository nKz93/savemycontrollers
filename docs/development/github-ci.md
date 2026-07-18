# GitHub — depot privé et CI

Ce document explique comment deposer SaveMyControllers dans un depot
GitHub prive et faire tourner la CI pour la premiere fois. Il complete
`docs/development/getting-started.md` (demarrage local).

## Contexte important

Le code a ete developpe dans un environnement sandbox dont l'acces reseau
est restreint : `binaries.prisma.sh` (moteur Prisma) et
`registry-1.docker.io` (images Docker) y sont inaccessibles (voir
`docs/development/prisma-runtime-blocker-proof.txt` et
`docker-build-attempt-proof.txt` pour les preuves exactes). En consequence
:

- **aucune migration Prisma n'a pu etre generee** ;
- **aucune image Docker n'a pu etre construite ni demarree**.

Tout le reste (code, tests unitaires, ESLint, typecheck des packages
independants de Prisma, preuves SQL contre PostgreSQL/Redis reels
installes localement dans le sandbox) a ete verifie autant que possible.
La CI GitHub Actions (`.github/workflows/ci.yml`) est le mecanisme prevu
pour lever ces deux blocages, puisqu'un runner GitHub standard a un acces
reseau normal.

## 1. Creer le depot prive

```bash
# Sur github.com : New repository -> Private -> ne PAS initialiser avec un README
# (le projet en a deja un)
```

## 2. Extraire l'archive et pousser

```bash
tar -xzf savemycontrollers-github-ready.tar.gz
cd savemycontrollers
git init
git add .
git commit -m "Import initial du socle SaveMyControllers"
git branch -M main
git remote add origin git@github.com:<votre-compte>/savemycontrollers.git
git push -u origin main
```

## 3. Generer la premiere migration Prisma

Aucune migration n'existe encore dans le depot (voir contexte ci-dessus).
**A faire une seule fois, en local, avec un acces reseau standard** (pas
depuis un environnement restreint) :

```bash
cp .env.example .env   # renseigner des valeurs locales
docker compose up -d --wait
pnpm install
pnpm --filter @smc/database exec prisma migrate dev --schema ../../prisma/schema.prisma --name initial
```

Cela va :
1. telecharger le moteur Prisma (fonctionne normalement hors sandbox) ;
2. generer `prisma/migrations/<timestamp>_initial/migration.sql` ;
3. l'appliquer sur votre base locale ;
4. generer le client Prisma.

**Inspectez le SQL genere**, puis integrez-y les contraintes `CHECK`
documentees dans `prisma/manual-constraints/001_check_constraints.sql`
(montants positifs, taux de remise 0-100%, delai coherent, propriete
d'adresse et de panier mutuellement exclusive — voir
`tests/e2e/raw-sql-proof/schema.sql` pour la version deja prouvee contre
PostgreSQL reel). Une fois satisfait :

```bash
git add prisma/migrations
git commit -m "Ajoute la migration Prisma initiale (avec contraintes CHECK)"
git push
```

**Puis supprimez de `.github/workflows/ci.yml` l'etape marquee
`[TEMPORAIRE]`** : une fois une vraie migration committee, la CI n'a plus
besoin de ce garde-fou et doit se contenter de `prisma migrate deploy`.

## 4. Lancer la CI

Elle se declenche automatiquement sur chaque `push` ou `pull request` vers
`main`. Pour la relancer manuellement sans nouveau commit : onglet
**Actions** du depot -> workflow **CI** -> **Re-run all jobs**.

## 5. Lire les erreurs

- Chaque etape correspond a une commande unique (`pnpm lint`, `pnpm
  test:unit`...) : l'etape qui echoue indique precisement la commande en
  cause.
- Les logs complets de chaque etape sont visibles en cliquant dessus dans
  l'interface GitHub Actions.
- En cas d'echec, des artefacts de diagnostic sont conserves 14 jours
  (rapport d'audit, logs de demarrage API/worker, contrat OpenAPI, client
  genere) — voir section suivante pour les telecharger.

## 6. Telecharger les artefacts

Onglet **Actions** -> executer concerne -> section **Artifacts** en bas de
page -> **ci-diagnostics**. Aucun artefact ne contient de secret : les
variables d'environnement de la CI sont exclusivement des valeurs de test
sans usage en production (voir section 7).

## 7. Variables utilisees par la CI

Toutes definies directement dans `.github/workflows/ci.yml` (bloc `env:`),
avec des valeurs de test explicites, jamais valables en production (le
schema `apps/api/src/config/env.schema.ts` les refuserait categoriquement
si `NODE_ENV=production`) :

| Variable | Usage |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_TEST` | Bases PostgreSQL principale et de test du service `postgres` |
| `REDIS_URL` | Service `redis` |
| `ACCESS_TOKEN_SECRET` / `CSRF_SECRET` | Secrets JWT/CSRF de test (32+ caracteres, valeurs `ci-only-...`) |
| `PAYLOAD_ENCRYPTION_KEY` | Cle AES-256 de test (base64, 32 octets) |
| `STORAGE_*` | Identifiants de test pour un futur service MinIO (non actif dans cette CI, voir ci.yml) |
| `SMTP_*` | Valeurs fictives (aucun envoi reel n'est teste) |

Pour un environnement de PRODUCTION reel, ces valeurs doivent etre
remplacees par de vrais secrets, stockes dans les **GitHub Actions
Secrets** (jamais en clair dans le workflow) ou dans le systeme de gestion
de secrets de votre plateforme de deploiement — jamais copiees depuis ce
fichier CI.

## 8. Revenir a une version precedente

```bash
git log --oneline          # identifier le commit a restaurer
git revert <sha>           # cree un nouveau commit annulant les changements (recommande)
# ou, pour un retour destructif (a eviter sur une branche partagee) :
git reset --hard <sha>
git push --force-with-lease
```

Pour la base de donnees, restaurer une migration precedente necessite une
migration `down` explicite (Prisma ne genere pas de rollback automatique)
ou une restauration depuis une sauvegarde.

## 9. Ce qui reste inconnu tant que la CI n'a pas tourne

- Que `prisma validate`/`generate`/`migrate deploy` reussissent reellement
  sur le schema actuel (relu manuellement et verifie par des tests SQL
  bruts equivalents, mais jamais execute via Prisma lui-meme).
- Que `pnpm build` reussisse de bout en bout pour `apps/api` et
  `apps/worker` (bloque uniquement par l'absence de types Prisma generes
  dans le sandbox, voir preuve dans `prisma-runtime-blocker-proof.txt`).
- Que les 4 images Docker se construisent et demarrent (jamais teste au-
  dela de la confirmation que le daemon Docker lui-meme fonctionne — le
  registre Docker Hub etait inaccessible depuis le sandbox).
- Le resultat reel de `pnpm audit --prod` sur l'environnement CI (les
  versions resolues peuvent differer legerement de celles observees dans
  le sandbox).
