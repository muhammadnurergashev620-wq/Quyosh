# Quyosh — to‘liq audit (0-bosqich)

Sana: 2026-11-06 · Branch: `fix/full-audit` · Kod o‘zgartirilmagan (faqat `@vitest/coverage-v8` qo‘shildi — qamrovni o‘lchash uchun).

## 0. Muhit

Talabdagi portlar (5170/5173–5175, API 3000) bu kompyuterda **GetMaster**ga tegishli. Quyosh lokal stendi pm2 ostida:
bosh sayt **5180**, mijoz **5183**, do‘kon **5184**, admin **5185**, API **3100**, S3 (s3rver) 59100, Postgres 55434, Redis 56379.
`docker compose up`, `db:seed` ishga tushirilmadi: Docker yo‘q (o‘z PG klasteri), seed esa admin paroli/katalog/maqolalarni qayta yozadi.
Migratsiyalar qo‘llangan, `GET /api/v1/health/ready` → **200**.

## 1. Hozirgi holat (raqamlar)

| Tekshiruv | Natija |
|---|---|
| backend `pnpm typecheck` | 0 xato |
| backend `pnpm lint` | 0 xato |
| backend `pnpm test` (unit + integration) | 31 fayl, **240/240** o‘tdi |
| backend `pnpm test:unit` | 24 fayl, **148/148** |
| frontend typecheck / lint | 0 / 0 |
| frontend `vitest` | 25 fayl, **138/138** |
| frontend build (4 rejim) | o‘tdi; ogohlantirish: chunk > 500 KB |
| Backend qamrovi (`src/`) | **68,8 %** qator (calc-engine 91,3 %) |
| Frontend qamrovi | **36,9 %** qator |
| E2E (Playwright, `tests/e2e`) | **yo‘q** |

**Build hajmi (JS, gzip)** — to‘rt panel bir xil bundle oladi:

| Panel | JS fayllar | Jami raw | Jami gzip | Asosiy chunk (gzip) |
|---|---|---|---|---|
| bosh sayt / mijoz / do‘kon / admin | 117 | 4 960 KB | **1 228 KB** | **628 KB** (`index-*.js`) |

**Backend qamrovi — past modullar:** auth 35,8 %, admin 41,8 %, notification 26,6 %, error-log 15,4 %, audit 23,7 %, avatar 30,4 %, legal 33,6 %, media 53,8 %, catalog 53,4 %.

**Xavfsizlik bo‘yicha dinamik tekshiruv (IDOR):** 29 + 38 so‘rov — begona mijoz (B) A mijozning hisobi, so‘rovi, taklifi, montaji, tizimi, murojaati, yozishmasini; begona do‘kon (B) A do‘konning `/manage/shops/:id/*` (18 endpoint, yozish ham) ma’lumotini ocha olmadi (404/403). Mijoz tokeni bilan admin/do‘kon endpointlari — 403/404. **Muammo topilmadi.**
State machine’lar (QuoteRequest, QuoteRequestShop, Quote, Installation, Shop) TZ 13.1 / 3.7.3 jadvallariga **to‘liq mos**. Rate-limit, `mustPasswordChange` guard, prod’da OTP echo taqiqi, CORS validatsiyasi mavjud.

**Crawl (Playwright):** 92 marshrut × 2 kenglik = 184 sahifa. Console `error`: **0**, 4xx/5xx: **0** (faqat React Router future-flag ogohlantirishi). Batafsil: `console.md`, `network.md`.
Skrinshotlar: `docs/audit/before/<panel>/<sahifa>.png` (1440 px) va `…-390.png` — 21 MB, git’ga qo‘shilmaydi (`.gitignore`), lokal saqlanadi.

## 2. Topilmalar

Jiddiylik: **K** kritik · **Y** yuqori · **O** o‘rta · **P** past.

