# UI ko‘rigi — topilmalar (1-qadam)

Stend: bosh sayt 5180, mijoz 5183, do‘kon 5184, admin 5185, API 3100 (hujjatdagi 3000 emas). Branch `ui/review`.

## Qamrov

- **87 ta sahifa** (U21 reyestri bo‘yicha; parametrli sahifalar real ma’lumot bilan), **1872 ta holat**.
- O‘lchamlar: 360, 390, 768, 1024, 1280, 1440 px × yorug‘ / qorong‘i (uz); oz va ru — 390 va 1440 px (yorug‘).
- Holatlar (kabinet sahifalari, 390 va 1440 px): ma’lumotli, bo‘sh (ro‘yxatlar bo‘shatilgan), yuklanish (API 4 s kechikish), xato (API GET → 500).
- Avtomatik: console error/warning, 4xx/5xx, axe-core (WCAG 2.1 A/AA), gorizontal skroll, kesilgan matn, ustma-ust elementlar, 44 px dan kichik teginish maydoni, «undefined / null / NaN / ISO sana», tarjima qilinmagan matn.
- Interaktiv (`scripts/ui-review-interactions.mjs`): modal focus-trap va Esc, mobil modal = sheet, bildirishnoma paneli, ⌘K, toast turlari, tugma holatlari, Tab tartibi, reduced-motion, WebGL’siz bosh sayt, film 8 bob.
- Har bir sahifaning skrinshotlari ko‘z bilan ko‘rib chiqildi (yorug‘/qorong‘i, 360–1440, oz/ru, bo‘sh/yuklanish/xato).
- Ko‘rilmagan: «Obyekt tafsiloti» (test bazasida obyekt yo‘q) va «Takliflarni solishtirish» (kamida 2 taklif kerak).

Skrinshotlar: `docs/ui-review/shots/<panel>/<sahifa>/<o‘lcham>-<mavzu>-<til>[-holat].png` (gitignore’da). Xom natijalar: `docs/ui-review/results.json`.

## Topilmalar

