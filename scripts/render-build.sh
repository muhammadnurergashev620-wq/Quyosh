#!/usr/bin/env bash
# Render (Node, free tarif) Build Command: `bash scripts/render-build.sh`
#   1) bog'liqliklar (devDependencies bilan — nest/prisma/typescript build uchun kerak; Render NODE_ENV=production qo'yadi)
#   2) prisma client + nest build
#   3) migratsiyalar: Neon pooler (pgbouncer) orqali emas, TO'G'RIDAN-TO'G'RI ulanish (DIRECT_URL) bilan; DIRECT_URL bo'lmasa DATABASE_URL
#   4) boshlang'ich ma'lumot (siyosatlar, katalog, kalkulyator ma'lumotlari, bilimlar markazi, birinchi admin) — FAQAT RUN_SEED=true bo'lganda
#      Seed har ishga tushganda admin parolini va katalog/bilimlar matnlarini boshlang'ich holatga qaytaradi, shuning uchun uni
#      faqat birinchi deploy'da yoqing va keyin RUN_SEED ni (hamda ADMIN_PASSWORD ni) o'chirib qo'ying.
# Migratsiya build'da bajariladi (start'da emas): bepul tarifda servis uxlab-uyg'onganda har safar migratsiya qayta ishlamaydi
# va migratsiya xato bersa — yangi versiya almashtirilmaydi (eskisi ishlashda davom etadi).
set -euo pipefail

corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm db:generate
pnpm build

: "${DATABASE_URL:?DATABASE_URL berilmagan}"
MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"
DATABASE_URL="$MIGRATE_URL" pnpm db:migrate:deploy

if [ "${RUN_SEED:-}" = "true" ]; then
  echo "RUN_SEED=true: boshlang'ich ma'lumot yuklanmoqda (bir martalik)"
  DATABASE_URL="$MIGRATE_URL" pnpm db:seed
fi
