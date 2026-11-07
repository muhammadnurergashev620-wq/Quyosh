# UI inventari (0-bo‘lim)

Sana: 2026-11-07 · Branch: `ui/polish` · Kod o‘zgartirilmagan.
Before-skrinshotlar: `docs/ui/before/<panel>/<sahifa>[-390][-dark].png` — 92 marshrut × 1440/390 px × yorug‘/qorong‘i = **368 ta** (45 MB, git’ga qo‘shilmaydi).
Holat: console error 0, 4xx/5xx 0, mobil 390 px da gorizontal toshish 0 (oldingi audit natijasi saqlangan).
Lokal portlar: bosh sayt 5180, mijoz 5183, do‘kon 5184, admin 5185 (talabdagi 5170–5175 — GetMaster’niki).

## 1. Raqamlar (umumiy)

| Element | Hozir | Izoh |
|---|---|---|
| Xom `<button>` (komponentdan tashqarida) | **198** (76 fayl) | 92 tasi `cx(...)` bilan qo‘lda uslublangan: chip, tab, ro‘yxat qatori, segment, yopish ×. Eng ko‘p: AdminErrorsPage 15, DetailedCalcPage 14, AdminNotificationsPage 12, AdminAuditPage 11, AdminAdminsPage 10, QuickCalcPage 9, AdminUsersPage 9 |
| `<Button>` komponenti | 405 | variantlar: primary, secondary, ghost, danger, accent; `soft`, `danger-soft`, `link`, `success` holati, `leftIcon/rightIcon`, `ButtonGroup` **yo‘q** |
| Havola-tugma (`<a className="gm-button …">`) | ~20 | Button bilan bir xil ko‘rinish, lekin komponent emas |
| Nativ checkbox | **45** (32 fayl) | `Checkbox` komponenti bor, lekin 1 joyda ishlatiladi |
| Nativ radio / file | 1 / 7 | file — `MediaUploadField` dan tashqari 6 joyda xom `<input type="file">` |
| Nativ `<select>` | **55** (21 fayl) | `Select` komponenti 37 joyda; qolganlari filtr va jadval ichidagi xom select |
| Xom `<input>` / `<textarea>` | 50 / 2 | asosan filtr, qidiruv va jadval ichidagi kichik maydonlar (`qs-input-sm`) |
| `window.prompt` | **1** | `AdminTariffsPage` — tarif tugash sanasi (`alert/confirm` yo‘q) |
| Jadvallar | 37 | 25 ta `qs-table`, 7 ta klasssiz `<table>`, 1 ta `qs-specs`, 1 ta `gm-notif-prefs__table`; sticky sarlavha yo‘q, mobil karta ko‘rinishi yo‘q (gorizontal aylanadi) |
| Inline `style={{}}` | **223** (63 fayl) | |
| Xom HEX | TS/TSX’da 44, CSS’da 364 (tokens.css’dan tashqari) | |
| Ishlatilmaydigan CSS klasslar | **≈ 414 / 1 649** | `features/profile/Profile.css` 75/82, `styles/cards.css` 72/89, `styles/compact.css` 48/80, `styles/global.css` 43/59, `styles/premium.css` 29/64 — asosan GetMaster qoldig‘i (`gm-order-card`, `gm-opaycard`, `gm-pausecard`, `gm-pcard`, `gm-cred-card`, `gm-user-card` …) |
| Toast | 119 chaqiruv (`pushToast`) | 3 variant (success/error/info), bitta matn, ✕ belgisi matn sifatida; sarlavha/izoh, ikonka, progress, hover-pauza, navbat chegarasi, undo, promise, swipe, warning varianti **yo‘q**; error ham 5 s da yopiladi |
| Sahifa ichidagi success xabarlari | 24 ta `Alert tone="success"` + 19 faylda `setSaved` | bir xil amal ba’zan toast, ba’zan inline alert |
| `Alert` | 267 | 3 px chiziq yo‘q, amal tugmasi va × yo‘q |
| `Badge` | 175 | 5 ton (neutral/primary/success/warning/danger), ikonka va `info` toni yo‘q; `StatusBadge` yo‘q — statuslar `features/deals/labels.ts` dagi `REQUEST_STATUS`, `QUOTE_STATUS`, `INSTALLATION_STATUS`, `LEAD_STATUS`, `SHOP_REPLY_STATUS` + `SHOP_STATUS` dan qo‘lda `<Badge tone>` |
| Chip | `qs-chip` (24), `gm-chip` (1) | ikki xil uslub; tanlanganda ✓ yo‘q; olib tashlanadigan chip yo‘q |
| KPI kartalari | **8 xil klass**: `qs-kpi`, `qs-kpis`, `qs-calc-kpis`, `gm-dkpi`, `gm-ukpi`, `nd-kpi`, `qs-kpi-grid`, admin `gm-ukpi--btn` | ikonka-quti, birlik, trend, sparkline, skeleton — sahifadan sahifaga farq qiladi |
| Kartalar | `qs-card` + 20 dan ortiq maxsus karta klasslari | variantlar (muted, outline, highlight, dark), sarlavha qatori (ikonka-quti + sarlavha + amal) yagona emas |
| Tablar / segment | `qs-tabs` (18), `qs-segment` (10), `qs-seg` (1), admin `gm-ul__tabs` | 3–4 xil ko‘rinish, siljiydigan indikator yo‘q |
| Drawer’lar | 5 ta alohida (`UserDrawer`, `AdminDrawer`, `AuditDrawer`, `ErrorDrawer`, `AdminNotificationDrawer`) | umumiy `Drawer` komponenti yo‘q |
| Modal / Dialog / ConfirmDialog | 52 / 1 / 16 | `Dialog` va `Modal` ikki xil komponent |
| Skeleton | 4 joyda | sahifa yuklanishi 103 joyda `PageLoader` (spinner) |
| EmptyState | 46 | 6 joyda quruq “Ma’lumot yo‘q / Hozircha yo‘q” matni |
| InfoTip | 6 | tooltip strelkasiz, kechikishsiz |
| Avatar | `UserAvatar` (40) | gradient fon bor; o‘lchamlar va onlayn nuqta tekshiriladi |

