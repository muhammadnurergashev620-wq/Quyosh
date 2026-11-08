# UI «perfect» — yakuniy hisobot

Branch: `ui/perfect` (asos: `main` 5d72ee8). Faqat UI qatlami o‘zgardi: API, biznes logika va backend fayllariga tegilmadi.
Har bo‘lim alohida commit; har biridan keyin typecheck, lint, unit test, build va skrinshot tekshiruvi o‘tkazildi.

## Commitlar

| Bo‘lim | Commit | Mazmuni |
|---|---|---|
| 0 | b373b08 | UI inventari (`docs/ui/INVENTORY.md`) |
| 1 | 7b36335, fec31a9 | Yagona komponentlar va tokenlar, ularga ko‘chirish, toast tizimi, `/dev/ui` |
| 2 | b5e4cdc | Bildirishnomalar: qo‘ng‘iroq paneli, sahifa, bannerlar |
| 3 | 7e8604f | Panel qobig‘i: yon panel, ⌘K, mobil navigatsiya, sahifa o‘tishi, 500 |
| 4 | 906c82c | Bosh sayt (landing) |
| 5 | 108b6ac | Kirish / ro‘yxatdan o‘tish |
| 6 | ff016d8 | Mijoz paneli |
| 7 | 50c5f11 | Do‘kon paneli |
| 8 | ca48f64 | Admin paneli (neon dashboard yagona tizimga) |
| 9 | (shu commit) | Yakuniy tozalash, a11y, lint 0, hisobot |

## Raqamlarda (main → ui/perfect, `apps/web/src`)

| Ko‘rsatkich | Oldin | Keyin |
|---|---:|---:|
| CSS’dagi xom HEX ranglar (tokens.css’dan tashqari) | 298 | **0** |
| CSS’dagi xom `rgba()` | 110 | **0** |
| `style={{…}}` (inline style) | 226 | 73 (faqat dinamik qiymatlar) |
| Xom `<button>` | 198 | 97 (murakkab boshqaruv elementlari) |
| Qo‘lda yozilgan `className="gm-button …"` | 51 | **0** |
| Komponentdan tashqari nativ `<select>` | 54 | **0** |
| ESLint ogohlantirishlari | 9 | **0** |
| Unit testlar | 170 | 174 |

## Bo‘limlar bo‘yicha

**1. Komponentlar.** `--qs-*` tokenlar kengaytirildi (info/violet/teal/pink, radius, dur-1..5, ease, ring, overlay). Button (8 variant, loading/success, ButtonLink/ButtonAnchor/ButtonGroup), Badge/StatusBadge, Chip, Tabs/TabBar (siljuvchi indikator, ←/→), SelectMenu (nativ select + maxsus ro‘yxat), StatCard (count-up, trend, sparkline), Card/ListItem/List/Meta, PageHeader, Progress/Stepper, Breadcrumb/Pagination, Tooltip, Alert, toast (navbat, pauza, swipe, undo). Namuna sahifa: `/dev/ui` (faqat dev).

**2. Bildirishnomalar.** Qo‘ng‘iroq: 99+ hisoblagich, yangi xabarda silkinish va toast. Panel: kompyuterda 400 px dropdown, mobilda pastdan sheet. Yorliqlar Hammasi · O‘qilmagan · Takliflar · Montaj · Tizim; guruhlar Bugun · Kecha · Shu hafta · Oldinroq; tur bo‘yicha rangli ikonka; o‘qilmaganlar qalin + nuqta; hover’da «O‘qilgan qilish»; aniq sana tooltipda. Sahifada ommaviy tanlash va belgilash (mavjud per-id API orqali). Kanal sozlamalari Switch bilan (Sozlamalar → Bildirishnoma kanallari, sahifadan havola). Bannerlar: OTP «Test rejimi» (katta kod + «Kodni qo‘yish»), to‘xtatilgan do‘kon («Administratorga yozish»), offline.

**3. Qobiq.** Yon panel: Mono guruh sarlavhalari, faol bo‘lim primary-soft + 3 px chiziq, hisoblagichlar, pastda foydalanuvchi kartasi, 72 px ga yig‘ish (eslab qolinadi, nomlar tooltipda). Header: blur, ⌘K / Ctrl+K buyruqlar oynasi (bo‘limlar + mavzu), avatar menyusi. Mobil: suzuvchi pastki panel 4 + «Ko‘proq» (guruhlangan sheet). Sahifa o‘tishida fade + 6 px. 404 / 403 / 500 bitta StatusPage’da.

**4. Landing.** Barcha ranglar `--qs-land-*` tokenlarida, asosiy CTA — `accent` (to‘q matn, kontrast to‘g‘ri), mobil header sig‘adi, shader fon bloklarni to‘liq qoplaydi.

