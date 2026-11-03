#!/usr/bin/env bash
# Zaxirani vaqtinchalik bazaga tiklab tekshiradi: nazorat summasi, jadvallar soni, asosiy jadvallardagi qatorlar.
# Jonli bazaga TEGMAYDI. Ishlatish:  ADMIN_DATABASE_URL=postgresql://user:pass@host:5432/postgres ./restore-drill.sh <fayl.dump>
set -euo pipefail

dump="${1:?zaxira fayli kerak: ./restore-drill.sh <fayl.dump>}"
: "${ADMIN_DATABASE_URL:?ADMIN_DATABASE_URL kerak (bazalar yarata oladigan ulanish, /postgres bazasiga)}"
[ -f "$dump" ] || { echo "XATO: $dump topilmadi" >&2; exit 1; }

if [ -f "$dump.sha256" ]; then
  (cd "$(dirname "$dump")" && sha256sum -c "$(basename "$dump").sha256") || { echo "XATO: nazorat summasi mos kelmadi" >&2; exit 1; }
fi

drill_db="quyosh_drill_$(date -u +%H%M%S)"
base="${ADMIN_DATABASE_URL%/*}"
drill_url="$base/$drill_db"
cleanup() { psql "$ADMIN_DATABASE_URL" -qc "DROP DATABASE IF EXISTS \"$drill_db\"" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN_DATABASE_URL" -qc "CREATE DATABASE \"$drill_db\""
# Yangi pg_restore eski serverga tushunmaydigan "SET transaction_timeout" yozadi — SQL orqali o'tkazib, uni olib tashlaymiz.
pg_restore --no-owner -f - "$dump" | sed '/^SET transaction_timeout/d' | psql -v ON_ERROR_STOP=1 -q "$drill_url" >/dev/null

tables="$(psql "$drill_url" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[ "$tables" -ge 20 ] || { echo "XATO: faqat $tables ta jadval tiklandi" >&2; exit 1; }
echo "Jadvallar: $tables"
for table in users orders bookings payments; do
  rows="$(psql "$drill_url" -Atc "SELECT count(*) FROM \"$table\"" 2>/dev/null || echo '?')"
  echo "  $table: $rows qator"
done
echo "OK: zaxira muvaffaqiyatli tiklandi va tekshirildi"
