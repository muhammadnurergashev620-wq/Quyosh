# Quyosh Platformasi

Quyosh paneli o‘rnatishni rejalashtirayotgan mijozlarni do‘konlar va montaj xizmatlari bilan bog‘laydigan platforma:
kalkulyator (Tez/Batafsil hisob), moliyalashtirish va elektr uzilishi kalkulyatori, xarita, uskuna katalogi,
taklif so‘rovi → narx taklifi → montaj → sharh oqimi, do‘kon va admin panellari.

**Yagona manba:** [`docs/tz/Quyosh_TZ_UIUX_v3.0.md`](docs/tz/Quyosh_TZ_UIUX_v3.0.md) (I qism — TZ, II qism — UI/UX).
Karkas GetMaster loyihasidan olingan (NestJS 11 + Prisma + Vite/React, to‘rt panel).

## Holat (TZ 1.5 bosqichlari)

| Bosqich | Holat |
|---|---|
| M1 Poydevor | Karkas ko‘chirildi: auth (OTP, sessiyalar, 2FA), rollar `CUSTOMER/SHOP/ADMIN`, `Shop`/`ShopMember`, admin (foydalanuvchilar, audit, xatolar, DevOps), media, outbox/queue, to‘rt panel qobig‘i, `--qs-` token tizimi. Qolgan: i18n uz/oz/ru, Onest shrifti, Storybook, CI to‘liq. |
| M2 Katalog va do‘konlar | Do‘kon ochish (max 3), onboarding, a’zolar va takliflar (token, TRANSFER), filiallar (optimistic lock), xizmatlar, verifikatsiya va admin tasdiqlash/to‘xtatish, superadmin do‘kon yaratish (dublikat tekshiruvi); yagona ProductModel katalogi, model taklifi/moderatsiya/birlashtirish, narxlar (UZS/USD, MB kursi `cbu.uz`, har kuni 09:30), CSV/XLSX import (tekshirish → faqat to‘g‘ri qatorlarni qo‘llash), ochiq katalog, solishtirish, do‘kon profili. |
| M3 Xarita va obyektlar | PostGIS: filial nuqtasi, xizmat hududi (radius yoki poligon, ≤ 20 000 km²), mijoz obyektlari va maydonlari (`ST_Area(::geography)`, qiya tom `÷cos(tilt)`, foydali koeffitsient), server klasterlash (`ST_SnapToGrid`, zoom < 13), «xizmat ko‘rsatadiganlar» (`ST_Covers`), Esri geocoding adapteri (`forStorage=false`); MapLibre + poligon muharriri (sichqoncha va sensor), OSM zaxira uslubi. |
| M4 Hisoblash dvigateli | `src/modules/calc-engine` — sof TS: 8760 soatlik o‘q (Asia/Tashkent), pog‘onali/kun-tun tarif va billdan teskari hisob, maydon→panel soni, tavsiya (3 variant, cheklovchi omil), invertor/akkumulyator, soatlik balans (SOC, invariantlar), eksport kompensatsiyasi (net metering o‘tkazish), 25 yillik model (NPV, IRR, LCOE, almashtirishlar), 3 ssenariy, kredit (annuitet/differensial, break-even), uzilish, moslik, insightlar. Solar: PVGIS (A) ‖ NASA POWER + TS PV modeli (B) parallel, viloyat o‘rtachasi (DEFAULT), 0,05° kesh S3’da. Golden test: B vs PVGIS (Samarqand 2019, yillik −2,4 %). Admin: tariflar (versiya, manba, kesishmaslik — exclusion constraint), eksport, limitlar, moliyalashtirish, sozlamalar versiyalari. |
| M5 Kalkulyator UI | Tez hisob (3 blok, avtomatik hisob), 6 qadamli Batafsil hisob (URL’da qadam, draft — guest cookie, login’dan keyin biriktiriladi; poligon chizish desktop/mobil krest bilan; maishiy texnika shablonlari), qayta hisoblash qoidasi U8.9 (800 ms debounce, guest 6 s / mijoz 2 s, AbortController, 429), natija sahifasi (KPI + diapazon, quyosh kuni, insightlar, energiya, pul, 25 yil, kredit, uzilish, «Qanday hisoblandi»), saqlash, ulashish (manzilsiz), solishtirish, qayta hisoblash (yangi yozuv), PDF (BullMQ job → pdfkit → S3, QR, uz/oz/ru), kredit va uzilish kalkulyatorlari. |
| M6 Takliflar va muloqot | Taklif so‘rovi (1–5 do‘kon, 3 ochiq / kuniga 5, xizmat hududi bo‘yicha birinchi), kontakt siyosati (ochilmaguncha faqat ism/hudud/parametrlar), yozishma (ilovalar 5 × 10 MB, tizim xabarlari, o‘qildi, qayta yuborish), o‘lchov uchrashuvi (1–3 slot, tasdiq kontaktni ochadi, `.ics`), takliflar (summalar serverda, USD→UZS MB kursi, revision snapshot va farqlar, bitta faol taklif — partial unique, PDF uz/oz/ru), solishtirish (haqiqiy belgilar, hisob bo‘yicha o‘zini oqlash diapazoni), qabul → montaj (timeline, chek-list 13.7 — majburiy rasm, «Muammo bor» izohi, tuzatish so‘rash, e’tiroz → admin), o‘rnatilgan tizim + kafolatlar, sharhlar (13.4 deterministik risk belgilari, ModerationSettings, avto-shikoyat), do‘kon javobi, shikoyatlar, sevimlilar; do‘kon inbox (ro‘yxat + kanban pipeline, mas’ul, ichki izohlar), quote builder (katalog, moslik badge’i); joblar: quote-expiry, request-expiry, installation-reminder, response-time-recalc; bildirishnomalar outbox orqali (in-app, SMS, email). Holat mashinalari: `src/modules/<entity>/<entity>-state-machine.ts`. |
| M7 Kabinetlar va kontent | Montajdan keyingi kabinet (oylik ko‘rsatkich kWh yoki hisoblagich farqi, prognozdan > 20 % farq ogohlantirishi, kafolatlar, tozalash/ko‘rik/kafolat eslatmalari — «Bajarildi», «7 kunga surish»), mijoz/do‘kon/admin bosh panellari (U10.1, U11.2, U12.1), portfolio (rasm tartibi, «Tasdiqlangan montaj»), sertifikatlar (admin tasdig‘i, muddati o‘tganda belgi yashiriladi, ro‘yxat filtri), embed vidjet (CSP `frame-ancestors`, kontrast tekshiruvi, OTP orqali lead → avtomatik akkaunt, manba WIDGET), analitika (PII’siz hodisalar, do‘kon analitikasi + CSV, admin funnel), yordam markazi (SUP-raqam, ish vaqti SLA, guest OTP, FAQ tavsiyalari, admin navbati, ichki izoh, shablonlar, baho, avto-yopish), bilimlar markazi (24 material uz/ru + oz transliteratsiya, qidiruv — trigram, sitemap.xml + hreflang, JSON-LD, admin muharriri), hisobni o‘chirish (14 kun bekor qilish, keyin anonimlashtirish), saqlash muddatlari jobi, k6 (`scripts/load/estimate.k6.js`) va prerender (`scripts/prerender.mjs`). bosh sahifa CMS (`SiteBlock`: 9 blok uz/ru/oz, qoralama → ko‘rinish → nashr, versiyalar audit jurnalida, tartib va yashirish; raqamlar bazadan, sharhlar faqat PUBLISHED), taklif shablonlari (quote builder), bildirishnoma kanallari (in-app + SMS + email, tur bo‘yicha sozlama `/sozlamalar/bildirishnomalar`, tungi SMS 22:00–08:00 → 08:00, xavfsizlik bundan mustasno), ops: provayder hisoblagichlari va oylik kvota (`provider-quota-poll`, 80/95 % alert), Alertmanager va deploy webhooklari (HMAC), DevOps sahifasida alertlarni qabul qilish. **Obuna va to‘lovlar, foydalanuvchi Telegram boti loyihadan olib tashlangan** (buyurtmachi qarori); Telegram faqat operatorlar uchun ichki ogohlantirish kanali sifatida qolgan (`TELEGRAM_*`, ixtiyoriy). |

