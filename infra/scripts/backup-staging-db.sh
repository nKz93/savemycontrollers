#!/usr/bin/env bash
# Sauvegarde minimale de la base de staging (pg_dump compresse, retention
# de 7 jours). A executer SUR le serveur de staging. Peut etre appelee
# manuellement ou via une entree cron quotidienne :
#   0 3 * * * cd /chemin/vers/le/depot && ./infra/scripts/backup-staging-db.sh >> /var/log/smc-staging-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -f .env.staging ]; then
  echo "Erreur : .env.staging introuvable." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env.staging; set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/smc-staging-$TIMESTAMP.sql.gz"

echo "Sauvegarde vers $FILE ..."
docker compose --env-file .env.staging -f docker-compose.staging.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

echo "Sauvegarde terminee : $(du -h "$FILE" | cut -f1)"

echo "Suppression des sauvegardes de plus de 7 jours..."
find "$BACKUP_DIR" -name "smc-staging-*.sql.gz" -mtime +7 -delete

echo "Sauvegardes actuelles :"
ls -lh "$BACKUP_DIR"/smc-staging-*.sql.gz 2>/dev/null || echo "(aucune)"