| ID | Joy | Turi | Jiddiylik | Tavsif | Qanday tuzatiladi |
|---|---|---|---|---|---|
| A-01 | `src/common/interceptors/idempotency.interceptor.ts`, `decorators/idempotent.decorator.ts` | xavfsizlik / mantiq | **Y** | TZ 9.4: `POST /quote-requests`, `…/quotes`, `…/quotes/:id/send`, `…/report` uchun `Idempotency-Key` majburiy. Interceptor yozilgan, lekin **hech qayerda ulanmagan** (knip: unused). Ikki marta bosilsa ikki yozuv yaratilishi mumkin (faqat kunlik limit cheklaydi). | Interceptor’ni shu endpointlarga ulash, kalit majburiy; frontend har submit uchun kalit yaratsin (`newIdempotencyKey` bor, ishlatilmagan). Integratsion test: bir kalit — bitta yozuv, boshqa body — 409. |
| A-02 | `apps/web/src/i18n/index.ts`, build | unumdorlik | **Y** | Asosiy chunk 628 KB gzip; barcha lug‘atlar (ru ×8 fayl, `ru.extra.ts` 310 KB, `en.ts` 254 KB) har panelda birdaniga yuklanadi. Lighthouse maqsadi (≥ 85/80) bilan erishib bo‘lmaydi. | Til lug‘atlarini dinamik `import()` qilish, o‘lik kalitlarni o‘chirish (A-08), `manualChunks` (three/gsap/maplibre alohida). |
| A-03 | `features/admin/user-actions.ts:17,31,38`; `features/notification/components/NotificationList.tsx:80`; `features/session/components/PhoneRequiredBanner.tsx`; `/maxfiylik` futeri; `features/admin/audit-labels.ts` (MASTER_/ORDER_/WORK_POST_ guruhlari) | keraksiz (GetMaster) / UX | **Y** | Foydalanuvchiga ko‘rinadigan GetMaster matnlari: “Usta bo‘lsa, profili ustalar qidiruvidan olinadi”, “Buyurtma va to‘lov tarixi saqlanadi”, “Buyurtma, chat va tasdiqlash xabarlari…”, “Buyurtma berish uchun telefon…”, “ilovadagi «Shikoyatlar» bo‘limi”. | Quyosh atamalari bilan qayta yozish (so‘rov / taklif / montaj / murojaat), audit yorliqlaridan GetMaster amallarini olib tashlash. |
| A-04 | `src/modules/media/media.service.ts:220-238` | xavfsizlik / qoida | **O** | Do‘kon a’zosi `CERTIFICATE` va `VERIFICATION_DOC` turidagi fayl yuklay oladi. Qoida: do‘kon panelida sertifikat yuklash yo‘q, belgilarni faqat admin qo‘yadi. UI bu turlarni ishlatmaydi. | Bu turlarni faqat ADMIN’ga ruxsat berish (yoki olib tashlash) + test (do‘kon → 403). |
| A-05 | 33 ta `toFixed`, `features/calc/labels.ts:64` (`ru-RU`), `features/catalog/format.ts` va `features/calc/labels.ts` da ikki xil `sum` | mantiq / format | **O** | Kasr nuqta bilan chiqadi (masalan, kredit kalkulyatorida “22.0 %”); TZ: “6,6 kVt”. Yagona `lib/format.ts` yo‘q; 17 faylda 28 ta to‘g‘ridan-to‘g‘ri `toLocaleString/Intl`. | `lib/format.ts` (son, pul, kVt, kVt·soat, %, sana — Asia/Tashkent) va hamma joyni unga o‘tkazish; unit testlar. |
| A-06 | `features/admin/dashboard/demo.ts`, `AdminDashboardPage` | mantiq | **O** | “Namuna ko‘rinish” tugmasi qattiq yozilgan soxta raqamlarni ko‘rsatadi — “soxta raqam yo‘q” qoidasiga zid (o‘tgan safar so‘rov bo‘yicha qo‘shilgan). | **Qaror kerak:** olib tashlash yoki faqat dev rejimda qoldirish. |
| A-07 | `pages/shop/ShopDashboardPage.tsx:48` | UX | **O** | To‘xtatilgan do‘kon banneri faqat bosh panelda; boshqa sahifalarda yozish tugmalari faol, bosilganda 423 xato. | Banner do‘kon layout’iga; yozish tugmalari o‘qish rejimida o‘chiq. |
| A-08 | `apps/web/src/i18n/*` | i18n / keraksiz | **O** | Kodda ishlatilgan 114 kalit ru’da, 10 tasi en’da yo‘q (masalan, “Login yoki parol noto‘g‘ri.”). `ru.extra.ts` dagi ≈ 1 844 / 3 387, `en.ts` dagi ≈ 506 kalit ishlatilmaydi (GetMaster). | Yetishmayotganlarni tarjima qilish; o‘lik kalitlarni o‘chirish; i18n testiga “ishlatilgan kalit lug‘atda bor” tekshiruvi. |
| A-09 | knip (frontend) | keraksiz fayl | **O** | 25 ta ishlatilmaydigan fayl: `components/ui/InfoTip.tsx`, `Pagination.tsx`, `common/LoadingScreen.tsx`, `media/ScrollVideo.tsx`, `features/admin/components/{AdminSearch,DateRangeFilter,MiniChart,PeriodPill,StatGrid,UserNumberField,UserRef}.tsx`, `features/admin/range.ts`, `features/media/components/{CompareSlider,MediaViewer}.tsx`, `features/media/file-info.ts`, `features/profile/{ProfileCard,ProfileHero}.tsx`, `features/session/components/GoogleLinkSettings.tsx`, `hooks/{useCountdown,usePagination}.ts`, `lib/labels.ts`, `pages/landing/fx/interactions.ts`, `services/{auth.client,storage.service}.ts`, `scripts/serve-dist.mjs`; ≈ 30 ishlatilmaydigan eksport. `public/voice/uz/*.mp3` (452 KB, GetMaster navigatsiya ovozi). Paketlar: `@capacitor/android`, `@capacitor/cli` (capacitor config yo‘q), `leaflet`, `@types/leaflet`. | Har birini grep + tsc + build bilan tekshirib o‘chirish. `InfoTip` — TZ talab qiladi: o‘chirilmaydi, ishlatiladi (3-bosqich). `push-sw.js` — ishlatiladi (knip xato). |
| A-10 | backend | keraksiz fayl | **P** | `common/constants/app.constants.ts`, `common/enum/index.ts`, `common/utils/{format-date,phone-gate}.ts`; `business.exception.ts` dagi 20 ta GetMaster exception (Payment, Refund, Order, Reschedule, MasterTime…); `error-messages.ts` dagi `MASTER_*`, `FEED_*`; `media.service.ts` `FEED_VIDEO_MAX_BYTES`; `vitest.config.ts` da mavjud bo‘lmagan `TASK`, `3-oy marcketplace` istisnolari; ikki `Dockerfile` (ildiz va `infrastructure/docker`). | Tekshirib o‘chirish. |
| A-11 | `.env.example` | keraksiz | **P** | Kodda ishlatilmaydigan kalitlar: `REFRESH_TOKEN_TTL_DAYS`, `MAP_QUOTA_WARN_PERCENT`, `GEOCODING_PROVIDER`, `SOLAR_PRIMARY_PROVIDER`, `SOLAR_FALLBACK_PROVIDER`, `EXCHANGE_RATE_SOURCE_URL`, `PROMETHEUS_URL`, `ALERTMANAGER_WEBHOOK_SECRET`, `DEPLOY_WEBHOOK_SECRET`. | O‘chirish (`.env` ga tegilmaydi). |
| A-12 | `router/router.tsx:181,186` | tuzilma | **P** | Bir sahifa ikki marshrutda: `/mijoz/montajlar/:id` va `/mijoz/montaj/:id`. | Bittasini `Navigate` qilish. |
| A-13 | CSS/TSX | UI | **O** | 48 CSS faylda 371 ta, TS/TSX da 56 ta xom HEX; 63 faylda 240 ta inline `style`; 76 faylda 204 ta xom `<button>` (406 ta `<Button>`). Button radius 14 px (talab 12), `icon-only` varianti yo‘q. | Tokenlarga o‘tkazish; Button’ga `icon` varianti; xom tugmalarni ko‘chirish (3-bosqich). |
| A-14 | 18 fayl > 300 qator | tuzilma | **P** | `AdminAdminsPage.tsx` 554, `DetailedCalcPage.tsx` 474, `AdminUsersPage.tsx` 446, `AdminDevOpsPage.tsx` 426, `FilmStage.ts` 420, `AdminErrorsPage.tsx` 403, `AdminAuditPage.tsx` 398, `InstallationPage.tsx` 375, `ShopCatalogPage.tsx` 371, `QuoteBuilder.tsx` 361 … | Mantiqiy komponentlarga bo‘lish (4-bosqich). |
| A-15 | testlar | test | **O** | Qamrov maqsaddan past (backend 68,8 % → 80; calc-engine 91,3 → 95; frontend 36,9). E2E yo‘q. Kalkulyator uchun “tayyor kirish → kutilgan chiqish” golden to‘plami yo‘q (faqat PVGIS solishtirish fiksturasi). `package.json` da `test:integration`, `test:e2e`, `test:all` yo‘q. | 5-bosqich. |
| A-16 | U21 reyestri | TZ moslik | **O** | Kodda topilmadi: SYS-05 cookie banneri, SYS-03 “Texnik ishlar”, AUTH-07 “Sessiya tugadi”, ADM-14 yuklama profillari, ADM-16 chek-list shablonlari (admin UI). | Har birini tasdiqlab, yetishmasini qo‘shish (2–3-bosqich). |
| A-17 | Huquqiy hujjatlar (seed) | kontent | **O** | Siyosat matnlari bir qatorli namunadan iborat (“Quyosh platformasidan foydalanish shartlari”). | Haqiqiy matn kerak — **sizdan**. |
| A-18 | `/maxfiylik` | UX | **P** | Maxfiylik havolasi umumiy ro‘yxatni ochadi, birinchi “Foydalanish shartlari” yoyilgan holda. | `/maxfiylik` da maxfiylik siyosatini yoyib ko‘rsatish. |
| A-19 | `apps/web/package.json` `dev:*` | tuzilma | **P** | Dev skriptlar GetMaster portlarida (5170–5175) — bu kompyuterda to‘qnashadi. | Quyosh portlariga o‘tkazish (yoki env orqali). |
| A-20 | jarayon | ops | **P** | Yangi paket qo‘shilganda pnpm `node_modules`ni qayta bog‘laydi va pm2 dagi Vite serverlar `ENOENT … refresh-runtime.js` bilan buziladi (shu audit paytida takrorlandi). | Paket o‘zgarganda `pm2 restart quyosh-{portal,customer,shop,admin}` — runbook’ga yozish. |
| A-21 | mobil 390 px: `/mijoz/uzilish` (497 px), `/admin/kontent/:id` (493), `/admin/yordam/:id` (445), `/admin/errorlar` (404) | UI / moslashuv | **O** | Sahifa ekrandan keng — gorizontal skroll/kichrayish. Jadval kesiladi: `/mijoz/hisoblar`, `/mijoz/takliflar/:id` (Birlik narx ustuni), `/admin/tariflar`. | Grid/jadvallarni mobil karta ko‘rinishiga; 360–1440 px tekshiruvi. |
| A-22 | `pages/calc/CalculationsPage.tsx:89` — `/mijoz/hisoblar/solishtirish` | bug / UX | **O** | `ids` bo‘lmasa (yoki < 2) “Kutilmagan xatolik yuz berdi.” chiqadi — so‘rov yuborilmaydi, `compare.error` bo‘sh. | Bo‘sh holat: “Solishtirish uchun kamida 2 ta hisob tanlang” + “Hisoblarimga” tugmasi; test. |
| A-23 | `pages/admin/AdminUserProfilePage.tsx:68` | bug / UX | **P** | URL’da raqam o‘rniga noto‘g‘ri qiymat (masalan UUID) bo‘lsa sahifa butunlay bo‘sh — na xato, na “topilmadi”. | “Foydalanuvchi topilmadi” holati. |
| A-24 | 404 sahifalari (barcha panellar), SYS-06 | UI | **O** | 404 — bo‘sh oq fonda kichik matn, panel qobig‘isiz. “Ruxsat yo‘q” sahifasi ko‘rinmaydi: mijoz `/admin` ga kirsa jim `/mijoz/bosh` ga qaytariladi. | Chiroyli 404/403 (illyustratsiya + “Bosh sahifaga”), U21 SYS-01/06. |
| A-25 | Admin panel matnlari: Foydalanuvchilar (“Mijozlar va ustalarni…”, “Ustalar (2)” tabi), Bildirishnomalar (“Tizim, buyurtma, to‘lov…”), Hisobotlar (“veb sessiyalar…”) | keraksiz (GetMaster) / mantiq | **Y** | Admin ro‘yxatida “Usta” roli/tabi va GetMaster tavsiflari ko‘rinadi (Quyoshda rollar: CUSTOMER/SHOP/ADMIN). | Tab va matnlarni Quyosh rollariga moslash (A-03 bilan birga). |
| A-26 | Mijoz bosh paneli | UI | **P** | “Ochiq so‘rovlar” bo‘sh bo‘lsa “—” chiqadi (empty state emas); KPI kartalar sodda; “kVt” va “kWh” aralash. | Empty state + amal tugmasi; birliklarni bir xil formatlash (A-05). |
| A-27 | Admin dashboard | UI | **P** | Faqat dashboard to‘q (neon) uslubda, qolgan admin sahifalari yorug‘ — o‘tishda keskin farq. | **Qaror kerak:** butun admin panelni to‘q mavzuga o‘tkazish yoki dashboardni umumiy mavzuga moslash. |
| A-28 | i18n / React Router | sifat | **P** | Har sahifada React Router v7 future-flag ogohlantirishi. | `v7_startTransition`, `v7_relativeSplatPath` flaglarini yoqish. |

