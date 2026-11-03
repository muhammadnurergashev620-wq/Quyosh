#!/usr/bin/env bash
# Postgres'ning to'liq zaxira nusxasi (pg_dump, custom format) + SHA-256 nazorat summasi.
# Ishlatish:  DATABASE_URL=postgresql://... ./backup.sh [chiqish_papkasi]
# Docker'dagi bazadan:  PG_DOCKER_CONTAINER=quyosh-postgres ./backup.sh
set -euo pipefail

out_dir="${1:-${BACKUP_DIR:-./backups}}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$out_dir/quyosh-$stamp.dump"
mkdir -p "$out_dir"
umask 077

if [ -n "${PG_DOCKER_CONTAINER:-}" ]; then
  docker exec "$PG_DOCKER_CONTAINER" sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-quyosh}" -Fc --no-owner' > "$file"
else
  : "${DATABASE_URL:?DATABASE_URL yoki PG_DOCKER_CONTAINER kerak}"
  pg_dump "${DATABASE_URL%%\?*}" -Fc --no-owner -f "$file"
fi

# Bo'sh yoki buzilgan fayl "zaxira" bo'lib qolmasin.
[ -s "$file" ] || { echo "XATO: zaxira fayli bo'sh" >&2; rm -f "$file"; exit 1; }
(cd "$out_dir" && sha256sum "$(basename "$file")" > "$(basename "$file").sha256")
echo "OK $file ($(du -h "$file" | cut -f1))"
