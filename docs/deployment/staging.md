# Deploiement du staging SaveMyControllers

Ce document decrit la procedure complete pour obtenir un environnement
de staging accessible par une vraie URL HTTPS. Il est ecrit pour etre
suivi une fois, puis reference pour les redeploiements (une seule
commande ensuite).

## Ce que ce depot fournit deja (aucune action requise)

- `.github/workflows/deploy-staging.yml` : construit et publie 3 images
  Docker (`api`, `worker`, `web`) vers GitHub Container Registry a
  chaque fusion sur `main`, en utilisant uniquement le compte GitHub du
  depot (aucun compte externe requis pour cette etape).
- `docker-compose.staging.yml` : orchestre Postgres, Redis, l'API, le
  worker, apps/web et Caddy (HTTPS automatique). Postgres et Redis ne
  sont accessibles sur AUCUN reseau public, meme en interne pour
  apps/web (isolation reseau a trois niveaux — voir le fichier).
- `infra/Caddyfile` : reverse proxy avec certificats Let's Encrypt
  automatiques, protection par mot de passe optionnelle.
- `infra/scripts/deploy-staging.sh` : redeploiement en une commande
  (sauvegarde, pull, migration, seed, redemarrage).
- `infra/scripts/backup-staging-db.sh` : sauvegarde `pg_dump` compressee
  avec retention de 7 jours.
- `prisma/seed/catalog-demo.ts` : catalogue de demonstration complet
  (marques, modeles, prestations, regles de compatibilite...).

## Ce qui reste a votre charge (je ne peux pas le faire moi-meme)

Un serveur avec Docker doit exister quelque part avec une adresse IP
publique et un nom de domaine pointant dessus. Options raisonnables pour
un staging (quelques euros/mois, ou gratuit selon l'offre) :
Hetzner Cloud, DigitalOcean, OVH, Oracle Cloud (offre gratuite), ou tout
serveur deja a votre disposition. Aucune de ces etapes ne necessite de
partager un mot de passe ou une carte bancaire avec moi.

### 1. Provisionner le serveur

- Une petite instance (1-2 Go de RAM suffit pour ce staging) avec
  Ubuntu ou Debian recent.
- Installer Docker et le plugin Compose :
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Pointer deux enregistrements DNS (A ou AAAA) vers l'IP du serveur :
  - `staging.votredomaine.com` (apps/web)
  - `api.staging.votredomaine.com` (API — doit etre un SOUS-DOMAINE du
    premier, necessaire pour le partage de cookie, voir plus bas)

### 2. Configurer la publication d'images (une fois)

Le workflow `deploy-staging.yml` a besoin d'une seule variable de depot
(pas un secret, juste une URL publique) pour construire correctement le
bundle navigateur de apps/web :

- GitHub → Settings → Secrets and variables → Actions → onglet
  **Variables** → New repository variable :
  - Nom : `STAGING_PUBLIC_API_URL`
  - Valeur : `https://api.staging.votredomaine.com`

Poussez ou fusionnez sur `main` : le workflow construit et publie les 3
images vers `ghcr.io/VOTRE_UTILISATEUR/savemycontrollers-{api,worker,web}`.
Par defaut ces paquets sont **prives** : sur le serveur, connectez-vous a
GHCR avec un token GitHub personnel a lecture seule sur les paquets
(Settings → Developer settings → Personal access tokens → scope
`read:packages` uniquement) :
```bash
echo "VOTRE_TOKEN" | docker login ghcr.io -u VOTRE_UTILISATEUR --password-stdin
```

### 3. Premier deploiement (sur le serveur)

```bash
git clone https://github.com/VOTRE_UTILISATEUR/savemycontrollers.git
cd savemycontrollers
cp .env.staging.example .env.staging
```

Editez `.env.staging` : remplacez chaque `CHANGEME_*` par une valeur
generee independamment (commandes fournies en commentaire dans le
fichier lui-meme), renseignez vos domaines, et
`IMAGE_REGISTRY=ghcr.io/VOTRE_UTILISATEUR/savemycontrollers`.

```bash
chmod +x infra/scripts/*.sh
./infra/scripts/deploy-staging.sh
```

Caddy obtient automatiquement les certificats HTTPS au premier demarrage
(peut prendre jusqu'a une minute).

### Redeploiement (a chaque mise a jour)

Une seule commande, depuis le serveur :
```bash
./infra/scripts/deploy-staging.sh
```
Sauvegarde la base, recupere les dernieres images, applique les
migrations et le seed, redemarre les services sans interrompre
Postgres/Redis.

## Contraintes de securite — comment elles sont respectees

| Contrainte | Mise en oeuvre |
|---|---|
| Postgres/Redis jamais exposes publiquement | Reseau Docker `backend` marque `internal: true`, aucun `ports:` publie. apps/web n'y a meme pas acces (reseau `internal-api` separe). |
| Aucun secret de production | `.env.staging` genere independamment, jamais copie depuis la production ; `NODE_ENV=production` pour le comportement, mais tous les secrets sont distincts. |
| Cookies/CORS/CSRF/proxy de confiance | `COOKIE_DOMAIN` partage entre les deux sous-domaines, `CORS_ALLOWED_ORIGINS` restreint a l'origine du staging, `TRUSTED_PROXY_COUNT=1` (Caddy est l'unique proxy en amont). |
| Aucun paiement reel | Aucune integration de paiement n'existe encore dans le code (voir rapport de phase) ; aucune cle Stripe dans `.env.staging.example`. |
| Sauvegarde minimale | `backup-staging-db.sh`, `pg_dump` quotidien recommande via cron (exemple fourni dans le script), retention 7 jours. |
| Acces protege si necessaire | `infra/Caddyfile` : bloc `basic_auth` commente, pret a activer. |
| Journaux accessibles | `docker compose logs -f [service]` sur le serveur ; rotation automatique (`max-size`/`max-file` sur chaque service). |

## Donnees de demonstration et identifiants

Le catalogue de demonstration (marques, modeles, prestations, regles de
compatibilite) est seede automatiquement (`SEED_DEMO_CATALOG=true`).

Il n'y a **pas de compte client pre-cree** : l'inscription etant un vrai
parcours ouvert (voir `/inscription`), la maniere la plus honnete de
tester est de creer votre propre compte sur le staging, exactement comme
un utilisateur reel le ferait.

Un compte super-administrateur optionnel peut etre cree en renseignant
`SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` dans `.env.staging`
avant le premier deploiement (utilite limitee tant que l'interface
d'administration n'est pas construite).

## Limites connues de ce staging

- Aucun envoi d'email reel (`SMTP_HOST=localhost` sans serveur SMTP
  reel) : les emails de verification/reinitialisation ne partent pas.
  Pour tester ces parcours, verifier manuellement l'email en base
  (`email_verified_at`) comme le fait la CI E2E.
- Aucun paiement (le parcours s'arrete a `AWAITING_PAYMENT`, conforme au
  perimetre actuel).
- L'interface d'administration (apps/ops) n'a pas encore de pages
  fonctionnelles au-dela du squelette existant.
- Le stockage de fichiers (`STORAGE_*`) pointe vers des valeurs
  factices : aucun upload n'est actif dans le parcours actuel.

## Executer les tests E2E contre le staging

Une fois le staging en ligne :
```bash
cd tests/e2e/playwright
npm install
npx playwright install --with-deps chromium
E2E_BASE_URL=https://staging.votredomaine.com \
E2E_API_URL=https://api.staging.votredomaine.com \
npx playwright test
```
