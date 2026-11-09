# UI ko‘rigi — yakuniy hisobot

Branch: `ui/review` (asos: `ui/perfect`). Faqat UI qatlami o‘zgardi: API, biznes logika va backend fayllariga tegilmadi.
Har bir tuzatish guruhi alohida commit; har commitdan oldin `typecheck`, `lint`, `test`, `build` o‘tdi.
Topilmalarning to‘liq ro‘yxati va holatlari: [FINDINGS.md](FINDINGS.md).

## Natija qisqacha

| | Soni |
|---|---:|
| Jami topilmalar | **36** (ko‘rikda 35 + tuzatish jarayonida 1 ta: UI-036) |
| ✅ Tuzatildi | **34** |
| ⏸ Sizning qaroringiz kerak (logika) | 1 — UI-004 |
| ❌ UI qatlamidan tashqarida | 1 — UI-032 (backend) |

Jiddiylik bo‘yicha: kritik 2/2, yuqori 10/11 (UI-004 ⏸), o‘rta 15/15, past 7/8 (UI-032 ❌) tuzatildi.

## Avtomatik ko‘rik: oldin → keyin

`npm run ui:review` — U21 reyestridagi 85 sahifa, ~1 850 holat (360–1440 px, yorug‘/qorong‘i, uz/oz/ru, bo‘sh/yuklanish/xato).

| Ko‘rsatkich (holatlar soni) | Oldin | Keyin |
|---|---:|---:|
| axe kritik/jiddiy bor holatlar | 897 (2 201 element) | **0** ¹ |
| console error | 0 | **0** |
| Gorizontal skroll | 0 | **0** |
| Kesilgan matn | 0 | **0** |
| Xom ISO sana / formatlanmagan summa | 68 | **0** |
| Tarjima qilinmagan UI kaliti | 0 | **0** ² |
| Mobilda 44 px dan kichik element bor holatlar | 934 | 167 ³ |

¹ Yakuniy ko‘rikda 1 ta qolgan edi (mahsulot xususiyatlari jadvali, ru, 390 px) — `4cef763` da tuzatildi va qayta tekshirildi.
² Oz/ru sahifalarda o‘zbekcha qolgan matnlar — foydalanuvchi ma’lumotlari (do‘kon nomi, sharh, manzil, tarif nomi) va server tuzadigan tizim xabarlari (UI-004).
³ Qolganlari — matn ichidagi havolalar (WCAG 2.5.8 AA bo‘yicha ruxsat etilgan istisno) va bir nechta sahifaga xos elementlar.

Interaktiv tekshiruvlar (`npm run ui:review:interactions`): modal focus-trap va Esc, mobil modal = sheet, bildirishnoma paneli, ⌘K, toast turlari, tugma holatlari, Tab tartibi (focus ko‘rinadi), reduced-motion, WebGL’siz bosh sayt, film 8 bob — hammasi ✓.

## Eng muhim 15 tuzatish — oldin / keyin

Chapda — `132f935` (ko‘rikdan oldin), o‘ngda — hozirgi holat. Rasmlar: `docs/ui-review/pairs/`.