## 3. Mendan kutilayotgan qarorlar

1. **Takroriy telefon (A-dublikat):** sizning talabingizda “takroriy STIR **yoki telefon** bloklanadi”. TZ 3.7.1 da: STIR — 409 bloklaydi, telefon — **ogohlantirish + tasdiq** (hozirgi kod shunday). Hujjat ustun bo‘lgani uchun o‘zgartirmayman — telefonni ham qat’iy bloklash kerakmi?
2. **A-06 “Namuna ko‘rinish”** (admin dashboard demo ma’lumoti): olib tashlaymi?
3. **A-27:** butun admin panel to‘q mavzumi yoki dashboard yorug‘ mavzugami?
4. **A-17:** foydalanish shartlari / maxfiylik siyosati matnlari — haqiqiy matnni berasizmi, yoki men loyiha qoidalari asosida qoralama yozaymi (siz tasdiqlaysiz)?
5. **Portlar:** talabdagi 5170–5175/3000 o‘rniga Quyosh portlari (5180/5183–5185/3100) bilan ishlashni davom ettiraman — `apps/web/package.json` `dev:*` skriptlarini ham shu portlarga o‘tkazaymi (A-19)?
6. **O‘chirish chegarasi:** `ru.extra.ts` dagi ≈ 1 800 ta GetMaster kaliti va A-09/A-10 ro‘yxatidagi fayllarni (har biri tekshirilgandan keyin) o‘chirishga ruxsat — ha/yo‘q?

## 4. Ijobiy holatlar (o‘zgartirish shart emas)

- Object-level ruxsatlar (IDOR) — 67 ta salbiy so‘rovning hammasi 403/404.
- State machine’lar TZ 13.1 / 3.7.3 ga to‘liq mos, alohida `*-state-machine.ts` fayllarda.
- Rate-limit (login, OTP, so‘rov, vidjet, geocoding), `mustPasswordChange` guard, prod’da OTP echo taqiqi, CORS ro‘yxati validatsiyasi bor.
- `/public/stats` va bosh sahifa raqamlari haqiqiy ma’lumotdan; ma’lumot bo‘lmasa blok yashiriladi.
- Panel ranglari (mijoz #2563EB, do‘kon #059669, admin #1E3A8A) va yorug‘/qorong‘i tokenlar TZ’ga mos.
- Barcha sahifalar xatosiz ochiladi (console error 0, network xato 0).
