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
5. `JWT_SECRET` ni Render o'zi yaratadi (qo'lda kerak emas).

## Render dashboard

1. **New → Blueprint** → GitHub repo'ni ulang. `render.yaml` 5 ta servis yaratadi: `quyosh-api` (NestJS) va 4 ta statik sayt (`quyosh-portal`, `quyosh-customer`, `quyosh-shop`, `quyosh-admin`).
2. Render faqat `sync: false` qiymatlarni so'raydi (qiymatlarni chatga/repo'ga yozmang):
   `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `ADMIN_PASSWORD` (≥ 12 belgi; login `admin` — `render.yaml` dagi `ADMIN_LOGIN`). `JWT_SECRET`, `METRICS_TOKEN`, `OPS_WEBHOOK_SECRET` ni Render o'zi yaratadi. `STORAGE_*`, `SMTP_*`, `ESKIZ_*`, `TELEGRAM_*` ni hozircha bo'sh qoldiring.
3. **Apply.** API build paytida: bog'liqliklar → `prisma generate` → `nest build` → `prisma migrate deploy` → seed (**faqat baza bo'sh bo'lsa** yoki `RUN_SEED=true` bo'lganda; seed siyosatlar, katalog, kalkulyator ma'lumotlari va birinchi super adminni yaratadi). Keyingi deploy'larda admin paroli qayta yozilmaydi.
4. **Servis nomlari.** `quyosh-*` nomlari band bo'lsa Render boshqa manzil beradi (masalan `quyosh-api-x1y2.onrender.com`). Shunda `render.yaml` dagi `*.onrender.com` qiymatlarni (`CORS_ORIGINS`, `PUBLIC_API_URL`, `CUSTOMER_PANEL_URL`, `SHOP_PANEL_URL`, `VITE_API_BASE_URL`, `VITE_CUSTOMER_URL`) haqiqiy manzillarga almashtiring va qayta deploy qiling.

## Birinchi kirish

- Admin: `quyosh-admin` saytida login `admin` (yoki `ADMIN_LOGIN`) + `ADMIN_PASSWORD`; OTP yo'q.
- Do'kon: admin panelda do'kon yaratadi → bir martalik vaqtinchalik parol beriladi → do'kon login + parol bilan `quyosh-shop` saytiga kiradi (egasi uchun admin login belgilaydi) va parolni almashtiradi.
- Mijoz: `quyosh-customer` saytida ro'yxatdan o'tadi.

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

## Frontend va cookie

Frontend'lar API'dan boshqa subdomenlarda (`onrender.com` ommaviy suffiks), shuning uchun cookie `SameSite=None; Secure` bilan beriladi va `CORS_ORIGINS` to'rt frontend manzilini o'z ichiga oladi (`render.yaml` da sozlangan). **Cheklov:** Safari/iOS va ba'zi brauzerlar uchinchi tomon cookie'sini bloklaydi — u yerda kirish ishlamasligi mumkin. Yechim: o'z domeningizni ulang (masalan `api.example.uz`, `app.example.uz`) va `AUTH_COOKIE_SAME_SITE=lax` qiling.