| # | Tuzatish | Oldin | Keyin |
|---|---|---|---|
| 1 | **UI-003** Xato holati: yolg‘iz qizil yozuv o‘rniga «nima bo‘ldi + nima qilish kerak + Qayta urinish» (53 joyda) | ![](pairs/01-xato-holati-before.jpg) | ![](pairs/01-xato-holati-after.jpg) |
| 2 | **UI-018** Yuklanish: spinner o‘rniga sahifa skeleti | ![](pairs/02-yuklanish-skeleton-before.jpg) | ![](pairs/02-yuklanish-skeleton-after.jpg) |
| 3 | **UI-007** Jadvallar mobilda «yorliq — qiymat» kartalari | ![](pairs/03-mobil-jadval-before.jpg) | ![](pairs/03-mobil-jadval-after.jpg) |
| 4 | **UI-005** Montaj tarixida xom ISO sana formatlanadi | ![](pairs/04-iso-sana-before.jpg) | ![](pairs/04-iso-sana-after.jpg) |
| 5 | **UI-015 / UI-007** Chip hisoblagichi alohida badge («Faol12» → «Faol 12»), admin jadvali kartalarda | ![](pairs/05-chip-hisoblagich-before.jpg) | ![](pairs/05-chip-hisoblagich-after.jpg) |
| 6 | **UI-021 / UI-022** Mobil stepper (barcha qadamlar), «Natija» paneli «Keyingi»ni yopmaydi | ![](pairs/06-mobil-stepper-before.jpg) | ![](pairs/06-mobil-stepper-after.jpg) |
| 7 | **UI-006** Ustuvorlik: «HIGH» → «Yuqori» (rang + ikonka) | ![](pairs/07-ustuvorlik-before.jpg) | ![](pairs/07-ustuvorlik-after.jpg) |
| 8 | **UI-016** Do‘kon analitikasi panel rangida (yashil) | ![](pairs/08-dokon-analitika-before.jpg) | ![](pairs/08-dokon-analitika-after.jpg) |
| 9 | **UI-027** Do‘kon: 4 asosiy KPI yuqorida, qo‘shimchalari ixcham | ![](pairs/09-dokon-kpi-before.jpg) | ![](pairs/09-dokon-kpi-after.jpg) |
| 10 | **UI-030 / UI-019** Trend — kichik badge («395↑ 75%» o‘rniga) | ![](pairs/10-admin-trend-before.jpg) | ![](pairs/10-admin-trend-after.jpg) |
| 11 | **UI-028 / UI-013** Sozlamalar markazda emas, boshqa sahifalar kabi; yagona H1 | ![](pairs/11-markazlashtirish-before.jpg) | ![](pairs/11-markazlashtirish-after.jpg) |
| 12 | **UI-034** Takliflar bo‘sh holati: «So‘rov yo‘q» → «Taklif yo‘q» + to‘g‘ri izoh | ![](pairs/12-takliflar-bosh-before.jpg) | ![](pairs/12-takliflar-bosh-after.jpg) |
| 13 | **UI-001 / UI-008** Mobil header: qidiruv tugmasiga nom, ikonkalar 44 px | ![](pairs/13-mobil-header-before.jpg) | ![](pairs/13-mobil-header-after.jpg) |
| 14 | **UI-020 / UI-007** Xizmat narxi «UZS / kW» → «so‘m / kVt», jadval kartada | ![](pairs/14-xizmat-narxi-before.jpg) | ![](pairs/14-xizmat-narxi-after.jpg) |
| 15 | **UI-029** Admin sarlavhalari bir xil (ikonka qutisisiz, yagona H1) | ![](pairs/15-admin-sarlavha-before.jpg) | ![](pairs/15-admin-sarlavha-after.jpg) |

Rasmlarda ko‘rinmaydigan, lekin muhim tuzatishlar:
- **UI-002** — TabBar ARIA;
- **UI-009–011** — kontrast tokenlari ≥ 4,5:1 (do‘kon yashili, primary-soft, danger, logotip, to‘q mavzudagi faol tab);
- **UI-012, UI-023, UI-024** — nomsiz maydonlar, grafik va jadval regionlari;
- **UI-014** — 44 ta nativ checkbox yagona komponentga;
- **UI-025** — auth animatsiyasi ≤ 0,6 s;
- **UI-026** — filmda boblar ustma-ust tushmaydi;
- **UI-033** — MapLibre ogohlantirishi;
- **UI-036** — forma maydonlarida focus halqasi.

## Lighthouse (mobil, production build)

