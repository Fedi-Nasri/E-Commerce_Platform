#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <database-label> /path/to/backup.sql.gz"
  echo "  database-label: main | retail | para | alimentation | fashion | catalog"
  exit 1
fi

LABEL="$1"
BACKUP_FILE="$2"

case "$LABEL" in
  main)         CONTAINER="1111-postgres" ;;
  retail)       CONTAINER="1111-retail-postgres" ;;
  para)         CONTAINER="1111-para-postgres" ;;
  alimentation) CONTAINER="1111-alimentation-postgres" ;;
  fashion)      CONTAINER="1111-fashion-postgres" ;;
  catalog)      CONTAINER="1111-catalog-postgres" ;;
  *)
    echo "Unknown database label: $LABEL"
    exit 1
    ;;
esac

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Restoring $LABEL from $BACKUP_FILE into $CONTAINER..."
gunzip -c "$BACKUP_FILE" \
  | docker exec -i "$CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Restore complete."
