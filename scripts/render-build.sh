#!/usr/bin/env bash
# Render (Node, free tarif) API Build Command: `bash scripts/render-build.sh`
#   1) bog'liqliklar (devDependencies bilan — nest/prisma/typescript build uchun kerak; Render NODE_ENV ni build'ga ham beradi)
#   2) prisma client + nest build
#   3) migratsiya va (baza bo'sh bo'lsa) seed — scripts/render-db-setup.sh
# Migratsiya build'da bajariladi (start'da emas): bepul tarifda servis uxlab-uyg'onganda har safar qayta ishlamaydi va
# migratsiya xato bersa — yangi versiya almashtirilmaydi (eskisi ishlashda davom etadi).
set -euo pipefail

corepack enable
pnpm install --frozen-lockfile --prod=false
pnpm db:generate
pnpm build
bash scripts/render-db-setup.sh
