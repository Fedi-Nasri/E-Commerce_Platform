#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/1111}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups/db}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

DATABASES=(
  "1111-postgres:main"
  "1111-retail-postgres:retail"
  "1111-para-postgres:para"
  "1111-alimentation-postgres:alimentation"
  "1111-fashion-postgres:fashion"
  "1111-catalog-postgres:catalog"
)

for entry in "${DATABASES[@]}"; do
  container="${entry%%:*}"
  label="${entry##*:}"
  backup_file="$BACKUP_DIR/1111-${label}-db-${TIMESTAMP}.sql.gz"

  echo "Backing up $container -> $backup_file"
  docker exec "$container" sh -c 'pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    | gzip -9 > "$backup_file"
done

find "$BACKUP_DIR" -type f -name '1111-*-db-*.sql.gz' -mtime +14 -delete

echo "Backup complete: $BACKUP_DIR"
