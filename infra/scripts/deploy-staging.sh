#!/usr/bin/env bash
# Procedure de redeploiement reproductible du staging. A executer SUR le
# serveur de staging (pas depuis ce sandbox), depuis la racine du depot
# clone sur ce serveur. Un seul script, aucune commande a retenir.
#
# Usage : ./infra/scripts/deploy-staging.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -f .env.staging ]; then
  echo "Erreur : .env.staging introuvable. Copier .env.staging.example vers .env.staging et le remplir (voir docs/deployment/staging.md)." >&2
  exit 1
fi

echo "=== Sauvegarde minimale avant deploiement ==="
./infra/scripts/backup-staging-db.sh || echo "AVERTISSEMENT : la sauvegarde a echoue, deploiement poursuivi quand meme."

echo "=== Recuperation des dernieres images publiees (ghcr.io) ==="
docker compose --env-file .env.staging -f docker-compose.staging.yml pull

echo "=== Application des migrations + seed (service ephemere 'migrate') ==="
docker compose --env-file .env.staging -f docker-compose.staging.yml up migrate

echo "=== Redemarrage des services (sans interruption pour postgres/redis) ==="
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --remove-orphans

echo "=== Nettoyage des images obsoletes ==="
docker image prune -f

echo "=== Etat des services ==="
docker compose --env-file .env.staging -f docker-compose.staging.yml ps

echo ""
echo "Deploiement termine. Journaux : docker compose --env-file .env.staging -f docker-compose.staging.yml logs -f [service]"