| Sahifa | Performance | Talab | Accessibility | Talab |
|---|---:|---:|---:|---:|
| Bosh sayt | **92** (oldin 69–82) | ≥ 85 ✅ | 100 | ≥ 95 ✅ |
| Mijoz — kirish | **84** (oldin 81) | ≥ 80 ✅ | 100 | ✅ |
| Do‘kon — kirish | **81** (oldin 75) | ≥ 80 ✅ | 100 | ✅ |
| Admin — kirish | **85** (oldin 71) | ≥ 80 ✅ | 100 | ✅ |
| Mijoz — kalkulyator | **64–67** (oldin 50) | ≥ 80 ❌ | 100 | ✅ |

Nima qilindi (`767059d`):
- og‘ir sahifalar alohida bo‘lakka chiqarildi (Sozlamalar, Profil, Bildirishnomalar, Shartlar, Register, OTP);
- panellarda App bo‘lagi `modulepreload` bilan yuklanadi;
- MapLibre dinamik yuklanadi (~1 MB sahifa chizilishidan oldin yuklanmaydi);
- mobil jadval moduli bosh saytdan olib tashlandi (u 837 ms uzun vazifa berardi).

Kalkulyator hali 80 ga yetmadi. LCP elementi ketma-ket zanjirni kutadi: `index` → `App` → sahifa bo‘lagi. Xaritaning ishga tushishi esa ~450 ms TBT beradi. Keyingi qadam:
- joriy marshrut bo‘lagini oldindan yuklash;
- xaritani ko‘rinish maydoniga kirganda ishga tushirish (`IntersectionObserver`).

## Himoya: vizual regressiya

`npm run test:visual`:
- asosiy 25 sahifa × (390, 1440) × (yorug‘, qorong‘i) = **100 snapshot**;
- animatsiyalar o‘chiriladi, o‘zgaruvchan joylar niqoblanadi (vaqt, xarita, grafik, film), 2% gacha farqqa ruxsat;
- solishtirish rejimida **100/100** o‘tdi, keyingi o‘zgarishlardan keyin ham qayta o‘tdi.

Baseline lokal stend ma’lumotiga bog‘liq. U `.gitignore`da va `npm run test:visual -- --update-snapshots` bilan yaratiladi.

## Qolgan masalalar va sizdan kutilayotgan qarorlar

1. **UI-004 (⏸, logika).** Chat tizim xabarlari va bildirishnomalar server tomonida faqat o‘zbekcha matn sifatida saqlanadi. Shuning uchun ru/oz sahifada o‘zbekcha qoladi. Taklif: server xabarni kalit + parametrlar bilan saqlasin, UI uni `t()` bilan tarjima qilsin — bu backend o‘zgarishi.
2. **UI-032 (❌, backend).** Vidjet ko‘rinishidagi `postMessage` origin ogohlantirishi. U server yaratadigan sahifadan (`src/modules/shop-content/widget-frame.ts`) chiqadi.
3. **Kalkulyator performance 64–67** (talab ≥ 80) — yuqoridagi keyingi qadamni bajarishga ruxsat berasizmi?
4. **Ko‘rilmagan 2 sahifa:**
   - «Obyekt tafsiloti» — test bazasida obyekt yo‘q;
   - «Takliflarni solishtirish» — kamida 2 taklif kerak.

   Demo ma’lumot qo‘shilsa, ko‘rikka kiritaman.
5. **Vizual baseline’ni repoga qo‘shish** (100 PNG, ~20 MB) yoki lokal qoldirish — qaysi biri?
6. **Kalkulyator sozlamalari yozuvidagi «(TZ 11)»** — bu UI matni emas, bazadagi ma’lumot (seed).

## Qanday takrorlash mumkin

```bash
npx tsx scripts/ui-review-tokens.ts     # lokal test tokenlari (faqat dev)
npm run ui:review                       # to‘liq ko‘rik → docs/ui-review/results.json, shots/
npm run ui:review:interactions          # interaktiv tekshiruvlar → docs/ui-review/interactions.json
npm run test:visual                     # vizual regressiya
```