## 2. Tokenlar (`styles/tokens.css`) — U2 bilan farq

Bor: bg, surface, surface-muted, border, border-strong, text, text-muted, ink, accent, primary (+hover, soft, contrast), success/warning/danger (+bg), info-bg, radius sm–2xl, space 1–10, shadow sm/md/lg, font display/sans/mono, bitta `--qs-ease`, panel ranglari (mijoz #2563EB, do‘kon #059669, admin #1E3A8A) yorug‘ va qorong‘i.
**Yo‘q:** `--qs-color-info`, `*-border` variantlari, `primary-active`, `primary-ring`, `shadow-xs`, `primary-glow`, radius 999 (pill), space 20/40/48/64 nomlari, motion davomiyliklari (90/160/260/480/900), `ease-out` / `ease-in`, yagona focus halqasi tokeni (`--qs-focus-ring` hozir rang, halqa emas).

## 3. Sahifalar bo‘yicha kuzatuvlar (skrinshotlardan)

**Umumiy qobiq**
- Sidebar: faol element primary-soft fon, lekin chapda 3 px chiziq yo‘q; hisoblagich badge faqat admin “Bildirishnomalar”da; pastda foydalanuvchi kartasi va yig‘ish (72 px) rejimi yo‘q; guruh sarlavhalari Inter (Mono emas).
- Header: qidiruv faqat admin’da (⌘K yo‘q); qo‘ng‘iroq — dropdown panel emas, `/bildirishnomalar` ga havola; yangi bildirishnomada animatsiya yo‘q.
- Mobil pastki menyu: 6 element (Kalkulyator, Hisoblar, So‘rovlar, Tizim, Profil, Yana) — talab 4 + “Ko‘proq”; faol nuqta yo‘q.
- Sahifa sarlavhalari: ba’zilari markazda (Bildirishnomalar, Sozlamalar), ko‘pchiligi chapda; eyebrow yo‘q; H1 o‘lchami 24–32 px oralig‘ida farq qiladi.
- Sahifa o‘tishi animatsiyasi yo‘q; kartalar stagger yo‘q; raqamlar sanalmaydi.

**Bildirishnomalar** (`/bildirishnomalar`, admin `/admin/…/bildirishnomalar`)
- Tablar faqat “Hammasi / O‘qilmagan” (Takliflar, Tizim yo‘q); guruh faqat sana (“31 OKTABR”), “Bugun / Kecha / Shu hafta” yo‘q.
- Hamma ikonka bir xil (primary-soft) — tur bo‘yicha rang yo‘q; o‘qilgan/o‘qilmagan farqi deyarli ko‘rinmaydi (nuqta va fon yo‘q); hover’da “o‘qilgan qilish / o‘chirish” yo‘q; ommaviy tanlash yo‘q.
- “Hammasini o‘qilgan deb belgilash” — kichik outline tugma, sarlavha markazda.

**Mijoz paneli**
- Bosh panel: KPI kartalar (Quvvat, Bu oy prognozi) ikonkasiz, trendsiz; “Oxirgi hisoblar” — havola + kulrang matn qatori (ro‘yxat-karta emas).
- Kalkulyator (Tez/Batafsil): segment va chip’lar 2 xil uslub; qadamlar ko‘rsatkichi — oddiy matn tablar (✓ va halqa yo‘q); “Natija hali yo‘q” — quruq matn.
- Natija: KPI’lar yaxshi (InfoTip bor), grafiklarda “Jadval” tugmasi bor; PDF/Ulashish tugmalari secondary, bir xil emas.
- Hisoblar, So‘rovlar, Montajlar: ro‘yxatlar `qs-table` yoki oddiy qatorlar; mobilda jadval gorizontal aylanadi (karta emas); checkbox nativ.
- Mahsulot sahifasi: rasm o‘rnida katta kulrang “grid” ikonka (placeholder), xususiyatlar jadvali sodda.
- Chat: bo‘sh o‘ng panel “Chap tomondan suhbatni tanlang” — EmptyState emas.
- Kredit: summa maydonlari yaxshi; mahsulot tanlash — xom `button` kartalar.
- Profil / Sozlamalar: menyu qatorlari yaxshi; “Tizimdan chiqish” qizil matn qatori (danger tugma emas).

**Do‘kon paneli**
- Bosh panel: 7 ta KPI — 6 tasi qatorda, 7-si yolg‘iz yangi qatorda; ikonka, birlik, trend yo‘q; “Ko‘rsatkichlar” ichida yana KPI qutilar (ikki xil KPI uslubi bir sahifada); profil chek-listida bajarilganlar ustidan chizilgan + tagi chizilgan havola; “Tezkor amallar” — 4 ta bir xil secondary tugma.
- So‘rovlar: filtr chip’lari, pipeline ustunlari — chip va badge uslubi turlicha.
- Katalog: jadvalda xom select va kichik input’lar, nativ checkbox.
- Vidjet, Portfolio, Filiallar: bo‘sh holatlar bor, lekin turli o‘lchamda.

**Admin paneli** (to‘q mavzu)
- Foydalanuvchilar / Adminlar / Audit / Xatolar: o‘z `gm-ukpi` kartalari, o‘z filtr paneli (`gm-ul`), o‘z tablar; drawer’lar har sahifada alohida; jadvallarda nativ checkbox va select.
- Dashboard: `nd-*` neon uslub (alohida dizayn tili) — qolgan admin sahifalari bilan bir xil emas.
- Tariflar: “Tugash sanasi” — `window.prompt`.
- DevOps, Hisobotlar: grafiklar o‘zining mini-kutubxonasi (`DevOpsCharts`), legenda/tooltip uslubi dashboard’dan farq qiladi.

**Bosh sayt va kirish sahifalari**
- Bosh sayt: poster + film (avvalgi ishda tayyorlangan), CTA’lar primary/accent.
- Kirish/Ro‘yxatdan o‘tish: split-screen bor (shader fon), OTP 6 katak + paste bor; parol ko‘rsatish tugmasi bor.

## 4. Bir xil narsa — turli ko‘rinish (birlashtirish kerak)

1. **KPI kartalari** — 8 klass (yuqorida).
2. **Tablar/segment** — `qs-tabs`, `qs-segment`, `qs-seg`, admin tablar.
3. **Chip** — `qs-chip` va `gm-chip`.
4. **Drawer** — 5 ta alohida.
5. **Modal** — `Modal` va `Dialog`.
6. **Success xabari** — toast va inline `Alert` aralash.
7. **Havola-tugma** — `<a className="gm-button…">` va `<Button>`.
8. **Jadval** — `qs-table`, klasssiz, `gm-ul__table`, `qs-specs`.
9. **Grafiklar** — `features/calc/charts.tsx`, `features/admin/dashboard/charts.tsx`, `DevOpsCharts`.

## 5. Tushunarsiz yoki sodda joylar

- Do‘kon profil chek-listi (chizilgan havolalar), 7-KPI yolg‘iz qatorda.
- Mahsulot rasmi placeholder (katta ikonka).
- Chat bo‘sh paneli, “Natija hali yo‘q”, 6 ta quruq “Ma’lumot yo‘q”.
- Bildirishnomalarda turlar farqlanmaydi.
- Tariflarda `window.prompt` sana kiritish.
- Admin dashboard (neon) va qolgan admin sahifalari ikki xil dizayn tili.

## 6. Reja va hajm (tasdiq uchun)

Bo‘limlar 1–8 talab bo‘yicha ketma-ket. Hajm katta; ustuvorlik va chegaralar:
1. **Tokenlar** — to‘liq (yuqoridagi yetishmaganlar), xom HEX’larni tokenlarga — eng ko‘p uchraydigan fayllardan boshlab.
2. **Button** — yangi variantlar (soft, danger-soft, link, icon), `leftIcon/rightIcon`, `success` holati, `ButtonGroup`, havola-tugma (`ButtonLink`); 198 xom `<button>` ni komponentlarga ko‘chirish: oddiy tugmalar → `Button`, chip/tab/segment/ro‘yxat qatori → mos yangi komponentlar (`Chip`, `Tabs`, `Segmented`, `ListRow`, `IconButton`).
3. **Kichik elementlar** — `Card`, `StatCard` (yagona KPI), `StatusBadge`, `Chip`, `ListRow`, `EmptyState`, `Skeleton` to‘plami, `Checkbox/Radio/Switch`, maxsus `Select`, `FileInput`, `Tooltip`, `Drawer`, `Table` (sticky, mobil karta), `Tabs/Segmented`, `Stepper`; `window.prompt` → dialog.
4. **Bildirishnomalar** — yangi Toast tizimi (navbat ≤ 3, progress, pauza, undo, promise, swipe, aria-live), qo‘ng‘iroq dropdown paneli, sahifa (tablar, guruhlar, tur ranglari, ommaviy amal), inline Banner.
5. **Sahifalar** — sarlavha qolipi, holatlar, sidebar (3 px chiziq, foydalanuvchi kartasi, yig‘ish), header, mobil menyu 4 + “Ko‘proq”, 404/403/500.
6. **Harakat** — sahifa o‘tishi, stagger, raqam aylanishi, accordion, dropdown; reduced-motion.
7–8. **A11y va testlar** — axe-core, Playwright vizual baseline, komponent testlari, yakuniy grep, REPORT.md.

Eslatmalar:
- Ishlatilmaydigan ≈ 414 CSS klassni (GetMaster) 5-bo‘limda tozalayman.
- “Faqat ko‘rinish” qoidasi: API, ma’lumot oqimi va biznes logikaga tegilmaydi. Bildirishnomalar panelidagi “o‘chirish” uchun backend endpoint bo‘lmasa, tugma qo‘shilmaydi (faqat “o‘qilgan qilish”).
- `/dev/ui` sahifasi faqat dev rejimida (production build’ga tushmaydi).

## Ilova: fayllar bo‘yicha jadval

| Fayl | `<button>` | checkbox | radio | file | `<select>` | `<input>` | `<textarea>` | `<table>` | inline style | HEX | prompt/confirm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pages/admin/AdminErrorsPage.tsx` | 15 | 2 |  |  | 4 | 3 |  | 1 | 4 |  |  |
| `pages/calc/DetailedCalcPage.tsx` | 15 | 1 |  |  | 1 | 3 |  |  | 6 | 1 |  |
| `pages/m7/ShopM7Pages.tsx` | 4 | 3 |  | 1 | 3 | 3 |  | 1 | 10 | 1 |  |
| `pages/m7/AdminM7Pages.tsx` | 3 | 1 |  |  | 10 | 3 |  | 3 | 4 |  |  |
| `pages/admin/AdminAuditPage.tsx` | 11 | 2 |  |  | 5 | 4 |  | 1 |  |  |  |
| `pages/admin/AdminNotificationsPage.tsx` | 12 | 2 |  |  | 4 | 3 |  | 1 |  |  |  |
| `pages/admin/AdminAdminsPage.tsx` | 10 | 2 |  |  | 5 | 3 |  | 1 |  |  |  |
| `pages/admin/calc/AdminTariffsPage.tsx` | 3 | 1 |  |  | 2 | 4 |  | 2 | 8 |  | 1 |
| `features/deals/components/RequestWizard.tsx` | 4 | 3 |  |  |  | 1 |  |  | 11 |  |  |
| `pages/deals/QuoteBuilder.tsx` | 2 | 1 |  |  | 1 | 4 |  |  | 11 |  |  |
| `pages/m7/CabinetPages.tsx` | 4 |  |  |  |  |  |  | 1 | 13 |  |  |
| `pages/calc/QuickCalcPage.tsx` | 9 |  |  |  |  |  |  |  | 7 | 1 |  |
| `pages/admin/AdminUsersPage.tsx` | 9 | 2 |  |  | 1 | 3 |  | 1 |  |  |  |
| `pages/deals/InstallationPage.tsx` | 1 |  |  | 1 |  |  |  |  | 14 |  |  |
| `pages/admin/catalog/AdminCatalogPage.tsx` | 4 | 1 |  |  |  |  |  | 2 | 8 |  |  |
| `features/admin/components/BrandIcons.tsx` |  |  |  |  |  |  |  |  |  | 14 |  |
| `features/admin/dashboard/charts.tsx` |  |  |  |  |  |  |  |  | 1 | 13 |  |
| `pages/deals/ShopRequestsPages.tsx` | 4 | 1 |  |  | 3 |  |  |  | 6 |  |  |
| `pages/shop/ShopCatalogPage.tsx` | 2 | 2 |  |  | 2 | 2 |  | 1 | 5 |  |  |
| `pages/admin/moderation/AdminModerationPage.tsx` | 3 |  |  |  |  |  |  | 3 | 6 |  |  |
| `pages/catalog/CatalogPage.tsx` | 2 | 1 |  |  | 2 | 4 |  |  | 2 |  |  |
| `pages/catalog/ProductPage.tsx` |  |  |  |  | 2 |  |  | 1 | 8 |  |  |
| `pages/m7/SupportPages.tsx` | 1 |  |  | 1 | 2 | 1 |  |  | 6 |  |  |
| `pages/deals/MiscDealsPages.tsx` | 2 |  |  |  |  |  |  |  | 8 |  |  |
| `features/deals/components/QuoteDetails.tsx` | 1 |  |  |  | 1 |  |  | 1 | 6 |  |  |
| `pages/admin/calc/AdminCalcSettingsPage.tsx` | 1 | 2 |  |  |  | 1 |  | 3 | 2 |  |  |
| `pages/catalog/ShopsPage.tsx` | 2 |  |  |  | 3 |  |  |  | 4 |  |  |
| `features/calc/charts.tsx` | 1 |  |  |  |  |  |  | 3 | 4 |  |  |
| `pages/catalog/ShopProfilePage.tsx` | 1 |  |  |  |  |  |  | 2 | 5 |  |  |
| `pages/m7/KnowledgePages.tsx` | 1 |  |  |  |  | 1 |  |  | 6 |  |  |
| `pages/shop/ShopImportPage.tsx` |  |  |  | 1 |  |  |  | 1 | 6 |  |  |
| `features/deals/components/ChatPanel.tsx` | 3 | 1 |  | 1 |  |  | 1 |  | 1 |  |  |
| `features/shop/components/ServiceAreaEditor.tsx` | 3 |  |  |  |  |  |  |  | 2 | 2 |  |
| `pages/calc/OutagePage.tsx` | 2 |  |  |  | 1 | 2 |  |  | 2 |  |  |
| `pages/map/SiteDetailPage.tsx` |  |  |  |  |  |  |  |  | 6 | 1 |  |
| `pages/admin/shops/AdminShopsPage.tsx` | 1 |  |  |  |  |  |  | 1 | 4 |  |  |
| `pages/deals/CustomerRequestsPages.tsx` |  | 1 |  |  | 1 | 1 |  | 1 | 2 |  |  |
| `pages/calc/ResultPages.tsx` | 3 |  |  |  |  |  |  |  | 2 |  |  |
| `pages/landing/fx/ShaderBackground.tsx` |  |  |  |  |  |  |  |  |  | 5 |  |
| `pages/m7/AdminHomeBlocksPage.tsx` | 2 |  |  |  |  |  |  |  | 3 |  |  |
| `pages/map/MapPage.tsx` | 3 |  |  |  |  |  |  |  | 1 | 1 |  |
| `features/admin/components/CreateAdminDialog.tsx` | 2 | 2 |  |  |  |  |  |  |  |  |  |
| `features/auth/components/GoogleLogo.tsx` |  |  |  |  |  |  |  |  |  | 4 |  |
| `features/calc/ResultView.tsx` | 1 |  |  |  |  |  |  |  | 3 |  |  |
| `features/shop/components/BranchForm.tsx` |  | 2 |  |  |  | 2 |  |  |  |  |  |
| `pages/catalog/ComparePage.tsx` | 1 | 1 |  |  |  |  |  | 1 | 1 |  |  |
| `pages/map/SitesPage.tsx` | 1 |  |  |  |  |  |  |  | 3 |  |  |
| `components/layout/PanelHeader.tsx` | 2 |  |  |  |  |  |  |  | 1 |  |  |
| `features/auth/components/NewCredentialsCard.tsx` | 2 | 1 |  |  |  |  |  |  |  |  |  |
| `features/errors/admin/ErrorDrawer.tsx` | 2 |  |  |  |  |  |  |  | 1 |  |  |
| `features/notification/components/NotificationList.tsx` | 3 |  |  |  |  |  |  |  |  |  |  |
| `features/profile/AvatarEditor.tsx` | 2 |  |  | 1 |  |  |  |  |  |  |  |
| `pages/calc/CalculationsPage.tsx` |  | 1 |  |  |  |  |  | 2 |  |  |  |
| `pages/shop/ShopServicesPage.tsx` |  | 1 |  |  |  |  |  | 1 | 1 |  |  |
| `components/layout/MobileNavigation.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Dropdown.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Input.tsx` | 1 |  |  |  |  | 1 |  |  |  |  |  |
| `features/admin/admins/AdminDrawer.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `features/admin/audit/AuditDrawer.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `features/admin/components/AdminDelegationDialog.tsx` |  | 1 |  |  |  |  |  |  | 1 |  |  |
| `features/admin/components/PermissionPicker.tsx` | 1 | 1 |  |  |  |  |  |  |  |  |  |
| `features/admin/shops/IssuedCredentials.tsx` |  | 1 |  |  |  |  |  |  | 1 |  |  |
| `features/auth/components/GoogleAuth.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `features/map/MapView.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `features/session/components/NotificationChannelSettings.tsx` |  | 1 |  |  |  |  |  | 1 |  |  |  |
| `pages/SettingsPage.tsx` | 1 |  |  |  |  |  |  |  | 1 |  |  |
| `pages/admin/AdminDashboardPage.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `pages/admin/AdminDevOpsPage.tsx` | 1 |  |  |  |  |  |  |  | 1 |  |  |
| `pages/admin/shops/AdminShopDetailPage.tsx` |  |  |  |  |  |  |  |  | 2 |  |  |
| `pages/calc/FinancingPage.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `pages/catalog/CatalogParts.tsx` | 1 | 1 |  |  |  |  |  |  |  |  |  |
| `pages/legal/TermsPage.tsx` | 2 |  |  |  |  |  |  |  |  |  |  |
| `pages/shop/ShopDashboardPage.tsx` |  |  |  |  |  |  |  |  | 2 |  |  |
| `components/common/Logo.tsx` |  |  |  |  |  |  |  |  |  | 1 |  |
| `components/layout/LanguageSwitcher.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `components/layout/ThemeToggle.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Button.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Checkbox.tsx` |  | 1 |  |  |  |  |  |  |  |  |  |
| `components/ui/Dialog.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `components/ui/InfoTip.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Modal.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `components/ui/Select.tsx` |  |  |  |  | 1 |  |  |  |  |  |  |
| `components/ui/Switch.tsx` |  | 1 |  |  |  |  |  |  |  |  |  |
| `components/ui/Textarea.tsx` |  |  |  |  |  |  | 1 |  |  |  |  |
| `components/ui/Toast.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/admin/components/AdminPermissionsDialog.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/admin/components/DevOpsCharts.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/admin/users/UserDrawer.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/auth/components/OtpCodeInput.tsx` |  |  |  |  |  | 1 |  |  |  |  |  |
| `features/deals/components/SiteVisitCard.tsx` |  |  | 1 |  |  |  |  |  |  |  |  |
| `features/m7/DeletionBanner.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/m7/Markdown.tsx` |  |  |  |  |  |  |  | 1 |  |  |  |
| `features/media/components/MediaUploadField.tsx` |  |  |  | 1 |  |  |  |  |  |  |  |
| `features/notification/admin/AdminNotificationDrawer.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/profile/ProfileMenu.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/public/FaqSection.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/push/WebPushPrompt.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/session/components/CodeEmailSettings.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/session/components/LanguageSettings.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `features/session/components/NameRequiredDialog.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/session/components/PhoneRequiredBanner.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/session/components/PhoneVerifyDialog.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/session/components/TwoFactorSettings.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `features/shop/components/PermissionPicker.tsx` |  | 1 |  |  |  |  |  |  |  |  |  |
| `features/shop/components/ShopSwitcher.tsx` |  |  |  |  | 1 |  |  |  |  |  |  |
| `layouts/AuthLayout.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| `pages/admin/AdminAccountProfile.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `pages/admin/AdminProfilePage.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `pages/auth/FirstPasswordPage.tsx` | 1 |  |  |  |  |  |  |  |  |  |  |
| `pages/deals/ConversationsPage.tsx` |  |  |  |  |  |  |  |  | 1 |  |  |
| **Jami** | **198** | **45** | **1** | **7** | **55** | **50** | **2** | **37** | **223** | **44** | **1** |
