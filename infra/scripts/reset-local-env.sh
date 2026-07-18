#!/usr/bin/env bash
# Remise a zero complete de l'environnement local de developpement.
# Usage : bash infra/scripts/reset-local-env.sh
set -euo pipefail

echo "Arret et suppression des conteneurs + volumes..."
docker compose down -v

echo "Redemarrage de l'infrastructure locale..."
docker compose up -d --wait

echo "Application des migrations Prisma..."
pnpm db:migrate

echo "Chargement du seed..."
pnpm db:seed

echo "Environnement local reinitialise avec succes."