**5. Auth.** Brend paneli va Google tugmasi (Google brend qoidalari) tokenlarda, barcha tugmalar yagona Button, checkbox 20 px kvadrat (radio’dan farq qiladi).

**6–7. Mijoz va do‘kon panellari.** Tugma-havolalar ButtonLink/ButtonAnchor, statik inline style’lar `qs-*` utility klasslariga, Murojaatlar ro‘yxati karta ko‘rinishida, do‘kon KPI’lari StatCard (ikonka + rang), xodimlar ro‘yxati ListItem kartasida.

**8. Admin.** Neon dashboard endi yorug‘/to‘q mavzuga bo‘ysunadi: KPI — StatCard (trend + sparkline), davr va ko‘rsatkich tanlovi — Tabs, grafik gradientlari tokenlardan, navbatlar StatCard’da. Admin sahifalaridagi o‘z palitrasi semantik tokenlarga almashtirildi.

**9. Yakuniy.** Qolgan xom ranglar tokenlarga; komponent bo‘lmagan eksportlar `*.helpers.ts` fayllarga (fast-refresh ogohlantirishlari 0); kontrast tuzatishlari (landing statement, auth hero belgisi).

## Tekshiruvlar

- `pnpm typecheck` ✓, `pnpm lint` ✓ (0 xato, 0 ogohlantirish), `pnpm test` ✓ (28 fayl, 174 test), `pnpm build` ✓.
- E2E (Playwright, lokal stend), barcha UI o‘zgarishlaridan keyin: mijoz ro‘yxatdan o‘tishi + kalkulyator ✓, admin do‘kon yaratadi ✓, do‘kon vaqtincha parol bilan kirib parolni almashtiradi ✓, salbiy yo‘llar ✓. OTP helper yangi «Test rejimi» banneriga moslandi (`tests/e2e/helpers.ts`). Ketma-ket qayta yugurishlarda admin–do‘kon testi muhit sababli to‘xtadi: login rate-limit (5 daqiqa) va admin akkauntida faol qurilmalar chegarasi (10 ta). Bu UI xatosi emas; lokal bazadagi eski e2e sessiyalarini tozalash uchun ruxsatingiz kerak.
- Lighthouse (production build, `vite preview`):

| Sahifa | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| Bosh sayt, mobil | 71 | 100 (oldin 95) | 96 | 100 |
| Bosh sayt, desktop | 91–97 | 100 (oldin 95) | 96 | 100 |
| Mijoz login, mobil | 75–76 | 100 (oldin 96) | 100 | 100 |

- Skrinshotlar: `docs/ui/after/s2 … s8` (1440 / 390 px, yorug‘ / to‘q). `docs/ui/before` va `docs/ui/after` `.gitignore`da — repoga kirmaydi.

## Ataylab qoldirilganlar

- **73 inline style** — faqat dinamik qiymatlar (foiz kengliklar, `--value` kabi CSS o‘zgaruvchilar, hisoblangan o‘lchamlar).
- **97 xom `<button>`** — murakkab elementlar: variant kartalari, akkordeon, stepper, xarita asboblari, chat, avatar muharriri, chip’ni olib tashlash. Ular Button ko‘rinishiga mos emas, o‘z stillari bor.
- **TSX’dagi HEX** — faqat brend logotiplari (Google, Telegram va boshqalar), logotip quyoshi va MapLibre poligon ranglari (MapLibre CSS o‘zgaruvchini qabul qilmaydi).
- **Bosh sayt mobil performance 71** — asosiy sabab TBT (shader va film skriptlari). Birinchi ekran statik; keyingi qadam — shader’ni birinchi o‘zaro ta’sirgacha kechiktirish.
- **«Parolni almashtiring» banneri** qo‘shilmadi: vaqtincha parolli foydalanuvchi allaqachon majburiy parol almashtirish sahifasiga yo‘naltiriladi (`mustPasswordChange`).
- **~414 ishlatilmayotgan CSS klass** (GetMaster qoldiqlari: Profile.css, cards.css, compact.css …) — alohida tozalash commitida olib tashlash tavsiya etiladi.

## Sizdan qaror kerak

1. **Bildirishnomani o‘chirish** — backend’da endpoint yo‘q, shuning uchun «O‘chirish» tugmasi qo‘yilmadi. Endpoint qo‘shilsinmi?
2. **Ishlatilmayotgan CSS’ni tozalash** — alohida commit sifatida qilinsinmi?
3. **`ui/perfect` ni `main` ga birlashtirish va push** — ruxsat berasizmi?
