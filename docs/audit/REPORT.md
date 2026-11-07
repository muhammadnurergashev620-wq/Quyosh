# Quyosh — to‘liq audit: yakuniy hisobot

Branch: `fix/full-audit` (main’dan 19 commit, 271 fayl: +3 296 / −6 780 qator). Push qilinmagan.
Topilmalar ID’lari — [AUDIT.md](AUDIT.md). Lokal stend portlari: bosh sayt 5180, mijoz 5183, do‘kon 5184, admin 5185, API 3100.

## 1. Natijalar — oldin / keyin

| Ko‘rsatkich | Oldin (0-bosqich) | Keyin |
|---|---|---|
| Backend testlari (`pnpm test`) | 240 | **308** |
| Backend unit (`pnpm test:unit`) | 148 | **189** |
| Frontend testlari | 138 | **170** |
| E2E (Playwright) | yo‘q | **7** (hammasi o‘tadi) |
| Backend qamrovi (`src/`, qatorlar) | 68,8 % | **74,0 %** |
| calc-engine qamrovi | 91,3 % | **97,6 %** |
| Frontend qamrovi | 36,9 % | **33,0 %** ¹ |
| Asosiy JS bo‘lagi (gzip) | 628 KB | **100 KB** |
| Jami JS (gzip, panel) | 1 228 KB | 1 174 KB (lug‘atlar endi til bo‘yicha alohida) |
| Console xato / ogohlantirish (184 sahifa) | 0 / 184+ | **0 / 0** (faqat MapLibre va headless WebGL xabarlari) |
| 4xx/5xx (184 sahifa) | 0 | 0 |
| Mobil 390 px da gorizontal toshish | 4 sahifa | **0** |
| ru/en tarjimasi yo‘q kalitlar | 114 / 10 | **0 / 0** (test bilan himoyalangan) |
| typecheck / lint / build | toza | toza |

¹ Frontend foizi pasaygani — o‘lchov effekti: avval ru/en lug‘atlari (≈ 2 400 qator) har testda statik import qilinib “qamralgan” hisoblanardi; endi ular dinamik yuklanadi. Yangi testlar (format, Button, validatsiya, RoleGuard, i18n) qo‘shilgan, test soni 138 → 170.

## 2. Tuzatilgan topilmalar (AUDIT.md ID’lari)

**Xavfsizlik va yaxlitlik (1-bosqich)**
- **A-01** `Idempotency-Key` (TZ 9.4) majburiy: `POST /quote-requests`, `/quote-requests/:id/quotes`, `/quotes/:id/send`, `/calculations/:id/report`; kod `IDEMPOTENCY_CONFLICT`; frontend har forma uchun barqaror kalit yuboradi. Parallel ikki bosish → bitta yozuv (test).
- **A-04** `CERTIFICATE` / `VERIFICATION_DOC` media turlarini faqat admin yuklaydi.
- **Takroriy do‘kon telefoni** — buyurtmachi qarori: 409 `SHOP_PHONE_TAKEN` (yaratishda va profilda telefon o‘zgartirilganda); `confirmDuplicates` olib tashlandi.
- Xato jurnali va log’larga URL query (`sig`, `expires`) va share/widget tokenlari yozilmaydi.
- Pul maydonlariga yuqori chegara (≤ 10¹² so‘m) — juda katta qiymat 400, 500 emas.
- Tekshirildi va to‘g‘ri: object-level ruxsatlar (67 ta salbiy so‘rov), status o‘tishlari (shartli `updateMany`), `mustPasswordChange` guard, prod’da OTP echo taqiqi, rate-limit, CORS.

**Mantiq (2-bosqich)**
- **A-05** Yagona `lib/format.ts`: kasr vergul bilan («22 %», «4,6», «6,6 kVt»), «1 250 000 so‘m», sana Asia/Tashkent; 30+ qo‘lda `toFixed/toLocaleString` olib tashlandi.
- **A-06** Admin dashboard “Namuna ko‘rinish” (soxta raqamlar) olib tashlandi.
- **A-07** To‘xtatilgan do‘kon — barcha kabinet sahifalarida “faqat o‘qish” banneri.
- **A-22 / A-23** Solishtirish va foydalanuvchi sahifasida bo‘sh/“topilmadi” holati (avval “Kutilmagan xatolik” / bo‘sh ekran).
- Kalkulyator: TZ 11 formulalari bo‘yicha 21 golden holat + chegaraviy kirishlar (hammasi mos — dvigatelda xato topilmadi).
- Kredit kalkulyatori: minimal boshlang‘ich to‘lov oldindan ko‘rsatiladi, “Eng kam summani qo‘yish”, summalar minglik ajratgich bilan.
- **A-17** Huquqiy matnlar qoralamasi (`prisma/legal/*.uz.md`); lokal bazada 1.1 versiya DRAFT.

