#!/usr/bin/env bash
# Migratsiya + (kerak bo'lsa) boshlang'ich ma'lumot. Neon pooler (pgbouncer) orqali emas, DIRECT_URL (bo'lmasa DATABASE_URL) bilan.
#   - migratsiya: prisma migrate deploy (har deploy'da; faqat yangilarini qo'llaydi)
#   - seed: baza bo'sh bo'lsa YOKI RUN_SEED=true bo'lsa. Seed admin parolini (ADMIN_PHONE/ADMIN_PASSWORD) yozadi va
#     katalog/bilimlar matnlarini boshlang'ich holatga qaytaradi — shuning uchun to'ldirilgan bazada avtomatik ishlamaydi.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL berilmagan}"
MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"

DATABASE_URL="$MIGRATE_URL" pnpm db:migrate:deploy

SEED=false
if [ "${RUN_SEED:-}" = "true" ]; then
  SEED=true
else
  set +e
  DATABASE_URL="$MIGRATE_URL" pnpm exec tsx scripts/needs-seed.ts
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then SEED=true; elif [ "$rc" -ne 1 ]; then echo "needs-seed xatosi (kod $rc)"; exit "$rc"; fi
fi

if [ "$SEED" = "true" ]; then
  echo "Boshlang'ich ma'lumot yuklanmoqda (siyosatlar, katalog, kalkulyator, bilimlar markazi, admin)"
  DATABASE_URL="$MIGRATE_URL" pnpm db:seed
fi