| ID | Panel / sahifa | O‘lcham / mavzu / til | Tur | Jiddiylik | Tavsif | Skrinshot | Qanday tuzatiladi |
|---|---|---|---|---|---|---|---|
| UI-001 | Hammasi / mobil header | 360–768, ikkala mavzu | E | kritik | Mobil headerdagi qidiruv tugmasi (⌘K) matni yashirilganda nomsiz qoladi — ekran o‘quvchi uchun nomi yo‘q (axe button-name). | `shots/customer/mijoz_bosh/390-light-uz.png` | PanelHeader: qidiruv tugmasiga aria-label=«Qidirish» berish. |
| UI-002 | Admin / Sharhlar (TabBar) | hammasi | E | kritik | role=tablist ichida role=tab’siz tugmalar (axe aria-required-children). | `shots/admin/admin_sharhlar/1440-light-uz.png` | TabBar komponenti farzand tugmalarga role=tab va aria-selected beradi. |
| UI-003 | Hammasi / ro‘yxat va tafsilot sahifalari | API 500, 390 va 1440 | B | yuqori | Xato holatida sahifa o‘rniga faqat qizil Alert «Server kutilmagan javob qaytardi (500).» — sarlavha yo‘q, «Qayta urinish» tugmasi yo‘q, nima qilish kerakligi aytilmagan (ErrorState ishlatilmagan). | `shots/customer/mijoz_sorovlar/1440-light-uz-error.png` | Umumiy QueryError (ErrorState: ikonka + «nima bo‘ldi» + «nima qilish kerak» + «Qayta urinish» → refetch); 52 joydagi `if (q.isError) return <Alert tone="danger">` naqshini almashtirish. |
| UI-004 | Mijoz / Chat (tizim xabarlari) | hammasi, ayniqsa ru/oz | C | yuqori | Tizim xabarlari server tomonida faqat o‘zbekcha matn sifatida saqlanadi: ru/oz sahifada «O‘lchov tasdiqlandi — mijoz kontakti ochildi» o‘zbekcha qoladi. Eski yozuvlarda xom ISO sana («2026-11-02T05:00:00.000Z») va formatlanmagan summa («20917756 so‘m») ham bor (server kodi hozir formatlaydi, faqat eski ma’lumot). | `shots/customer/mijoz_chat_rsId/390-light-ru.png` | ⏸ Logika: server tizim xabarini kalit + parametrlar (systemKind + data) bilan saqlashi, UI esa t() orqali tarjima qilishi kerak — backend o‘zgarishi. |
| UI-005 | Mijoz, do‘kon / montaj tarixi va chat | hammasi | C | yuqori | Montaj holat tarixi va chat tizim xabarlarida xom ISO sana («2026-11-02T05:00:00.000Z») va formatlanmagan summa ko‘rinadi (eski yozuvlar; server hozir formatlaydi). | `shots/customer/mijoz_montajlar_id/360-dark-uz.png` | UI: ko‘rsatishdan oldin matndagi ISO sanalarni formatDateTime ga, uzun raqam+«so‘m»ni formatSum ga almashtiruvchi umumiy helper (faqat ko‘rinish). |
| UI-006 | Admin / Yordam navbati | hammasi | C | yuqori | Ustuvorlik inglizcha enum sifatida ko‘rinadi: badge va tanlovda «HIGH», «URGENT», «NORMAL». | `shots/admin/admin_yordam_id/390-light-uz.png` | PRIORITY lug‘ati (Shoshilinch / Yuqori / Oddiy) + StatusBadge. |
| UI-007 | Mijoz / Hisoblarim (va boshqa jadvallar) | 360–390 | D | yuqori | Jadval mobilda kartaga aylanmaydi: ustunlar kesiladi, ichki gorizontal skroll; ro‘yxatni o‘qish qiyin. | `shots/customer/mijoz_hisoblar/360-dark-uz.png` | qs-table: ≤640 px da qatorlar karta ko‘rinishida (data-label bilan) — umumiy CSS + jadvallarga data-label. |
| UI-008 | Hammasi / mobil teginish maydonlari | 360–768, barcha panellar | D | yuqori | 44 px dan kichik teginish maydonlari: header ikonkalari 36–40 px (69 sahifa), sm tugmalar 29–32 px, Tab/segment 31–36 px, Chip 27 px, maydonlar 41–43 px, parol ko‘zi 34 px, «Orqaga» 40 px, xarita asboblari 32 px. | `shots/customer/mijoz_bosh/390-light-uz.png` | Komponentlarda: mobilda header tugmalari 44 px, Button sm / Tab / Chip uchun ::after bilan 44 px teginish maydoni, maydon 46 px. |
| UI-009 | Hammasi / yon panel, panel belgisi | yorug‘ mavzu, mijoz | E | yuqori | Faol menyu matni va «Mijoz paneli» belgisi: primary (#2563eb) primary-soft fonida 4,3:1 — 4,5:1 dan past. | `shots/customer/mijoz_bosh/1440-light-uz.png` | Token: yorug‘ mavzuda primary-soft ustidagi matn uchun to‘qroq primary (--qs-color-primary-active) ishlatish yoki soft fonni ochroq qilish. |
| UI-010 | Mijoz / bosh panel | 1440, yorug‘ | E | yuqori | Logotip «.uz» (#f0b84b) oq fonda 1,77:1 kontrast (axe color-contrast). | `shots/customer/mijoz_bosh/1440-light-uz.png` | Logo: yorug‘ fonda «.uz» uchun to‘qroq oltin (warning tokeni) — bezak bo‘lsa aria-hidden. |
| UI-011 | Hammasi / kontrast (yorug‘ mavzu) | yorug‘ | E | yuqori | Do‘kon yashil rangi: oq matn yashil tugmada 3,76:1, yashil matn och fonda 3,35:1 (faol tab, havola). Danger matni danger-bg ustida 4,3:1, xato badge 3,77:1; fayl yuklash tugmasi 3,18:1; DevOps ogohlantirish 3,52:1. | `shots/shop/dokon_filiallar/1440-light-uz.png` | Tokenlar: do‘kon primary yorug‘ mavzuda to‘qroq (≥4,5:1), danger matni uchun to‘qroq ton, warning matni uchun to‘qroq ton. |
| UI-012 | Do‘kon / Katalog, Import | hammasi | E | yuqori | Nomsiz maydonlar: jadval sarlavhasidagi «hammasini tanlash» checkbox’i (aria-label th’da, input’da emas), import sahifasidagi fayl input’i (axe label). | `shots/shop/dokon_katalog/1440-light-uz.png` | aria-label’ni input’ga ko‘chirish; fayl input’iga label. |
| UI-013 | Hammasi / H1 | hammasi | A | o‘rta | Sahifa sarlavhasi 5 xil uslubda: PageHeader 24–30 px, .qs-page__head 22–28 px, .gm-page-header 26–34 px, natija 22–32 px, do‘kon profili 22–30 px. | `shots/customer/mijoz_bosh/1440-light-uz.png` | Yagona --qs-h1 tokeni (clamp 24–30 px) va barcha sarlavha sinflari unga bog‘lanadi. |
| UI-014 | Hammasi / formalar va jadvallar | hammasi | A | o‘rta | 44 ta nativ <input type=checkbox> Checkbox komponentidan tashqarida (20 fayl): jadval qatori tanlash, ruxsatlar, filtrlar. | `—` | Checkbox komponentiga hideLabel qo‘shish va barchasini unga o‘tkazish. |
| UI-015 | Do‘kon katalog, admin do‘konlar, admin katalog / filtr chiplari | hammasi | A | o‘rta | Chip yorlig‘i va hisoblagich yopishib qoladi: «Faol4», «To‘xtatilgan0», «Tasdiqlangan7» — Chip’da hisoblagich uchun prop yo‘q, sahifalar oraliqsiz <span> qo‘shadi. | `shots/admin/admin_dokonlar/390-light-uz.png` | Chip komponentiga count prop (badge ko‘rinishida) va sahifalarni unga o‘tkazish. |
| UI-016 | Do‘kon / Analitika | hammasi | A | o‘rta | Grafik va voronka ustunlari ko‘k (#2563eb) — do‘kon paneli rangi yashil. | `shots/shop/dokon_analitika/1440-light-uz.png` | Grafik ranglarini --qs-color-primary tokeniga bog‘lash. |
| UI-017 | Mijoz / Solishtirish, admin / foydalanuvchi profili (topilmadi) | bo‘sh/topilmadi | A | o‘rta | Sahifada H1 yo‘q — bo‘sh holat yoki «topilmadi» holatida sarlavha chiqmaydi. | `shots/customer/mijoz_solishtirish/1440-light-uz.png` | Holatdan qat’i nazar PageHeader (H1) chiqarish. |
| UI-018 | Hammasi / sahifa yuklanishi | sekin tarmoq, 390 va 1440 | B | o‘rta | Yuklanishda faqat kichik «Yuklanmoqda…» spinneri: sarlavha va skeleton yo‘q, sahifa bo‘m-bo‘sh ko‘rinadi. | `shots/customer/mijoz_sorovlar/1440-light-uz-loading.png` | PageLoader → skeleton varianti (sarlavha + 3 karta shimmer); ro‘yxat sahifalarida skeleton. |
| UI-019 | Admin / dashboard grafiklari | hammasi | C | o‘rta | Grafik o‘qlarida «25M», «1.5k» — nuqtali kasr va inglizcha qisqartma (talab: vergul, «mln», «ming»). | `shots/admin/admin/1440-light-uz.png` | charts.tsx compact(): formatDecimal + t('mln')/t('ming'). |
| UI-020 | Do‘kon / Xizmatlar | hammasi | C | o‘rta | Narxda «1 050 000 UZS / kW» — boshqa joylarda «so‘m» va «kVt». | `shots/shop/dokon_xizmatlar/390-light-uz.png` | formatSum + t('kVt') ishlatish. |
| UI-021 | Mijoz / Batafsil hisob | 360–390, uz va ru | D | o‘rta | 6 qadamli stepper mobil kenglikka sig‘maydi: «4.» qadam kesilgan, 5–6 ko‘rinmaydi, ruscha nomlar 3 qatorga bo‘linadi. | `shots/customer/mijoz_kalkulyator_batafsil/390-light-ru.png` | Stepper (Progress.tsx): mobilda faqat raqamli doiralar + joriy qadam nomi, yoki gorizontal skroll fade bilan. |
| UI-022 | Mijoz / Batafsil hisob | 360–390 | D | o‘rta | «Keyingi» va «Natija» tugmalari ustma-ust tushadi (avtomatik tekshiruv, 9 holat). | `shots/customer/mijoz_kalkulyator_batafsil/390-light-uz.png` | Pastki amal qatorini ButtonGroup bilan (mobilda vertikal). |
| UI-023 | Mijoz / Natija (grafik) | hammasi | E | o‘rta | Grafik ustunlarida role’siz aria-label (axe aria-prohibited-attr); grafik insaytlari skroll qilinadi, lekin klaviaturadan fokuslanmaydi. | `shots/customer/mijoz_natija_id/1440-light-uz.png` | rect’larga role=img yoki <title>; skroll konteyneriga tabIndex=0. |
| UI-024 | Admin / jadvallar (Do‘konlar, Hisobotlar, Kontent, Yordam) | 1440 | E | o‘rta | Gorizontal skroll qilinadigan jadval o‘rami klaviaturadan fokuslanmaydi (axe scrollable-region-focusable). | `shots/admin/admin_dokonlar/1440-light-uz.png` | qs-table-wrap ga tabIndex=0 va aria-label (umumiy jadval komponenti). |
| UI-025 | Auth / kirish | 360, 768, 1024 — qorong‘i | F | o‘rta | Brend paneli va pastki 3 ta kartaning «reveal» animatsiyasi 1 s dan uzoq: skrinshotda matn/kartalar hali chiqmagan yoki xira. | `shots/customer/login/768-dark-uz.png` | AuthLayout: stagger kechikishini qisqartirish (jami ≤ 600 ms, --qs-dur-3). |
| UI-026 | Bosh sayt / film | 1440 | F | o‘rta | Boblar almashganda oldingi bob kartasi (410–520 ming so‘m) yangi bob matni ustida xira qolib ketadi — ikki bob bir vaqtda ko‘rinadi. | `shots/_interactions/film-4.png` | ScrollFilm: oldingi bob kartasining opacity’sini bob chegarasida 0 ga tushirish (crossfade oralig‘ini qisqartirish). |
| UI-027 | Do‘kon / Bosh panel | hammasi | G | o‘rta | TZ talabi — 4 ta asosiy KPI; hozir 7 ta bir xil darajadagi karta (4+3). | `shots/shop/dokon/1440-light-uz.png` | 4 asosiy KPI (Yangi so‘rovlar, Javob kutayotganlar, Yuborilgan takliflar, Tanlanish foizi) yuqorida; qolganlari kichik qatorda. |
| UI-028 | Do‘kon Sozlamalar, admin Siyosatlar | 1024–1440 | A | past | Sahifa sarlavhasi va kontent markazga tekislangan tor ustunda — boshqa sahifalar chapdan boshlanadi. | `shots/shop/sozlamalar/1440-light-uz.png` | Umumiy PageHeader va chapdan tekislash. |
| UI-029 | Admin / ro‘yxat sahifalari | hammasi | A | past | Sarlavhalar ikki xil: Adminlar, Audit, DevOps, Xatolar — ikonka qutisi bilan; Do‘konlar, Foydalanuvchilar, Tariflar — ikonkasiz. | `shots/admin/admin_adminlar/1440-light-uz.png` | Hammasida PageHeader (ikonka bilan). |
| UI-030 | Admin / Bildirishnomalar, Xatolar (KPI) | hammasi | A | past | Trend qiymatning yonida katta kursiv bilan yoziladi («34↑ 3200%», «281↑ 24%») — StatCard trend uslubidan farq qiladi. | `shots/admin/bildirishnomalar/390-light-uz.png` | Bu KPI’larni StatCard (trend badge) ga o‘tkazish. |
| UI-031 | Mijoz / Montajlar, Hisoblarim | bo‘sh, 1440 | B | past | EmptyState to‘liq emas: «Montajlar»da harakat tugmasi yo‘q, «Hisoblarim»da izoh matni yo‘q. | `shots/customer/mijoz_montajlar/1440-light-uz-empty.png` | Montajlar: «So‘rovlarga o‘tish» tugmasi; Hisoblarim: qisqa izoh. |
| UI-032 | Do‘kon / Vidjet | hammasi | B | past | Konsolda ogohlantirish: vidjet ko‘rinishiga postMessage noto‘g‘ri origin bilan yuboriladi. | `shots/shop/dokon_vidjet/1440-light-uz.png` | Ko‘rinish iframe’ining haqiqiy origin’iga yuborish. |
| UI-033 | Mijoz / Xarita sahifalari | hammasi | B | past | MapLibre ogohlantirishi «Style is not done loading» — uslub yuklanguncha qatlam qo‘shiladi (mavzu almashganda). | `shots/customer/mijoz_xarita/1440-light-uz.png` | MapView: setStyle’dan keyin 'style.load' hodisasini kutish. |
| UI-034 | Do‘kon / Takliflar (bo‘sh) | bo‘sh | C | past | Takliflar sahifasining bo‘sh holatida «So‘rov yo‘q» deyiladi. | `shots/shop/dokon_takliflar/1440-light-uz.png` | «Taklif yo‘q» va mos izoh. |
| UI-035 | Admin / Sharhlar, Kalkulyator | hammasi | C | past | UI matnida ichki hujjat havolalari: «(TZ 13.4)», «(TZ 11)». | `shots/admin/admin_sharhlar/390-light-uz.png` | Havolani matndan olib tashlash. |

Turlar: A — vizual izchillik, B — holatlar, C — matn, D — moslashuvchanlik, E — accessibility, F — harakat, G — panelga xos.

## Tekshirildi — muammo topilmadi

- Gorizontal skroll: 0 (1874 holat).
- Sahifa ochilmay qolishi (fatal): 0.
- Modal: focus ichida, Tab aylanadi, Esc yopadi, mobilda pastdan sheet.
- Bildirishnoma paneli va ⌘K: ochiladi, Esc yopadi, focus qaytadi.
- Toast turlari: rang, ikonka va role (status/alert) bilan farqlanadi; tugmalarda hover, focus-visible, disabled, loading ishlaydi.
- prefers-reduced-motion: animatsiyalar o‘chadi.
- Bosh sayt: WebGL o‘chirilganda statik kadr chiqadi, xatosiz; film 8 bobi ishlaydi; do‘konga havola yo‘q; statistika API’dan (soxta raqam yo‘q); FAQ va footer bor.
- Kirish: split-screen; do‘kon va admin — login + parol; OTP «Test rejimi» banneri; Tab tartibi mantiqiy.
- Xarita: atribusiya ko‘rinadi (lokal stendda OSM; Esri kaliti bo‘lsa «Powered by Esri»).
- Do‘kon: sertifikat yuklash yo‘q; admin: do‘kon yaratishda parol bir marta ko‘rsatiladi (e2e bilan tekshirilgan).
- Tarjima: UI matnlarining hammasi oz va ru’da tarjima qilingan; o‘zbekcha qolgan matnlar — foydalanuvchi ma’lumotlari (do‘kon nomi, sharh, manzil) va server tuzadigan matnlar (UI-004 ga qarang).

## Shovqin deb chiqarilganlar

- Mobil pastki panel (fixed) bilan sahifa elementlarining «kesishuvi» — kontentda pastki padding bor, haqiqiy yopilish yo‘q.
- Parol maydoni ichidagi «ko‘rsatish» tugmasi — dizayn bo‘yicha.
- Xato holati mock’idagi 500 konsol xabarlari; dev stenddagi `ERR_NETWORK_CHANGED` uzilishlari.
- Full-page skrinshotda bosh saytning 640vh film qismi bo‘sh ko‘rinadi (sticky sahna) — brauzerda to‘g‘ri.

## Statistika

Jami: **35 ta topilma**.

| Jiddiylik | Soni |
|---|---:|
| kritik | 2 |
| yuqori | 10 |
| o‘rta | 15 |
| past | 8 |

| Tur | Soni |
|---|---:|
| A — vizual izchillik | 8 |
| B — holatlar | 5 |
| C — matn | 7 |
| D — moslashuvchanlik | 4 |
| E — accessibility | 8 |
| F — harakat | 2 |
| G — panelga xos | 1 |

## Logika — sizning qaroringiz kerak

- **UI-004** — Tizim xabarlari server tomonida faqat o‘zbekcha matn sifatida saqlanadi: ru/oz sahifada «O‘lchov tasdiqlandi — mijoz kontakti ochildi» o‘zbekcha qoladi. Eski yozuvlarda xom ISO sana («2026-11-02T05:00:00.000Z») va formatlanmagan summa («20917756 so‘m») ham bor (server kodi hozir formatlaydi, faqat eski ma’lumot). Taklif: Logika: server tizim xabarini kalit + parametrlar (systemKind + data) bilan saqlashi, UI esa t() orqali tarjima qilishi kerak — backend o‘zgarishi.
