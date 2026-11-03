#!/usr/bin/env bash
# Xavfli (ma'lumotni yo'qotuvchi) migratsiyalar PR/commit'ga "-- ACK-DESTRUCTIVE: <sabab>" izohisiz o'tmasin.
set -euo pipefail
base="${1:-}"
if [ -z "$base" ] || ! git cat-file -e "$base" 2>/dev/null; then base="$(git rev-list --max-parents=0 HEAD | tail -1)"; fi
status=0
for file in $(git diff --name-only --diff-filter=A "$base"...HEAD -- 'prisma/migrations/*/migration.sql' 2>/dev/null || true); do
  if grep -Eiq '(DROP[[:space:]]+(TABLE|COLUMN)|TRUNCATE|ALTER[[:space:]]+TABLE[^;]*DROP[[:space:]]+COLUMN)' "$file" && ! grep -q 'ACK-DESTRUCTIVE:' "$file"; then
    echo "::error file=$file::Xavfli migratsiya: '-- ACK-DESTRUCTIVE: <sabab>' izohini qo'shing"
    status=1
  fi
done
exit $status