## Tuzilma

```
src/                 NestJS API (modular monolith)
  modules/           auth, otp, users, avatar, admin, audit, error-log, legal, mail, media, notification, push, public,
                     shop, catalog (katalog, narxlar, import, kurslar), geo (PostGIS, xarita, obyektlar, geocoding),
                     calc-engine + calc (hisob, PDF), quote-request / quote / installation / review (M6),
                     installed-system, shop-content (portfolio, sertifikat, vidjet), analytics, support, knowledge, maintenance (M7)
  infrastructure/    database, redis, queue (BullMQ + outbox), storage, scanner (ClamAV), sms, mail, telegram, metrics
prisma/              schema.prisma, migrations/ (SQL: partial unique, CHECK), seed.ts
apps/web/            Vite + React: bosh sayt (5170), mijoz (5173), do‘kon (5174), admin (5175)
infrastructure/      docker (PostGIS, Redis, MinIO, ClamAV), terraform, backup skriptlari
```

## Ishga tushirish

```bash
cp .env.example .env            # qiymatlarni to‘ldiring (JWT_SECRET, DATABASE_URL, ...)
docker compose -p quyosh --env-file .env -f infrastructure/docker/docker-compose.local.yml up -d
pnpm install && pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed
pnpm start:dev                  # API (PORT, standart 3000)
cd apps/web && npm ci && npm run dev:all
```

