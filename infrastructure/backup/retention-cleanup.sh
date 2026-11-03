#!/usr/bin/env bash
# Eski zaxiralarni o'chiradi: oxirgi KEEP_DAILY kun — har kuni, undan eskilari — faqat har oyning 1-kuni (KEEP_MONTHLY oy).
# Ishlatish:  ./retention-cleanup.sh [papka]   (DRY_RUN=1 — faqat ko'rsatadi)
set -euo pipefail

dir="${1:-${BACKUP_DIR:-./backups}}"
keep_daily="${KEEP_DAILY:-14}"
keep_monthly="${KEEP_MONTHLY:-6}"
now="$(date -u +%s)"

for file in "$dir"/quyosh-*.dump; do
  [ -e "$file" ] || continue
  name="$(basename "$file")"
  day="${name#quyosh-}"; day="${day:0:8}"
  ts="$(date -u -d "${day:0:4}-${day:4:2}-${day:6:2}" +%s)"
  age=$(( (now - ts) / 86400 ))
  keep=0
  if [ "$age" -le "$keep_daily" ]; then keep=1
  elif [ "$age" -le $(( keep_monthly * 31 )) ] && [ "${day:6:2}" = "01" ]; then keep=1; fi
  if [ "$keep" -eq 0 ]; then
    echo "o'chiriladi: $name (${age} kunlik)"
    [ "${DRY_RUN:-0}" = "1" ] || rm -f "$file" "$file.sha256"
  fi
done