**UI/UX (3-bosqich)**
- **A-03, A-25** Foydalanuvchiga ko‘rinadigan GetMaster matnlari (usta, buyurtma, to‘lov, “Ustalar” tabi, maydon nomlari) Quyosh atamalariga almashtirildi; audit jurnali yorliqlari Quyosh amallariga moslandi.
- **A-24** 404 va 403 (“Ruxsat yo‘q”) sahifalari: illyustratsiya, kod, izoh, bosh sahifaga tugma; noto‘g‘ri rol endi jim yo‘naltirilmaydi.
- **A-27** Admin paneli standart holatda to‘q mavzuda (foydalanuvchi tanlovi ustun).
- **A-28** React Router v7 flaglari — 184 sahifadagi console ogohlantirishi yo‘q.
- Button: radius 12, `:active` scale 0,98, focus-visible halqa, disabled 0,5, loading’da kenglik o‘zgarmaydi, `iconOnly`, strelka hover’da 2 px, ikonka 18 px; mobilda forma tugmalari to‘liq kenglik ≥ 44 px.
- Bug: `--qs-focus-ring` (rang) `box-shadow` sifatida ishlatilgan — 7 joyda fokus halqasi ko‘rinmas edi.
- InfoTip: kVt, kWh, invertor, oylik tejash, narx, payback.
- **A-21** Mobil toshishlar (uzilish, kontent tahriri, murojaat, xatolar), jadvallar karta ichida aylanadi; inline grid → CSS klass.
- **A-08** 190 ta yetishmagan ru/en tarjima + `i18n/coverage.spec.ts`.

**Tuzilma va tozalash (4-bosqich)** — 4-bo‘limdagi ro‘yxat.
- Bug: admin “Siyosatlar” formasida backend qabul qilmaydigan 5 tur (oferta, to‘lov, qaytarish…) — 400 berardi; Sozlamalar → “Ommaviy oferta” mavjud bo‘lmagan hujjatni so‘rardi.
- **A-12** `/mijoz/montaj/:id` → `/mijoz/montajlar/:id`.
- `.env.example`: `REFRESH_TOKEN_TTL_DAYS` kod o‘qimaydigan kalit edi → `REFRESH_TOKEN_TTL_MINUTES`; standart sessiya muddati 60 daqiqadan 30 kunga (buyurtmachi qarori).

**Unumdorlik (A-02)**
- Lug‘atlar til bo‘yicha dinamik (o‘zbek tilida umuman yuklanmaydi); bosh sahifa (GSAP, Lenis, Three.js) panellar bundle’iga tushardi — lazy. Asosiy bo‘lak 628 → 100 KB gzip.

## 3. O‘chirilgan fayllar

Har biri `grep` + `knip` + `tsc` + build bilan tekshirilgan.

- **Frontend (33):** `components/common/LoadingScreen.{tsx,css}`, `components/media/ScrollVideo.{tsx,css}`, `components/ui/Pagination.{tsx,css}`, `features/admin/components/{AdminSearch,DateRangeFilter,PeriodPill}.{tsx,css}`, `features/admin/components/{MiniChart,StatGrid,UserNumberField,UserRef}.tsx`, `features/admin/range.ts`, `features/admin/dashboard/demo.ts`, `features/media/components/{CompareSlider,MediaViewer}.{tsx,css}`, `features/media/file-info.ts`, `features/profile/{ProfileCard,ProfileHero}.tsx`, `features/session/components/GoogleLinkSettings.tsx`, `hooks/{useCountdown,usePagination}.ts`, `lib/labels.ts`, `pages/landing/fx/interactions.ts`, `services/{auth.client,storage.service}.ts`, `apps/web/scripts/serve-dist.mjs`.
- **Frontend assetlar:** `public/voice/uz/*.mp3` (29 fayl, 452 KB — GetMaster navigatsiya ovozlari).
- **Backend (7):** `src/common/constants/app.constants.ts`, `src/common/enum/index.ts`, `src/common/utils/{format-date,phone-gate}.ts`, `scripts/{build,seed,test}.ts`.
- **Kod ichida:** 51 ta ishlatilmaydigan frontend eksporti; 175 ta GetMaster xato kodi; 16 ta exception klassi; admin audit xabarnomasidagi 56 ta amal; audit jurnali yorliqlaridagi 67 ta amal; i18n’dagi 2 903 ta o‘lik kalit (lug‘atlar 755 → 503 KB).
- **Paketlar:** `@capacitor/android`, `@capacitor/cli` (capacitor config yo‘q), `leaflet`, `@types/leaflet`.
- **Qo‘shilgan paketlar (dev):** `@vitest/coverage-v8`, `@playwright/test`.