Docker bo‘lmasa — root huquqisiz PostgreSQL 18 + PostGIS klasteri (`$HOME/.local/share/quyosh/pg`, port 55434):
tizimdagi `/usr/lib/postgresql/18` va `/usr/share/postgresql/18` nusxasi + `apt-get download postgresql-18-postgis-3
postgresql-18-postgis-3-scripts libgeos-c1t64 libgeos3.14.1 libproj25 proj-data libprotobuf-c1` (`dpkg-deb -x`),
`postgis.control → postgis-3.control` havolasi, so‘ng `initdb`. Boshqarish: `scripts/quyosh-db.sh start|stop|status|psql`.
S3 (MinIO o‘rniga): `scripts/quyosh-s3.sh start|stop|status` — s3rver, `:59100`, `$HOME/.local/share/quyosh/s3` (`.env`: `STORAGE_ENDPOINT=http://localhost:59100`, kalitlar `S3RVER`). Integratsion testlar ham `.env`dagi `STORAGE_ENDPOINT`ni ishlatadi (`TEST_STORAGE_ENDPOINT` bilan almashtirish mumkin).

Demo ma’lumot (xaritada 6 ta do‘kon): `SEED_DEMO=true DEMO_USER_PASSWORD=… pnpm db:seed`.

Birinchi Super Admin: `ADMIN_PHONE` / `ADMIN_PASSWORD` (≥ 12 belgi) `pnpm db:seed` orqali yaratiladi.
`OTP_DEV_ECHO=true` (faqat `NODE_ENV≠production`) — OTP kodi API javobida va kirish ekranida ko‘rinadi.

## Tekshiruvlar

```bash
pnpm typecheck && pnpm lint && pnpm test:unit      # backend (infratuzilmasiz)
pnpm test                                           # integratsiya (Postgres+PostGIS, Redis, S3; CREATEDB huquqi kerak)
cd apps/web && npm run typecheck && npm run lint && npx vitest run
```

### Ops webhooklari

- `POST /api/v1/ops/webhooks/alertmanager` va `POST /api/v1/ops/webhooks/deploy` — sarlavha `X-Quyosh-Signature: sha256=<HMAC-SHA256(raw body, OPS_WEBHOOK_SECRET)>`. Secret berilmasa webhooklar 401 qaytaradi.
- Deploy tanasi: `{ "service": "api", "environment": "production", "version": "1.4.0", "status": "STARTED|SUCCEEDED|FAILED|ROLLED_BACK", "gitSha"?, "triggeredBy"?, "changelogUrl"? }`; `FAILED` — CRITICAL alert.
- Oylik limitlar (ixtiyoriy, `ESRI_GEOCODE_MONTHLY_LIMIT` standart 20000): `ESRI_BASEMAP_MONTHLY_LIMIT`, `PVGIS_MONTHLY_LIMIT`, `NASA_POWER_MONTHLY_LIMIT`, `SMS_MONTHLY_LIMIT`, `EMAIL_MONTHLY_LIMIT`.

Production'da `OTP_DEV_ECHO`, `OTP_DEV_ECHO_AUTH` yoqilsa va `AUTH_COOKIE_SECURE=false` bo‘lsa ilova ishga tushmaydi.
