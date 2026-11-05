# Render'ga deploy (bepul tarif) — Neon PostgreSQL + Upstash Redis

Repo ildizidagi `render.yaml` (Blueprint) shu qadamlarni avtomatlashtiradi; maxfiy qiymatlar dashboard'da kiritiladi.

## Oldindan tayyorlash

1. **Neon** (neon.tech) → project → *Connection Details*:
   - **Pooled** ulanish (host'da `-pooler`) → `DATABASE_URL`. Oxiriga qo'shing: `?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=5`
   - **Direct** ulanish (pooler'siz) → `DIRECT_URL` (faqat build paytida migratsiya/seed uchun).
   - PostGIS va pg_trgm migratsiyalar orqali o'zi yoqiladi (`CREATE EXTENSION`); Neon ularni qo'llab-quvvatlaydi.
2. **Upstash** (upstash.com) → Redis database → *TLS* yoqilgan `rediss://default:<parol>@<host>.upstash.io:6379` → `REDIS_URL`.
3. **S3-mos saqlash (keyinroq, hozircha shart emas).** `STORAGE_*` bo'sh bo'lsa ilova ishlaydi, lekin rasm/fayl yuklash ishlamaydi (logo, portfolio, chat ilovalari). Bepul variant: Cloudflare R2 (bucket + API token → `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`).
4. **OTP kodi — hozircha ekranda.** `render.yaml` da `NODE_ENV=staging`, `OTP_DEV_ECHO=true`, `OTP_DEV_ECHO_AUTH=true`: tasdiqlash kodi javobda qaytadi va kirish ekranida ko'rinadi (SMS/email shart emas). **Bu faqat sinov uchun:** kod API javobida ochiq bo'lgani uchun telefon egaligi tekshirilmaydi (istalgan kishi istalgan raqamga ro'yxatdan o'ta oladi). Haqiqiy foydalanuvchilarga ochishdan oldin `NODE_ENV=production` qiling, `OTP_DEV_ECHO*` ni o'chiring (production'da ular yoqilgan bo'lsa ilova ishga tushmaydi) va SMTP (`SMTP_*`), Eskiz (`ESKIZ_*`) yoki Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_OTP_CHAT_ID`) ulang.
5. `JWT_SECRET` yarating (kamida 32 belgi): `openssl rand -base64 48`

## Render dashboard

1. **New → Blueprint** → GitHub repo'ni ulang (`render.yaml` avtomatik o'qiladi). Yoki qo'lda: **New → Web Service**:
   - Runtime: **Node**, Region: Frankfurt, Instance Type: **Free**
   - Build Command: `bash scripts/render-build.sh`
   - Start Command: `node dist/main.js`
   - Health Check Path: `/api/v1/health`
2. **Environment** bo'limida `render.yaml` dagi `sync: false` o'zgaruvchilarni to'ldiring (nomlari faylda; qiymatlarni chatga/repo'ga yozmang):
   `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS` (faqat https), `PUBLIC_API_URL`, `CUSTOMER_PANEL_URL`, `SHOP_PANEL_URL`, `AUTH_COOKIE_SAME_SITE`, `METRICS_TOKEN`, `OPS_WEBHOOK_SECRET` (va keyinroq `STORAGE_*`, kod yetkazish `SMTP_*` / `ESKIZ_*` / `TELEGRAM_*`).
3. **Birinchi deploy uchun qo'shimcha:** `RUN_SEED=true`, `ADMIN_PHONE` (masalan `998901234567`), `ADMIN_PASSWORD` (≥ 12 belgi). Bu siyosatlar, katalog, kalkulyator ma'lumotlari va birinchi super adminni yaratadi (ularsiz ro'yxatdan o'tish ishlamaydi).
4. **Create / Deploy.** Build paytida: bog'liqliklar → `prisma generate` → `nest build` → `prisma migrate deploy` (→ seed).
5. Deploy muvaffaqiyatli bo'lgach **`RUN_SEED` va `ADMIN_PASSWORD` ni o'chiring** (seed har safar admin parolini qayta yozadi) va **Manual Deploy** qiling.

## Tekshirish

- `https://<servis>.onrender.com/api/v1/health` → `{"success":true,"data":{"status":"ok",...}}` (liveness; bazani uyg'otmaydi).
- `https://<servis>.onrender.com/api/v1/health/ready` → `ready` bo'lsa baza va Redis ulangan.
- `https://<servis>.onrender.com/api/v1/site/home` → 200 va bosh sahifa bloklari.
- Render *Logs*: `Nest application successfully started` qatori.

## Bepul tarif cheklovlari (bilib qo'ying)

- **15 daqiqa so'rov bo'lmasa servis uxlaydi**, keyingi so'rov ~30–60 s da uyg'otadi. Uxlayotganda rejalashtirilgan joblar (`@Cron`, BullMQ: eslatmalar, SLA, kurs yangilash, kvota tekshiruvi) ishlamaydi.
- 512 MB RAM. ClamAV (virus tekshiruvi) bepul tarifda yo'q (`CLAMAV_HOST` bo'sh).
- **Upstash bepul tarifida buyruqlar limiti bor** (oyiga ~500 ming). BullMQ va rate-limit Redis'ni doimiy ishlatadi — limit tez tugashi mumkin. Tugasa, ilova Redis xatolari bilan ishlamay qoladi: kuzatib boring yoki pullik rejaga o'ting.
- Neon bepul tarifida baza 5 daqiqa bo'sh turganda uxlaydi (birinchi so'rov bir necha soniya kechikadi).

## Frontend

Bu qo'llanma faqat API uchun. Frontend (`apps/web`, to'rt panel) alohida deploy qilinadi (masalan, Render Static Site); u `CORS_ORIGINS` ga https manzillari bilan kiritilishi kerak. Frontend boshqa domenda bo'lsa `AUTH_COOKIE_SAME_SITE=none` (va `AUTH_COOKIE_SECURE=true`) qo'ying.