## 4. UI: oldin / keyin skrinshotlar

`docs/audit/before/<panel>/<sahifa>[-390].png` va `docs/audit/after/…` — 92 marshrut × 1440/390 px (lokal, git’ga qo‘shilmagan).
Asosiy juftliklar: `admin/bosh` (yorug‘ → to‘q), `*/404`, `customer/ruxsat-yoq` (jim yo‘naltirish → 403 sahifasi), `customer/hisoblar-solishtirish` (xato → bo‘sh holat), `admin/foydalanuvchi` (bo‘sh → profil), `customer/uzilish-390`, `admin/kontent-item-390`, `admin/yordam-ticket-390` (keng → moslashgan), `customer/bosh` (“—” → bo‘sh holat), `customer/kredit` (22.0 % → 22 %, minglik ajratgich), `customer/natija` (InfoTip), `admin/foydalanuvchilar` (“Ustalar” → “Do‘kon xodimlari”).

## 5. Testlar

- **Yangi:** idempotentlik (5), xavfsizlik/yaxlitlik (7), admin va do‘kon kabineti ruxsat matritsalari (8 — controller’lardan avtomatik yig‘iladi), kalkulyator golden (23) + moliya/yuklama (12) + chegaraviy API (7), state machine to‘liq jadvali (5 — har bir dan×ga×aktor), format (6), Button (13), validatsiya (12), i18n qamrovi (3), RoleGuard 403 (2), E2E (7).
- **Skriptlar:** `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `test:all`.
- **E2E:** admin do‘kon yaratadi → vaqtincha parol bir marta → do‘kon kiradi → parolni almashtiradi; mijoz ekrandagi OTP bilan ro‘yxatdan o‘tadi → Tez hisob → natija → saqlash; noto‘g‘ri OTP; mijoz admin paneliga kira olmaydi; ko‘p xato login → 429; begona do‘kon so‘rovi → 403/404. Taklif → montaj → tasdiq → sharh oqimi API darajasida `tests/integration/m6-quotes.spec.ts` da.

## 6. Lighthouse (mobil, production build, `vite preview`)

| Sahifa | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Bosh sayt `/` | **74–77** (oldin 42; maqsad 85) | 95 | 96 | 100 |
| Mijoz paneli `/login` | **81** (maqsad 80) | 96 | 100 | 100 |

Bosh sayt: 42 → **74–77** (LCP 6,2 → 2,1 s, TBT 6,6 → 0,9–1,1 s, CLS 0). Qilingan ishlar (buyurtmachi qarori №1):
- Birinchi ekranda CSS poster; Three.js film, GSAP, shader foni va Lenis faqat birinchi skroll/teginish/klavishda dinamik yuklanadi (joylashuv bir xil — sakrash yo‘q).
- Bosh sayt build’ida `index.html` ichida statik birinchi ekran (logo, sarlavha, CTA) — JS’ni kutmasdan chiziladi; React uni almashtiradi.
- Bosh sahifa bo‘lagi App bilan parallel yuklanadi.
85 ga yetmagan qism — TBT: brauzerning hujjatni qayta ishlashi (~1 s) va React’ning birinchi render’i (~0,7 s, headless Chrome 4× CPU sekinlashtirishda). Keyingi qadam — to‘liq SSR/prerender (Render build’ida Chromium kerak bo‘ladi).

## 7. Hal qilinmay qolganlar

- **UI tokenlari (A-13):** CSS’da 364 ta xom HEX, TS’da 56, 226 ta inline `style`, 198 ta xom `<button>` (chip/tab/qator elementlari ko‘p). Eng xavflilari tuzatildi (grid inline style media query’ni bosib ketgani — A-21), qolganini bosqichma-bosqich `--qs-*` tokenlariga o‘tkazish kerak.
- **300 qatordan uzun fayllar (A-14):** 18 ta (`AdminAdminsPage.tsx` 554 …) — bo‘linmagan.
- **Qamrov:** backend 74,0 % (maqsad 80 %): `auth` 36 %, `audit` 24 %, `avatar` 30 %, `legal` 34 %, `notification` 48 %, `admin` 54 % past; frontend 33,0 %.
- **U21 dagi ekranlar (A-16):** cookie banneri (SYS-05), “Texnik ishlar” (SYS-03), “Sessiya tugadi” (AUTH-07), yuklama profillari (ADM-14), chek-list shablonlari admin UI (ADM-16) — qo‘shilmagan.
- Skeleton yuklanishlar, breadcrumb, kartalar stagger animatsiyasi, raqam sanalishi — qilinmagan.
- Backend’da 39 ta `../../../` importi (backend’da path alias sozlanmagan).
- CI’ga E2E qo‘shilmagan (ishlab turgan stend kerak).
- E2E har ishga tushganda lokal bazada test do‘koni (`E2E Quyosh …`) va test mijozi yaratadi — hozir 2 ta do‘kon; kerak bo‘lsa admin panelidan to‘xtatiladi.

## 8. Mendan kutilayotgan qarorlar

Hal qilindi (buyurtmachi “ha”):
1. Bosh sahifa filmi — scroll’da yuklanadi, birinchi ekranda poster (§6).
2. Sessiya muddati — 30 kun, sliding (`REFRESH_TOKEN_TTL_MINUTES` standart 43 200).
3. `fix/full-audit` → `main` birlashtirildi va push qilindi.

Qolgan:
- Huquqiy matnlar qoralamasini (admin → Siyosatlar → 1.1 DRAFT) yurist ko‘rigidan keyin e’lon qilish.
- Bosh sayt Lighthouse 85 uchun to‘liq SSR/prerender kerakmi.

## 9. TZ’dan chetga chiqishlar

- **3.7.1** Takroriy do‘kon telefoni: TZ — ogohlantirish va tasdiq; endi — 409 `SHOP_PHONE_TAKEN` (buyurtmachi qarori). TZ matni yangilandi.
- **18 (env ro‘yxati):** `MAP_QUOTA_WARN_PERCENT`, `GEOCODING_PROVIDER`, `SOLAR_PRIMARY_PROVIDER`, `SOLAR_FALLBACK_PROVIDER`, `EXCHANGE_RATE_SOURCE_URL`, `PROMETHEUS_URL`, `ALERTMANAGER_WEBHOOK_SECRET`, `DEPLOY_WEBHOOK_SECRET` kodda o‘qilmaydi — `.env.example` dan olib tashlandi (webhooklar `OPS_WEBHOOK_SECRET` bilan ishlaydi).
- Admin paneli standart to‘q mavzu (buyurtmachi qarori; TZ U2 da standart — yorug‘).
- Bildirishnoma toifalari `PAYMENT`/`POST` → `SHOP`/`CONTENT` (obuna/to‘lov yo‘q).

## 10. Kirish ma’lumotlari va ishga tushirish

- **Admin:** admin paneli (5185) — login `admin`, parol `.env` dagi `ADMIN_PASSWORD`.
- **Do‘kon:** do‘kon paneli (5184) — admin yaratgan login + vaqtincha parol (masalan, `sinov.dokon`); birinchi kirishda parol almashtiriladi.
- **Mijoz:** mijoz paneli (5183) — telefon + parol + OTP (dev rejimda kod ekranda). Demo mijoz: `+998900000098`.

```bash
scripts/quyosh-db.sh start && pm2 resurrect          # Postgres + barcha servislar
pnpm build && pm2 restart quyosh-api                  # backend o‘zgargach
pnpm typecheck && pnpm lint && pnpm test              # backend
npm --prefix apps/web run typecheck && npm --prefix apps/web run lint && npm --prefix apps/web test && npm --prefix apps/web run build
ADMIN_PASSWORD=… pnpm test:e2e                        # E2E (ishlab turgan stend ustida)
```
