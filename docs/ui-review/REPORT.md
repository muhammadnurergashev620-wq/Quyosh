# UI ko‘rigi — yakuniy hisobot

Branch: `ui/review` (asos: `ui/perfect`), keyin `main` ga birlashtirildi. Faqat UI qatlami o‘zgardi: API, biznes logika va backend fayllariga tegilmadi.
Har bir tuzatish guruhi alohida commit; har commitdan oldin `typecheck`, `lint`, `test`, `build` o‘tdi.
Topilmalarning to‘liq ro‘yxati va holatlari: [FINDINGS.md](FINDINGS.md).

## Natija qisqacha

| | Soni |
|---|---:|
| Jami topilmalar | **38** (ko‘rikda 35 + keyin topilgan 3 ta: UI-036, UI-037, UI-038) |
| ✅ Tuzatildi | **36** |
| ✔ Qaror bilan yopildi | 1 — UI-004 (xabarlar o‘zbekcha qoladi) |
| ❌ UI qatlamidan tashqarida | 1 — UI-032 (backend) |

Jiddiylik bo‘yicha: kritik 2/2, yuqori 11/12 (UI-004 — qaror), o‘rta 16/16, past 7/8 (UI-032 ❌) tuzatildi.

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
| Mijoz — kirish | **87** (oldin 81) | ≥ 80 ✅ | 100 | ✅ |
| Do‘kon — kirish | **88** (oldin 75) | ≥ 80 ✅ | 100 | ✅ |
| Admin — kirish | **88** (oldin 71) | ≥ 80 ✅ | 100 | ✅ |
| Mijoz — do‘konlar | **84** | ≥ 80 ✅ | 100 | ✅ |
| Mijoz — kalkulyator | **71** (oldin 50) | ≥ 80 ⚠️ | 100 | ✅ |

Nima qilindi:
- **UI-038, `732dc3a`.** Ish muhitida `NODE_ENV=development` bo‘lsa, Vite build React’ning development versiyasini chiqarardi (`index` 334 KB). Endi `build` skripti doim `NODE_ENV=production` beradi: `index` 149 KB.
- **`767059d`.** Og‘ir sahifalar alohida bo‘lakda, panellarda App bo‘lagi oldindan yuklanadi, MapLibre dinamik yuklanadi, mobil jadval moduli bosh saytda ishlamaydi.

Kalkulyatorda qolgan TBT (~560 ms) — birinchi ekrandagi interaktiv xaritaning (WebGL) ishga tushishi. Kechiktirish va oldindan yuklash sinab ko‘rildi, foyda bermadi. 80 ga chiqarishning yagona yo‘li — xarita o‘rniga avval statik rasm ko‘rsatib, xaritani bosilganda yuklash. Bu UX’ni yomonlashtiradi (nuqtani darhol qo‘yib bo‘lmaydi), shuning uchun interaktiv xarita qoldirildi.

Mijoz panelida SEO 63 — panel sahifalari `robots.txt` orqali indekslashdan ataylab yopilgan (to‘g‘ri).

## Himoya: vizual regressiya

`npm run test:visual`:
- asosiy 25 sahifa × (390, 1440) × (yorug‘, qorong‘i) = **100 snapshot**;
- animatsiyalar o‘chiriladi, o‘zgaruvchan joylar niqoblanadi (vaqt, xarita, grafik, film), 2% gacha farqqa ruxsat;
- solishtirish rejimida **100/100** o‘tdi, keyingi o‘zgarishlardan keyin ham qayta o‘tdi.

Baseline `tests/visual/__screenshots__/` da, git’ga qo‘shilgan. U lokal stend ma’lumotiga bog‘liq: dizayn ataylab o‘zgarganda `npm run test:visual -- --update-snapshots` bilan yangilanadi.

## Qarorlar va qolgan masalalar

1. **UI-004** — qaror: tizim xabarlari va bildirishnomalar o‘zbekcha qoladi. Yopildi.
2. **UI-032 (❌, backend)** — vidjet ko‘rinishidagi `postMessage` origin ogohlantirishi. U server yaratadigan sahifadan (`src/modules/shop-content/widget-frame.ts`) chiqadi.
3. **Kalkulyator performance 71** — yuqoridagi sabab bilan interaktiv xarita qoldirildi.
4. **Ilgari ko‘rilmagan 2 sahifa** («Obyekt tafsiloti», «Takliflarni solishtirish») demo ma’lumot bilan ko‘rildi. Lokal bazaga mijoz uchun «Demo — Yunusobod uyi» obyekti ilovaning API’si orqali qo‘shildi. Topilgan bitta a11y xato (UI-037) tuzatildi.
5. **Kalkulyator sozlamalari yozuvidagi «(TZ 11)»** — bu bazadagi ma’lumot (seed), UI matni emas.

## Qanday takrorlash mumkin

```bash
npx tsx scripts/ui-review-tokens.ts     # lokal test tokenlari (faqat dev)
npm run ui:review                       # to‘liq ko‘rik → docs/ui-review/results.json, shots/
npm run ui:review:interactions          # interaktiv tekshiruvlar → docs/ui-review/interactions.json
npm run test:visual                     # vizual regressiya
```
