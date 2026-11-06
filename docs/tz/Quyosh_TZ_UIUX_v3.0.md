# Quyosh Platformasi — yagona TZ va UI/UX spetsifikatsiya v3.0

**Texnik topshiriq (I qism) va UI/UX dizayn spetsifikatsiyasi (II qism) bitta hujjatda.** Arxitektura, papka tuzilmasi, panel tuzilishi, dizayn tizimi va animatsiya tili **GetMaster** loyihasi asosida (namuna kod: `imtihon4`) qurilgan.

| | |
|---|---|
| Versiya | 3.1 — v3.0 ustiga: do'konni faqat admin yaratadi, do'kon login + parol bilan kiradi, bosh sayt faqat mijoz uchun, do'kon panelida sertifikat yuborish yo'q (Ilova B, 13-qator). **v3.1 qoidalari hujjatdagi eski qoidalardan ustun.** |
| Sana | 30.10.2026 |
| Namuna loyiha | GetMaster (NestJS + Prisma + Vite/React, 4 panel) |
| Qamrov | Bosh sayt, mijoz paneli, do'kon paneli, admin paneli, API, worker · uz / oz / ru |

## Hujjatni o'qish tartibi

- **I qism (TZ)** — bo'limlar `1.`–`24.` raqamlangan. Ma'lumot, API, hisob-kitob, xavfsizlik va arxitektura bo'yicha yagona manba.
- **II qism (UI/UX)** — bo'limlar `U0`–`U22` raqamlangan. II qism matni ichidagi prefikssiz havola (masalan "6.4", "A5") II qismga tegishli; I qismga havola doim "TZ 11.2" ko'rinishida yoziladi.
- I va II qism zid kelsa: ma'lumot, API va biznes qoidalari bo'yicha **I qism**, ko'rinish va harakat bo'yicha **II qism** ustun.
- "GetMaster bo'yicha" deb yozilgan joyda namuna loyihadagi tegishli fayl qanday qilingan bo'lsa, xuddi shunday quriladi (nomlar Quyosh domeniga moslanadi). Namunadan chetlashish faqat shu hujjatda yozilgan holatda.

## GetMaster asosida qurish qarori

Quyosh Platformasi noldan emas, GetMaster'ning tayyor va sinovdan o'tgan karkasi ustida quriladi. Domen (kalkulyator, do'konlar, takliflar, montaj) — Quyoshniki; qolgan hamma narsa (auth, sessiyalar, panellar, media, bildirishnoma, audit, admin, DevOps, dizayn tizimi, landing dvigateli) GetMaster'dan olinadi.

| GetMaster | Quyosh | Qanday olinadi |
|---|---|---|
| `CUSTOMER` roli, mijoz paneli `/mijoz` | `CUSTOMER`, mijoz paneli `/mijoz` | Shell, layout va auth to'liq olinadi; sahifalar Quyosh domeni bo'yicha |
| `MASTER` roli, usta paneli `/usta` | `SHOP` roli, do'kon paneli `/dokon` (+ `ShopMember`) | Panel karkasi olinadi; ichida ko'p a'zoli do'kon (TZ 2) |
| `ADMIN`, `isSuperAdmin`, `adminPermissions[]` | Xuddi shunday | To'liq olinadi; Quyosh bo'limlari huquqlar ro'yxatiga qo'shiladi |
| Bosh sayt (`PortalPage`, Three.js `FilmStage`, `ShaderBackground`, Lenis, GSAP) | Bosh sayt "Quyosh filmi" | Dvigatel olinadi; sahnalar Quyosh hikoyasiga almashtiriladi (U7.1) |
| `auth`, `otp`, `users`, `avatar` modullari | Xuddi shunday | To'liq olinadi; OTP dev-echo bilan |
| `problem-requests` → `offers` → `bookings` → `orders` | `quote-requests` → `quotes` → `installations` | Naqsh olinadi (idempotency, shartli yangilash, state machine), entity'lar Quyoshniki |
| `work-proofs`, `warranty`, `reviews`, `complaints`, `disputes` | Montaj chek-listi, kafolat, sharh, shikoyat, e'tiroz | Naqsh olinadi |
| `communication`, `calls`, `notification`, `push`, `mail`, Telegram | Yozishma, bildirishnomalar, Telegram | To'liq olinadi (qo'ng'iroqlar ixtiyoriy) |
| `media` (ClamAV, Sharp, signed URL), `legal`, `audit`, `error-log` | Xuddi shunday | To'liq olinadi |
| `geo` (Yandex + OSRM proksi) | Esri (TZ 12.1) | Modul tuzilmasi olinadi, provayder adapteri Esri |
| `subscription` (Plus/Pro, chek bilan) | Do'kon obuna rejalari | Naqsh olinadi |
| `feed` (ish lentasi) | Do'kon portfoliosi lentasi (ixtiyoriy, V1.0 da o'chiq) | Keyinroq |
| `admin-devops` | DevOps paneli (TZ 19.1) | Olinadi va kengaytiriladi |
| — | Kalkulyator (`calculator`, `calc-engine`), tariflar, katalog, xarita qatlami | Yangi modullar |

# I QISM — TEXNIK TOPSHIRIQ

Funksional talablar • Arxitektura • Database • API • Algoritmlar • Security • QA • Deploy

Maqsad: dasturchi ushbu hujjat asosida talablarni o‘zicha to‘ldirmasdan, yagona arxitektura va qabul qilish mezonlariga muvofiq ishlab chiqishi mumkin bo‘lgan batafsil texnik spetsifikatsiya.

Mahsulot tamoyili: foydalanuvchi o‘z manzili va o‘rnatish maydonini belgilaydi, elektr sarfini kiritadi, tizim taxminiy ishlab chiqarish va moliyaviy natijalarni (naqd va kredit/bo‘lib to‘lash variantlarida) hisoblaydi, do‘konlarni xaritada topadi va bir nechta narx taklifini solishtiradi. AI ishlatilmaydi. Ushbu hujjatdagi barcha funksiyalar V1.0 relizga kiradi; alohida keyingi bosqich yo‘q.

# 0. Hujjatni o‘qish va talqin qilish qoidalari

- MUST / SHART — qabul qilish mezoni uchun majburiy talab.

- SHOULD / TAVSIYA — asosli sabab bo‘lsa o‘zgartirilishi mumkin; o‘zgarish hujjatlashtiriladi.

- MAY / IXTIYORIY — mahsulot qarori bilan qo‘shilishi mumkin, ammo V1.0 uchun ushbu TZda belgilangan majburiy funksiyalarni almashtirmaydi.

- Hujjatda "masalan", "kabi", "if needed", "tanlanishi mumkin" kabi iboralar qaror o‘rnida ishlatilmaydi. Har bir texnik qaror aniq qiymat bilan yozilgan; misol faqat tushuntirish uchun keltirilsa, "misol:" deb belgilanadi va talab hisoblanmaydi.

- Barcha API JSON qaytaradi, /api/v1 prefix ishlatadi, vaqt ISO 8601 formatida UTC bilan uzatiladi.

- Barcha vaqt belgilari DBda timestamptz (UTC) sifatida saqlanadi; foydalanuvchiga Asia/Tashkent (UTC+05:00) vaqtida ko‘rsatiladi. Faqat sana bo‘lgan maydonlar (effectiveFrom, validUntil va h.k.) date turida saqlanadi va Asia/Tashkent kalendar kuni deb talqin qilinadi.

- Barcha pul qiymatlari aniq decimal arifmetika bilan hisoblanadi (backendda Prisma Decimal + decimal.js). JavaScript number pul hisobining manbasi bo‘la olmaydi. Aniqlik va yaxlitlash qoidalari 7.1-bo‘limda.

- Hisob-kitob natijasi prognozdir. UI ishlab chiqarish, tejash yoki daromadni kafolatlangan deb ko‘rsatmaydi.

- Tarif, subsidiya, kredit shartlari va ortiqcha elektrni sotish/qoplash shartlari o‘zgaruvchan bo‘lgani uchun manba, amal qilish sanasi va tekshiruv holati bilan boshqariladi.

- UIda ishlatiladigan atamalar II qismdagi U3 lug‘atidan olinadi. Kodda inglizcha nomlar, UIda lug‘atdagi o‘zbekcha nomlar ishlatiladi.

- Ro‘yxat raqamlari har bir bo‘lim ichida 1 dan boshlanadi.

# 1. Mahsulot maqsadi va chegarasi

## 1.1. Mahsulot ta’rifi

Platforma — quyosh paneli o‘rnatishni rejalashtirayotgan mijozlarni quyosh uskunalari sotuvchilari va montaj xizmatlari bilan bog‘laydigan web-platforma. Platforma kalkulyator, moliyalashtirish (kredit/bo‘lib to‘lash) kalkulyatori, elektr uzilishi kalkulyatori, xarita, yagona uskuna katalogi, do‘kon kabineti, taklif so‘rovi, mijoz–do‘kon yozishmasi, takliflarni solishtirish, montajdan keyingi kuzatuv va administrator boshqaruvini birlashtiradi.

## 1.2. Asosiy foydalanuvchi natijasi

1.  Foydalanuvchi hudud/manzilni tanlaydi.

2.  Xaritada (sun’iy yo‘ldosh qatlamida) tom yoki o‘rnatish maydonini poligon bilan chizadi, maydon o‘lchamini qo‘lda kiritadi yoki "Tez hisob" rejimida bu qadamni o‘tkazib yuboradi.

3.  Elektr sarfini kiritadi: oylik kWh, oylik to‘lov summasi, 12 oylik qiymatlar yoki uydagi maishiy texnika ro‘yxati orqali.

4.  Tizim turi (tarmoqqa ulangan, gibrid, avtonom), panel, invertor va akkumulyatorni tanlaydi yoki kalkulyator tavsiya qilgan uchta hajm variantini ko‘radi.

5.  Tizim ishlab chiqarish, o‘zida iste’mol, tarmoqqa uzatish, tarmoqdan olish, tejaladigan pul, tasdiqlangan eksport daromadi, boshlang‘ich xarajat, oddiy qoplanish muddati, 25 yillik pul oqimi, CO₂ tejalishi va elektr uzilishida zaxira vaqtini hisoblaydi.

6.  Naqd va kredit/bo‘lib to‘lash variantlarini solishtiradi: oylik to‘lov, kredit muddati, ortiqcha to‘lov va oylik tejash to‘lovni qancha qoplashi.

7.  Foydalanuvchi xaritada yaqin do‘konlarni ko‘radi, narxlarni solishtiradi va bir nechta do‘konga taklif so‘rovi yuboradi; do‘kon bilan platforma ichida yozishadi va o‘lchov (zamer) uchrashuvini band qiladi.

8.  Montaj bajarilgach mijoz buni tasdiqlaydi, sharh qoldiradi va o‘rnatilgan tizimni kabinetda kuzatadi (kafolatlar, xizmat eslatmalari, haqiqiy ishlab chiqarish va prognoz taqqoslash).

9.  Do‘kon egasi katalog, narx, mavjudlik, xizmat hududi, filiallar, portfolio, kelgan so‘rovlar va o‘z saytiga joylanadigan kalkulyator vidjetini boshqaradi.

## 1.3. V1.0 ichiga kiradigan modullar

- Public website (faqat mijozga qaratilgan), mijozning ro‘yxatdan o‘tishi (telefon OTP) va logini; uch tilli interfeys (o‘zbek lotin, o‘zbek kirill, rus). Do‘kon o‘zi ro‘yxatdan o‘tmaydi: do‘konni admin yaratadi, do‘kon login (admin bergan nom) + parol bilan kiradi (3.7).

- Mijoz kabineti, bir nechta obyekt/manzil boshqaruvi, jismoniy va yuridik shaxs hisoblari.

- Xarita (sun’iy yo‘ldosh qatlami bilan), do‘konlar, marker klasterlash va xizmat hududlari.

- Maydon chizish, maydon yuzasini tekshirish, qiyalik tuzatishi va saqlash.

- Quyosh ishlab chiqarish va moliyaviy kalkulyator: Tez hisob va Batafsil hisob rejimlari, tizim hajmi tavsiyasi, 25 yillik model.

- Maishiy texnika asosida iste’mol hisoblagich.

- Elektr uzilishi (zaxira quvvat) kalkulyatori.

- Moliyalashtirish kalkulyatori: bank krediti, do‘kon bo‘lib to‘lashi va lizing; moliyalashtirish mahsulotlari katalogi.

- Quyosh ma’lumotlari provayderi, tariflar, eksport qoidalari va valyuta kurslari boshqaruvi.

- Yagona uskuna katalogi (ProductModel) va do‘kon takliflari; uskunalar mosligini tekshirish.

- Do‘kon profili, filiallar, montaj va servis xizmatlari, portfolio, javob tezligi ko‘rsatkichi.

- Taklif so‘rovi, mijoz–do‘kon yozishmasi, kontaktni ochish siyosati, o‘lchov uchrashuvi, narx takliflari (revision tarixi bilan), takliflarni solishtirish.

- Montaj (Installation) holati, montajni tasdiqlash, sharhlar va do‘kon javobi.

- Montajdan keyingi kabinet: o‘rnatilgan tizim, kafolatlar, xizmat eslatmalari, haqiqiy ishlab chiqarishni kiritish.

- Do‘kon uchun: mahsulotlarni CSV/XLSX orqali ommaviy yuklash, taklif shablonlari, lead pipeline, embed kalkulyator vidjeti.

- Sevimlilar, hisobni ulashish (read-only link), hisoblarni yonma-yon solishtirish, PDF hisobot.

- Bildirishnomalar: in-app markaz, email, SMS va Telegram bot.

- Ruxsatnomalar va ulanish bo‘yicha qo‘llanma sahifalari (admin boshqaradigan kontent).

- Do‘kon obunalari/paketlari, mahalliy to‘lov tizimlari (Click, Payme, Uzum), admin panel, audit, platforma analitikasi va konversiya funnel’i.

- Admin: do‘kon va egasining hisobini yaratish (vaqtincha parol), parolni qayta tiklash, xodim qo‘shish, do‘konni to‘xtatish va qayta yoqish, egani almashtirish, belgilar (rasmiy diler va h.k.) qo‘yish (3.7).

- Super Admin DevOps paneli: xizmatlar holati, so‘rovlar va xatolar grafiklari, navbatlar, ma’lumotlar bazasi, deploylar, alertlar, backup va tashqi provayder kvotalari (19.1).

- Bosh sayt (marketing sahifalari): admin boshqaradigan bloklar, hero video, tushuntiruvchi videolar va animatsiyalar (5.5).

- Yordam markazi: mijoz va do‘kon uchun murojaat (ticket) tizimi, admin navbati va javob muddatlari.

- Montajni qabul qilish chek-listi.

- Bilimlar markazi: qo‘llanmalar, maqolalar, FAQ va videoqo‘llanmalar (SEO uchun).

- Do‘kon belgilari: rasmiy diler, sertifikatli montajchi, litsenziya — faqat admin belgilaydi (do‘kon panelida sertifikat yuborish yo‘q).

- Soxta sharhlarga qarshi qoidalar (AI’siz).

- Security, accessibility, responsive UI, test, monitoring va deploy.

## 1.4. V1.0 ga kiritilmaydigan narsalar

- AI chatbot, AI dizayner, AI orqali tavsiya, OCR yoki boshqa ML/AI asosidagi funksiya.

- Foydalanuvchi invertoriga to‘g‘ridan-to‘g‘ri ulanib real-time monitoring. Haqiqiy ishlab chiqarish faqat qo‘lda kiritiladi.

- Platformaning o‘zi elektr tarmog‘i operatori, bank, kredit beruvchi yoki sertifikatlangan energetik audit o‘rnini bosishi.

- Rasmiy elektron hisob-faktura chiqarish (soliq tizimi orqali). Platforma faqat tijoriy taklif PDF chiqaradi.

- Tarif, eksport kompensatsiyasi yoki kredit shartlari bo‘yicha tasdiqlanmagan qonuniy va’dalar.

## 1.5. V1.0 ichki bosqichlari (milestones)

Barcha bosqichlar bitta V1.0 relizga kiradi. Bosqichlar faqat ish tartibi va oraliq qabul uchun; production reliz faqat M7 yakunida bo‘ladi.

| **Bosqich**                            | **Mazmuni**                                                                                                                                                                                             | **Oraliq qabul mezoni**                                                                               |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| M1. Poydevor                           | Repozitoriy (GetMaster karkasi), CI, Docker, DB + PostGIS, auth (OTP, email, sessiyalar), rollar, i18n karkasi, design system komponentlari, Figma asosiy ekranlar                                                             | Ro‘yxatdan o‘tish/login 3 tilda ishlaydi; CI yashil; design system Storybook’da                       |
| M2. Katalog va do‘konlar               | ProductModel katalogi, do‘kon, filial, xizmatlar, takliflar, CSV/XLSX import, moderatsiya, valyuta kurslari                                                                                             | Do‘kon ro‘yxatdan o‘tib, verifikatsiyadan o‘tib, mahsulot import qiladi va public katalogda ko‘rinadi |
| M3. Xarita va obyektlar                | Map provider, sun’iy yo‘ldosh qatlami, geocoding, klasterlash, xizmat hududlari, poligon muharriri, obyektlar                                                                                           | Mobil va desktopda poligon chizish, server validatsiyasi va maydon hisobi ishlaydi                    |
| M4. Hisoblash dvigateli                | Solar adapter, tarif dvigateli, tavsiya algoritmi, energiya balansi, akkumulyator, 25 yillik model, moliyalashtirish, uzilish kalkulyatori, golden testlar                                              | 17.1-bo‘limdagi barcha hisob testlari o‘tadi                                                          |
| M5. Kalkulyator UI                     | Tez/Batafsil rejim, maishiy texnika, natijalar, moliyalashtirish va uzilish ekranlari, PDF, ulashish, solishtirish                                                                                      | Mijoz 3 daqiqadan kam vaqtda Tez hisob natijasini oladi (usability test)                              |
| M6. Takliflar va muloqot               | Taklif so‘rovi, yozishma, kontakt ochish, o‘lchov uchrashuvi, takliflar va revisionlar, montaj, sharhlar, bildirishnomalar (Telegram bilan)                                                             | 17-bo‘limdagi E2E oqimi to‘liq o‘tadi                                                                 |
| M7. Kabinetlar, monetizatsiya va reliz | Montajdan keyingi kabinet, portfolio, vidjet, lead pipeline, analitika, obuna va to‘lovlar, admin preview, yordam markazi, bilimlar markazi, sertifikatlar, xavfsizlik, yuklama testlari, staging qabul | 22-bo‘limdagi Definition of Done to‘liq bajarilgan                                                    |

# 2. Rollar, huquqlar va ruxsatlar

## 2.1. Rol modeli

- Platforma rollari GetMaster naqshida `UserRole[]` jadvali orqali: CUSTOMER, SHOP, ADMIN. Mijoz o‘zi ro‘yxatdan o‘tadi (CUSTOMER). Do‘kon egasi va xodimlarining hisobini faqat admin yaratadi va ularga faqat SHOP roli beriladi (CUSTOMER roli yo‘q); do‘kon o‘zi ro‘yxatdan o‘ta olmaydi. **SUPER_ADMIN** = ADMIN roli + `User.isSuperAdmin = true`; oddiy admin bo‘limlari `User.adminPermissions[]` bilan cheklanadi (6.4).

- Do‘kon rollari faqat ShopMember.memberRole orqali beriladi: OWNER, MANAGER, STAFF. Bitta foydalanuvchi bir vaqtda mijoz va bir yoki bir nechta do‘konning a’zosi bo‘lishi mumkin.

- Do‘kon egaligining yagona haqiqat manbai — ShopMember(memberRole = OWNER). Shop jadvalida ownerId maydoni yo‘q. Har bir do‘konda aynan bitta OWNER bo‘ladi (partial unique index).

| **Rol**      | **Ko‘rishi mumkin**                                                   | **Amallar**                                                                                                                                                                    | **Cheklovlar**                                                                                |
|--------------|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| Guest        | Public katalog, do‘kon, xarita, kalkulyator, qo‘llanmalar             | Tez/Batafsil hisob (saqlamasdan), mahsulotlarni ko‘rish va solishtirish                                                                                                        | Saqlash, PDF, taklif so‘rovi, yozishma, sharh va sevimlilar uchun login shart                 |
| Customer     | O‘z profili, obyektlari, hisoblari, so‘rovlari, o‘rnatilgan tizimlari | Obyekt va maydon saqlash, hisob saqlash/ulashish, PDF, taklif so‘rash, yozishish, uchrashuv band qilish, montajni tasdiqlash, sharh, sevimlilar                                | Boshqa foydalanuvchi ma’lumotlariga kirish taqiqlanadi                                        |
| Shop OWNER   | O‘z do‘koni, filiallari, takliflari, so‘rovlari, analitikasi          | Barcha do‘kon amallari, xodim qo‘shish (login + vaqtincha parol), parolini tiklash, ruxsatlarini boshqarish, vidjet sozlash                                                                                                 | Boshqa do‘konni tahrirlay olmaydi; verifikatsiya admin tasdig‘ini talab qiladi                |
| Shop MANAGER | O‘ziga biriktirilgan do‘kon ma’lumotlari                              | permissions ro‘yxatidagi amallar (katalog, so‘rovlar, takliflar, yozishma, portfolio, analitika)                                                                               | Obuna, to‘lov, xodim qo‘shish/o‘chirish, egani almashtirish va do‘konni o‘chirish taqiqlanadi |
| Shop STAFF   | Biriktirilgan so‘rovlar va katalog                                    | Faqat permissions ro‘yxatidagi amallar (default: yozishma va taklif qoralamasi)                                                                                                | Taklifni yuborish uchun quote.send ruxsati kerak                                              |
| Admin        | Moderatsiya va operatsion panel                                       | Do‘kon verifikatsiyasi, shikoyatlar, katalog va ProductModel moderatsiyasi, tariflar, eksport qoidalari, moliyalashtirish mahsulotlari, maishiy texnika katalogi, qo‘llanmalar | SUPER_ADMIN huquqlarini avtomatik olmaydi                                                     |
| Super Admin  | Tizim boshqaruvi                                                      | Rollar, adminlar, tizim konfiguratsiyasi, audit va platforma sozlamalari; do‘kon yaratish, parolni tiklash, to‘xtatish va egani almashtirish (3.7); DevOps paneli (19.1)                        | Barcha yuqori xavfli amallar audit qilinadi; 2FA (parol + OTP) majburiy                                |

## 2.2. Do‘kon ruxsatlari ro‘yxati

ShopMember.permissions — quyidagi kalitlar massivi (OWNER hammasiga ega): catalog.read, catalog.write, offers.write, services.write, branches.write, requests.read, requests.assign, messages.write, quote.draft, quote.send, quote.withdraw, installations.write, portfolio.write, analytics.read, widget.manage, reviews.reply. Faqat OWNER uchun: members.manage, billing.manage, shop.delete.

## 2.3. Ruxsat tekshirish qoidalari

- Ruxsat faqat frontend tugmasini yashirish bilan ta’minlanmaydi; har bir API so‘rovida server tekshiradi.

- Role-based access control bilan birga ownership check majburiy: customer o‘z siteId’siga, shop user esa o‘z shopId’siga a’zoligini va kerakli permission’ni tekshirish.

- Platforma rollari va do‘kon ruxsatlari ikki mustaqil guard zanjiri bilan tekshiriladi (6.3): /api/v1/admin/\* endpointlari faqat User.role (PlatformRoleGuard) bo‘yicha, /api/v1/manage/shops/:shopId/\* endpointlari faqat ShopMember a’zoligi va permissions (ShopPermissionGuard) bo‘yicha. ADMIN roli do‘kon ruxsatlarini avtomatik bermaydi (admin do‘konga faqat admin endpointlari orqali ta’sir qiladi va har bir amal audit qilinadi); do‘kon a’zoligi hech qanday admin huquqini bermaydi.

- Admin tomonidan o‘zgartirilgan tarif, eksport qoidasi, moliyalashtirish mahsuloti, do‘kon verifikatsiyasi va hisoblash sozlamasi AuditLog‘ga yoziladi.

- HTTP status qarori (yakuniy): rol yoki permission yetarli bo‘lmasa — 403 FORBIDDEN. Resurs mavjud bo‘lmasa yoki boshqa foydalanuvchi/do‘konga tegishli bo‘lsa — 404 NOT_FOUND (resurs mavjudligini oshkor qilmaslik uchun).

# 3. Foydalanuvchi ssenariylari va to‘liq workflow

## 3.1. Mijoz kalkulyator workflow — Tez hisob (default)

1.  Bosh sahifadagi "Hisoblab ko‘rish" tugmasi Tez hisob rejimini ochadi.

2.  Mijoz manzilni qidiradi, xaritadan pin qo‘yadi yoki "Mening joylashuvim" tugmasini bosadi.

3.  Oylik elektr to‘lovi (so‘m) yoki oylik kWh ni kiritadi; "Bilmayman" tugmasi maishiy texnika ro‘yxatini ochadi.

4.  O‘rnatish joyini tanlaydi: "Tom" yoki "Hovli/yer" va taxminiy bo‘sh joy: "Kichik (≈20 m²)", "O‘rtacha (≈40 m²)", "Katta (≈80 m²)" yoki "Xaritada chizaman".

5.  Tizim darhol asosiy javobni ko‘rsatadi (4.7-bo‘lim): tavsiya etilgan quvvat, oylik tejash, taxminiy narx va o‘zini oqlash muddati.

6.  Mijoz "Batafsil hisob"ga o‘tib parametrlarni aniqlashtirishi, natijani saqlashi, PDF olishi yoki do‘konlardan taklif so‘rashi mumkin.

## 3.2. Mijoz kalkulyator workflow — Batafsil hisob

1.  Joylashuv: manzil qidiruvi, pin yoki koordinata.

2.  Maydon: xaritada bir yoki bir nechta poligon (asosiy tom, garaj, qo‘shimcha bino); tom turi (tekis/qiya), qiyalik va yo‘nalish vizual tanlagich orqali; soya darajasi uch variantda.

3.  Iste’mol: oylik kWh, oylik to‘lov, ikkalasi, 12 oylik qiymatlar yoki maishiy texnika ro‘yxati. Ikkalasi kiritilsa nomuvofiqlik ogohlantiriladi.

4.  Tizim: tizim turi (on-grid / gibrid / off-grid); tavsiya qilingan uchta hajm varianti yoki aniq panel/invertor/akkumulyator modeli.

5.  Xarajatlar: katalogdagi o‘rtacha narxlar asosida avtomatik to‘ldiriladi; mijoz o‘zgartirishi mumkin.

6.  Moliyalashtirish (ixtiyoriy qadam): naqd yoki kredit/bo‘lib to‘lash parametrlari.

7.  Natija: past/standart/yuqori diapazon, data source, taxminlar, 25 yillik model, moliyalashtirish va uzilish bloklari.

8.  Mijoz natijani saqlaydi, ulashadi, PDF oladi, solishtiradi yoki taklif so‘rovi yuboradi.

## 3.3. Guest → login oqimi

1.  Guest kiritgan barcha kalkulyator ma’lumotlari brauzerda sessionStorage + server tomonida CalculationDraft (anonim, 7 kun saqlanadi, httpOnly cookie’dagi draft ID bilan) sifatida saqlanadi.

2.  Guest saqlash, PDF, taklif so‘rovi yoki sevimlilarni bossa login/ro‘yxatdan o‘tish modal oynasi ochiladi (sahifadan chiqib ketmaydi).

3.  Muvaffaqiyatli logindan keyin draft avtomatik foydalanuvchiga biriktiriladi va mijoz bosgan amal davom ettiriladi. Kiritilgan ma’lumot yo‘qolmaydi.

## 3.4. Taklif (quote) workflow

1.  Customer saqlangan hisob yoki obyekt asosida taklif so‘rovi yaratadi va 1–5 ta do‘konni tanlaydi. Tizim mijoz hududiga xizmat ko‘rsatadigan do‘konlarni (ServiceArea bo‘yicha) birinchi tavsiya qiladi.

2.  Tizim har bir tanlangan do‘kon uchun QuoteRequestShop yozuvi yaratadi (status SENT) va do‘konga bildirishnoma yuboradi.

3.  Do‘kon so‘rovni ochganda status VIEWED bo‘ladi. Kontakt ochilmaguncha do‘kon faqat tuman/shahar, tizim parametrlari va hisob xulosasini ko‘radi (13.2-bo‘lim).

4.  Do‘kon aniqlashtirish kerak bo‘lsa yozishma orqali savol beradi (CLARIFICATION_REQUESTED) yoki o‘lchov uchrashuvini taklif qiladi.

5.  Do‘kon mahsulotlar, miqdor, montaj, yetkazish, qo‘shimcha xarajat, QQS, kafolat, muddat, amal qilish muddati va (ixtiyoriy) bo‘lib to‘lash sharti bilan taklif yuboradi (QUOTED). Do‘kon so‘rovni sababini ko‘rsatib rad etishi mumkin (DECLINED).

6.  Customer takliflarni solishtirish ekranida taqqoslaydi (4.12-bo‘lim).

7.  Customer bitta taklifni tanlaydi (Quote.ACCEPTED). Boshqa do‘konlar avtomatik NOT_SELECTED bo‘ladi va xabar oladi. Tanlangan taklif asosida Installation yozuvi yaratiladi.

8.  Do‘kon montaj jarayonini yuritadi: o‘lchov, montaj sanasi, montaj bajarildi.

9.  Customer montajni qabul qilish chek-listini to‘ldiradi (13.7) va montaj bajarilganini tasdiqlaydi (Installation.CONFIRMED). Shundan keyin sharh qoldirish ochiladi va o‘rnatilgan tizim kabinetga qo‘shiladi.

Barcha status enumlari va o‘tish jadvallari 13-bo‘limda. Ular yagona haqiqat manbai.

## 3.5. Do‘konning birinchi kirishi (v3.1: onboarding olib tashlangan)

Do‘kon o‘zi ochilmaydi va "Do‘kon ochish" sahifasi, wizard hamda tekshiruvga yuborish yo‘q. Do‘konni admin yaratadi (3.7), shuning uchun u darhol `ACTIVE` va `VERIFIED`.

1.  Admin egasining login (telefon) va tizim yaratgan vaqtincha parolini oladi va do‘kon egasiga o‘zi yetkazadi (parol faqat bir marta ko‘rsatiladi).

2.  Ega do‘kon panelida login + parol bilan kiradi (SMS/OTP yo‘q). `User.mustPasswordChange = true` bo‘lgani uchun faqat "Yangi parol o‘rnating" ekrani ochiladi; parol almashtirilmaguncha panelning boshqa sahifalari va API endpointlari 403 `PASSWORD_CHANGE_REQUIRED` qaytaradi.

3.  Parol almashtirilgach `mustPasswordChange = false` bo‘ladi va ega bosh panelga o‘tadi. Profil, filial, xizmat hududi, katalog va importni ega o‘zi panel bo‘limlaridan to‘ldiradi (alohida wizard yo‘q); bosh panelda "Profil to‘liqligi: N%" chek-listi ko‘rsatiladi.

4.  Parol yo‘qolsa "Parolni unutdim" yo‘q: ega administratorga murojaat qiladi, admin yangi vaqtincha parol beradi (3.7.2).

## 3.6. Montajdan keyingi workflow

1.  Installation.CONFIRMED bo‘lgach InstalledSystem yaratiladi: quvvat, komponentlar, montaj sanasi, kafolat muddatlari.

2.  Mijoz har oy hisoblagich ko‘rsatkichini yoki ishlab chiqarilgan kWh ni kiritishi mumkin; tizim prognoz bilan taqqoslaydi va 20% dan ko‘p farq bo‘lsa ogohlantiradi.

3.  Tizim xizmat eslatmalarini yuboradi: panel tozalash (default 90 kun), yillik ko‘rik, kafolat tugashiga 60 kun qolganda.

## 3.7. Do‘konni admin yaratishi va do‘kon hayot sikli

Do‘konni faqat admin yaratadi (ADMIN roli va `SHOPS` huquqi). Do‘kon ro‘yxatdan o‘ta olmaydi, ShopInvitation (taklif havolasi) olib tashlangan. Har bir amal AuditLog’ga yoziladi.

### 3.7.1. Do‘kon yaratish

1.  Admin → Do‘konlar → "+ Do‘kon yaratish" formasi: **do‘kon ma’lumotlari** — nomi, STIR, telefon, viloyat, manzil (birinchi filial sifatida saqlanadi); **egasining hisobi** — ism, **login** (3–32 belgi: lotin harflari, raqamlar, `. _ -`; admin beradi), telefon (ixtiyoriy). Parolni admin kiritmaydi.

2.  Server dublikatni tekshiradi: shu STIR bilan do‘kon bo‘lsa 409 `SHOP_STIR_TAKEN`, shu telefon bilan do‘kon bo‘lsa 409 `SHOP_PHONE_TAKEN` — ikkalasi ham bloklaydi (v3.2, buyurtmachi qarori; profilda telefon o‘zgartirilganda ham). Egasining logini band bo‘lsa 409 `LOGIN_TAKEN`, telefoni boshqa akkauntda band bo‘lsa 409 `PHONE_TAKEN`: mavjud akkaunt do‘konga bog‘lanmaydi.

3.  Bitta tranzaksiyada: Shop (`createdSource = ADMIN`, `status = ACTIVE`, `verificationStatus = VERIFIED`), birinchi filial, egasining User (faqat SHOP roli, `mustPasswordChange = true`) va `ShopMember(OWNER)` yaratiladi. Tizim kamida 12 belgili vaqtincha parol yaratadi.

4.  Vaqtincha parol javobda **bir marta** qaytadi va adminga "Nusxa olish" tugmasi bilan ko‘rsatiladi; qayta ko‘rsatilmaydi. Bazada faqat hash (bcrypt) saqlanadi; parol log, audit yozuvi va xato jurnaliga tushmaydi.

### 3.7.2. Parol topshirish, tiklash, xodim qo‘shish, egani almashtirish

- **Parolni tiklash:** admin do‘kon a’zosi uchun yangi vaqtincha parol yaratadi; `mustPasswordChange = true`, a’zoning barcha sessiyalari bekor qilinadi. Parol yana faqat bir marta ko‘rsatiladi.
- **Xodim qo‘shish:** do‘kon egasi (yoki admin) xodim uchun login, ism, ixtiyoriy telefon, do‘kondagi rol (MANAGER/STAFF) va ruxsatlarni kiritadi; tizim vaqtincha parol yaratadi va BIR MARTA ko‘rsatadi (`POST /manage/shops/:id/members`). Ega xodim parolini tiklaydi (`…/members/:userId/reset-password`, egasining o‘zi tiklanmaydi), ruxsatlarni o‘zgartiradi va xodimni chiqaradi. Xodim (MANAGER/STAFF) boshqalarni qo‘sha olmaydi.
- **Egani almashtirish:** admin mavjud a’zoni OWNER qiladi; eski OWNER avtomatik MANAGER bo‘ladi. Har do‘konda aynan bitta OWNER (partial unique).
- **Belgilar:** "Rasmiy diler", "Sertifikatli montajchi", "Litsenziya" kabi belgilarni faqat admin qo‘yadi va olib tashlaydi (do‘kon yuborolmaydi, tekshiruv navbati yo‘q).

### 3.7.3. To‘xtatish va qayta yoqish

- **To‘xtatish** (ACTIVE → SUSPENDED): sabab majburiy. Ta’siri: do‘kon public ro‘yxat, xarita va katalogdan yashiriladi; yangi so‘rov qabul qilmaydi; ochiq so‘rovlar bo‘yicha mijozlarga "Do‘kon vaqtincha faol emas" xabari ketadi; a’zolar kabinetga faqat o‘qish rejimida kiradi.

- **Qayta yoqish** (SUSPENDED → ACTIVE): sabab bilan.

Shop holatlari: ACTIVE ⇄ SUSPENDED (admin). `DRAFT` va `PENDING_REVIEW` faqat v3.0 dan qolgan eski yozuvlar uchun; yangi do‘kon ularga tushmaydi. Jadvalda yo‘q o‘tish — 409 `INVALID_STATUS_TRANSITION`.

# 4. UI/UX

Foydalanuvchi interfeysi, dizayn tizimi, ekranlar va animatsiyalar — ushbu hujjatning **II qismida** (U0–U22). I qism matnidagi "4.x" havolalari quyidagi II qism bo'limlariga ishora qiladi:

| I qismdagi havola | Mazmuni | II qismda |
|---|---|---|
| 4.2 | UI atamalar lug'ati | U3 |
| 4.3 | Son, pul, sana va birlik formatlari | U4 |
| 4.4, 4.19 | Bilimlar markazi | U7.6 |
| 4.6.2 | Mobil Batafsil hisob | U8.2 |
| 4.6.3 | Maishiy texnika va tayyor shablonlar | U8.5 |
| 4.7 | Tez hisob javobi va natija ierarxiyasi | U8.1, U8.10 |
| 4.9 | Elektr uzilishi kalkulyatori | U8.13 |
| 4.10 | Xarita UX, mobil poligon chizish | U7.3, U8.4 |
| 4.11 | Do'kon belgilari (faqat admin belgilaydi; do'kon panelida sertifikat yo'q) | U7.4, U12.11 |
| 4.12 | Takliflarni solishtirish | U9.6 |
| 4.14 | Telegram orqali do'kon amallari | U14.3 |
| 4.18 | PDF va QR-kod | U15 |
| 4.20 | Yordam markazi | U7.7, U12.9 |

# 5. Repozitoriy va frontend kod arxitekturasi (GetMaster bo'yicha)

## 5.1. Repozitoriy tuzilmasi

Bitta repozitoriy: backend ildizda (NestJS, pnpm), frontend `apps/web` da (Vite, npm). Node.js 22 LTS, TypeScript strict. GetMaster'dagi kabi monorepo vositasi (Turborepo) va alohida `packages/` ishlatilmaydi — umumiy tiplar backend'dan `apps/web/src/types` ga generatsiya qilinadi (OpenAPI).

```
/
├── src/                      # NestJS API (modular monolith)
│   ├── main.ts, app.module.ts, app.setup.ts   # global prefix /api/v1, pipe, filter, interceptor
│   ├── config/               # *.config.ts + validation.ts (env tekshiruvi)
│   ├── common/               # guards, decorators, filters, interceptors, pipes, constants (error-codes), utils (panel)
│   ├── infrastructure/       # database (Prisma), redis, queue (BullMQ + outbox), storage (S3), scanner (ClamAV),
│   │                         # sms, mail, telegram, metrics (Prometheus), solar (PVGIS/NASA), maps (Esri)
│   └── modules/              # domen modullari (5.4)
├── prisma/                   # schema.prisma, migrations/, seed.ts
├── apps/web/                 # Vite + React — 4 ta panel bitta kod bazasida
├── infrastructure/           # docker (compose, Dockerfile), terraform, backup skriptlari
├── scripts/                  # start-all.sh, seed, build, prerender
├── tests/                    # unit, integration, e2e (vitest)
└── docs/                     # shu hujjat, API, runbooklar
```

Worker: alohida jarayon emas, GetMaster'dagi kabi BullMQ processorlari API ichida `QueueModule` orqali ishlaydi; production'da `WORKER_ONLY=true` bilan alohida konteyner sifatida ham ko'tariladi (bitta image, ikki rol).

## 5.2. Ilovalar va portlar

`apps/web` bitta kod bazasi, **to'rtta Vite rejimi**. Har panel o'z portida (dev) va o'z yo'lida (production), o'z sessiya cookie'si bilan ishlaydi.

| Ilova | Vite rejimi | Dev port | Production | Kim uchun |
|---|---|---|---|---|
| Bosh sayt | (rejimsiz) | 5170 | `quyosh.uz/` | Faqat mijoz — tushuntirish va mijoz paneliga yo'naltirish (U7.1) |
| Mijoz paneli | `customer` | 5173 | `quyosh.uz/mijoz` | Guest va CUSTOMER — kalkulyator, xarita, katalog, hisoblar, takliflar |
| Do'kon paneli | `shop` | 5174 | `quyosh.uz/dokon` | SHOP (ShopMember) |
| Admin paneli | `admin` | 5175 | `admin.quyosh.uz` (ichki) | ADMIN, Super Admin |
| API | NestJS | 3000 | `quyosh.uz/api/v1` | — |

```mermaid
flowchart LR
  V[Tashrif buyuruvchi] --> S["Bosh sayt /"]
  S -- "Hisoblab ko'rish" --> C["Mijoz paneli /mijoz/kalkulyator (guest)"]
  C -- "saqlash / taklif so'rash" --> CL[Kirish: telefon + OTP]
  D["Do'kon paneli /dokon (bosh saytdan havola yo'q)"] --> DL[Kirish: telefon + parol, OTP yo'q; birinchi kirishda parol almashtirish]
  A[Admin] --> AL["Admin /login (parol + 2FA)"]
  CL --> API[(NestJS API /api/v1)]
  DL --> API
  AL --> API
```

`vite.config.ts` GetMaster bo'yicha: rejim → `VITE_APP_ROLE`, panelga mos `<title>` va `theme-color`, `data-panel` atributi (`CUSTOMER` / `SHOP` / `ADMIN`), production'da CSP meta, px → rem PostCSS plagini. Bitta `.env` loyiha ildizida (`envDir`).

## 5.3. apps/web tuzilmasi

```
apps/web/src/
├── router/        router.tsx (portalRouter + panelRouter), RoleGuard, ProtectedRoute, RootShell
├── layouts/       AuthLayout (split-screen kirish), MainLayout (sidebar + header + mobil nav)
├── pages/
│   ├── landing/   PortalPage + film/ (FilmStage.ts, ScrollFilm.tsx), fx/ (ShaderBackground, Marquee, Statement), journey/
│   ├── auth/      LoginPage, RegisterPage, OtpPage
│   ├── calculator/ QuickPage, DetailedPage, ResultPage, OutagePage, FinancingPage, SharePage
│   ├── map/, shops/, products/, knowledge/, support/
│   ├── customer/  sites, calculations, quotes, installations, profile
│   ├── shop/      dashboard, requests, quotes, installations, catalog, branches, portfolio, reviews, analytics, members, subscription, widget
│   └── admin/     (GetMaster admin sahifalari + Quyosh: tariffs, calc-settings, catalog-moderation, shops, devops)
├── features/<domen>/   services (API), hooks (React Query), components, types
├── components/    ui/ (Button, Input, Select, Modal, Toast, Skeleton…), layout/ (Sidebar, PanelHeader, MobileNavigation, nav-items.ts), common/, charts/, map/, signature/ (SunArc, StepArc, RangeBar, EnergyFlow, PanelLayer)
├── lib/           env.ts, api-client.ts, format.ts, motion/ (tokens.ts, gsap.ts)
├── store/         Zustand (auth, ui, calculator-draft)
├── i18n/          uz, oz, ru
└── styles/        tokens.css, global.css, cards.css, polish.css
```

## 5.4. Marshrutlar (route map)

GetMaster'dagi kabi: `portalRouter` (bosh sayt) va `panelRouter` (panellar) — `env.appRole` bo'yicha tanlanadi. Panel ildizi landing ko'rsatmaydi: kirmagan foydalanuvchi — mijoz panelida (`/mijoz`) kalkulyatorga, do'kon va admin panelida `/login` ga; kirgan — menyudagi birinchi bo'limga.

| Panel | Marshrutlar |
|---|---|
| Bosh sayt | `/`, `/shartlar`, `/maxfiylik` |
| Umumiy (har panelda) | `/login`, `/register`, `/otp`, `/bildirishnomalar`, `/sozlamalar[/:section]` |
| Mijoz — guest ham ko'radi | `/mijoz/kalkulyator`, `/mijoz/kalkulyator/batafsil?qadam=1..6`, `/mijoz/natija/:id`, `/mijoz/ulashish/:token`, `/mijoz/uzilish`, `/mijoz/kredit`, `/mijoz/xarita`, `/mijoz/dokonlar`, `/mijoz/dokonlar/:slug`, `/mijoz/mahsulotlar`, `/mijoz/mahsulotlar/:slug`, `/mijoz/solishtirish`, `/mijoz/bilim/:category/:slug`, `/mijoz/yordam` |
| Mijoz — kirish shart | `/mijoz/hisoblar`, `/mijoz/obyektlar[/:id]`, `/mijoz/sorovlar[/:id]`, `/mijoz/takliflar/:id`, `/mijoz/montaj/:id`, `/mijoz/tizimim`, `/mijoz/chat`, `/mijoz/sevimlilar`, `/mijoz/murojaatlar`, `/mijoz/profil[/:section]` |
| Do'kon | `/dokon` (bosh panel), `/dokon/sorovlar[/:id]`, `/dokon/takliflar[/:id]`, `/dokon/montajlar[/:id]`, `/dokon/katalog`, `/dokon/import`, `/dokon/filiallar`, `/dokon/xizmatlar`, `/dokon/portfolio`, `/dokon/sharhlar`, `/dokon/vidjet`, `/dokon/analitika`, `/dokon/xodimlar` (kirish: `/login`; birinchi kirishda majburiy parol almashtirish) |
| Admin | `/admin`, `/admin/hisobot`, `/admin/devops`, `/admin/foydalanuvchilar[/:id]`, `/admin/adminlar`, `/admin/dokonlar[/:id]`, `/admin/katalog`, `/admin/sharhlar`, `/admin/shikoyatlar`, `/admin/montajlar`, `/admin/tariflar`, `/admin/eksport`, `/admin/moliyalashtirish`, `/admin/kalkulyator`, `/admin/malumotnomalar`, `/admin/kontent`, `/admin/bosh-sahifa`, `/admin/yordam`, `/admin/obunalar`, `/admin/siyosatlar`, `/admin/audit`, `/admin/errorlar`, `/admin/profil` |

Bir nechta do'konga a'zo foydalanuvchi uchun do'kon paneli headerida do'kon almashtirgich; tanlangan `shopId` URL'da emas, Zustand'da va `X-Shop-Id` header'da yuboriladi (API yo'li baribir `/manage/shops/:shopId/*`, TZ 9.3).

## 5.5. Frontend qoidalari

- UI komponentlar biznes hisob-kitobini bajarmaydi; hisob har doim serverda.
- Server state — TanStack React Query; client state — Zustand; formalar — react-hook-form + zod (faqat frontend validatsiyasi; server — class-validator, 6.3).
- API client (GetMaster `lib/api-client.ts` bo'yicha): access token xotirada, 401 da bitta `/auth/refresh` (in-flight promise ulashiladi), xato `errorCode` bo'yicha i18n matniga o'giriladi (9.2).
- Pul, son, sana va birliklar faqat `lib/format.ts` orqali.
- Har sahifada majburiy holatlar: skeleton, empty, validation, 401, 403, 404, 409, expired, 500 (qayta urinish), offline banner.
- **SEO:** SPA bo'lgani uchun public sahifalar (bosh sayt, do'kon profili, mahsulot, bilimlar markazi) build vaqtida `scripts/prerender.mjs` (Playwright) bilan statik HTML'ga prerender qilinadi; `sitemap.xml` (3 til, hreflang), `robots.txt`, schema.org (LocalBusiness, Product, AggregateRating). Do'kon/mahsulot o'zgarsa prerender navbatga qo'yiladi (`prerender-refresh` jobi).
- Secrets faqat serverda; frontend'ga faqat `VITE_` prefiksli oshkor qiymatlar.
- Brauzerlar: Chrome, Edge, Firefox, Samsung Internet — oxirgi 2 versiya; Safari iOS 15+; Android 8+.
- PWA: manifest va push service worker (GetMaster `push-sw.js`); API javoblari keshlanmaydi.

## 5.6. Bosh sayt — texnik talablar

Bosh saytning dizayni, bo‘limlari va 3D animatsiyalari — II qism U7.1 va U6.9. Bu bo‘lim texnik shartlarni belgilaydi. Bosh sayt GetMaster `PortalPage` dvigateli asosida quriladi va unda funksional qism (kalkulyator, katalog, xarita) yo‘q — ular mijoz panelida.

- **Kontent boshqaruvi:** bosh sahifa bloklari (hero matni, CTA, ishonch raqamlari, "qanday ishlaydi" qadamlari, FAQ, hamkorlar logotiplari, video) admin paneldan 3 tilda tahrirlanadi: SiteBlock va MediaAsset modellari, nashrdan oldin preview, versiya va audit. Ishonch raqamlari (do‘konlar soni, montajlar soni) qo‘lda yozilmaydi — API’dan hisoblanadi.

- **Sharh va iqtiboslar:** bosh sahifadagi mijoz fikrlari faqat PUBLISHED sharhlardan (13.4) tanlanadi; to‘qima iqtibos taqiqlangan.

- **Render:** bosh sayt build vaqtida prerender qilinadi (5.5, SEO); bloklar SiteBlock API'dan olinadi, admin nashr qilganda `prerender-refresh` jobi ishga tushadi.

### 5.6.1. Media va 3D talablari

1.  Bosh saytda fotosurat va video ishlatilmaydi; vizuallar Three.js, shader, SVG, CSS (U1.4, U7.1.2).
2.  Three.js, GSAP va Lenis faqat bosh sayt chunk'ida, lazy-load; 3D sahna LCP elementi emas (hero sarlavhasi birinchi kadrda chiziladi).
3.  Sahna ekrandan chiqqanda va tab yashirilganda render to‘xtaydi; telefonda DPR ≤ 1,25; WebGL bo‘lmasa statik SVG kadr; `prefers-reduced-motion` da film o‘rniga statik kadrlar ro‘yxati.
4.  Tushuntiruvchi videolar (bilimlar markazi) panel ichida: click-to-play, HLS, 3 tilda subtitr, o‘z storage'imizda; FFmpeg `video-transcode` jobi.

### 5.6.2. Unumdorlik va sifat

- Mobil Lighthouse: Performance ≥ 85 (3D sahna bilan), Accessibility ≥ 95, SEO ≥ 95; INP ≤ 200 ms, CLS ≤ 0,05 (video va animatsiyalar bilan birga).

- Bosh saytning boshlang‘ich JS hajmi (3D chunk'siz) ≤ 180 KB gzip; Three.js chunk ≤ 200 KB gzip, birinchi ekrandan keyin yuklanadi.

- Skroll animatsiyalari GSAP ScrollTrigger + Lenis (GetMaster `lib/motion/gsap.ts`, `useSmoothScroll`) yoki IntersectionObserver bilan.

# 6. Backend kod arxitekturasi (GetMaster bo‘yicha)

## 6.1. Modul tuzilmasi (GetMaster bo'yicha)

Har domen moduli `src/modules/<modul>/` da, GetMaster naqshida: `<modul>.module.ts`, `<modul>.controller.ts`, `<modul>.service.ts`, `dto/` (class-validator), kerak bo'lsa `<entity>-state-machine.ts`, qo'shimcha servislar (`*-stats.service.ts`, `*-reminder.service.ts`) va `*.spec.ts`.

| Modul | Manba | Mazmuni |
|---|---|---|
| `auth`, `otp`, `users`, `avatar` | GetMaster | Ro'yxatdan o'tish, kirish, OTP, sessiyalar, profil (6.4) |
| `admin` (+ `admin-devops`, `admin-users`, `admin-audit-notifier`) | GetMaster | Admin, huquqlar, delegatsiya, DevOps (TZ 19.1) |
| `media`, `legal`, `audit`, `error-log`, `mail`, `push`, `notification` | GetMaster | Umumiy xizmatlar |
| `communication` | GetMaster | So'rov va montaj yozishmalari (TZ 4.13) |
| `subscription` | GetMaster naqshi | Do'kon obuna rejalari va cheklari |
| `trust` | GetMaster naqshi | Do'kon verifikatsiyasi, sertifikatlar (TZ 4.11) |
| `complaint`, `dispute`, `trust-safety` | GetMaster naqshi | Shikoyat, montaj e'tirozi, choralar |
| `review` | GetMaster naqshi | Faqat tasdiqlangan montajdan keyin sharh (TZ 13.4) |
| `geo` | GetMaster tuzilmasi | Esri adapteri, tile/geocoding proksi, kvota hisobi (TZ 12.1) |
| `public` | GetMaster | Bosh sayt statistikasi (`/public/stats`) |
| `shop`, `shop-member`, `shop-invitation`, `branch` | Yangi | Do'kon, a'zolar, filiallar, xizmat hududi, admin yaratishi (TZ 3.5, 3.7) |
| `catalog`, `product-model`, `import` | Yangi | Katalog, ProductModel, ommaviy import |
| `site` | Yangi | Mijoz obyektlari va maydon poligonlari |
| `calculator` (+ `engine/`) | Yangi | Hisob, ssenariylar, PDF, ulashish (TZ 11) |
| `tariff`, `export-rule`, `financing`, `reference` | Yangi | Tariflar, eksport qoidalari, kredit mahsulotlari, ma'lumotnomalar |
| `quote-request`, `quote`, `installation` | GetMaster `problem-requests`/`offers`/`orders` naqshi | Taklif so'rovi, taklif, montaj (TZ 13) |
| `content`, `site-block`, `support` | Yangi | Bilimlar markazi, bosh sayt bloklari, yordam markazi |
| `widget` | Yangi | Embed kalkulyator (TZ 4.15) |

Hisob-kitob dvigateli — `src/modules/calculator/engine/` (sof TypeScript, NestJS/Prisma/HTTP'ga bog'liq emas):

```
src/modules/calculator/engine/
├── types.ts
├── geometry.ts            # qiyalik tuzatishi, panel joylashuvi
├── sizing.ts              # tizim hajmi, invertor/akkumulyator tanlash
├── production-estimator.ts
├── load-profile.ts        # iste'mol profili, maishiy texnika
├── energy-balance.ts      # soatlik balans, akkumulyator simulyatsiyasi
├── tariff-engine.ts
├── financial-model.ts     # payback, 25 yil, NPV, IRR, LCOE
├── financing.ts
├── outage.ts
├── compatibility.ts
└── scenario-builder.ts
```

Tashqi ma'lumot provayderlari `src/infrastructure/solar/` (PVGIS asosiy, NASA POWER zaxira) va `src/infrastructure/maps/` (Esri) da, interfeys orqali.

## 6.2. Backend qatlamlari

| **Qatlam**           | **Mas’uliyat**                                                                            | **Qilmasligi kerak**                                    |
|----------------------|-------------------------------------------------------------------------------------------|---------------------------------------------------------|
| Controller           | HTTP route, DTO qabul qilish, status code va response                                     | Prisma query va biznes formulalar                       |
| DTO (class-validator)| Input type va format validatsiyasi                                                        | Databasega bevosita yozish                              |
| Service / use case   | Use-case tartibi, ruxsat, tranzaksiya, audit va outbox yozish                             | HTTP-specific logikani domain’ga aralashtirish          |
| Domain (engine)      | Energiya, tarif, moliya, status qoidalari                                                 | HTTP, Prisma yoki UI kutubxonalariga bog‘lanish         |
| Repository           | Prisma orqali ma’lumot olish/saqlash; geo so‘rovlar uchun alohida GeoRepository (raw SQL) | Ruxsat tekshiruvini tashlab ketish                      |
| Provider adapter     | Solar, geocoding, email, SMS, Telegram, payment, valyuta kursi                            | Providerning xususiy formatini butun kodga tarqatish    |
| Worker               | BullMQ joblar, outbox relay, cron                                                         | Bir jobni qayta ishlaganda takroriy zararli amal qilish |

## 6.3. Umumiy backend qatlamlari

- ConfigModule: `src/config/validation.ts` (class-validator) bilan environment validatsiyasi; required secret yo‘q bo‘lsa yoki production'da xavfli qiymat (`OTP_DEV_ECHO=true`, `AUTH_COOKIE_SECURE=false`) bo‘lsa app ishga tushmaydi (GetMaster).

- PrismaModule: PrismaClient lifecycle, graceful shutdown, soft-delete client extension (6.6).

- Validatsiya: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) va class-validator DTO'lari — noma’lum maydon 400 VALIDATION_ERROR qaytaradi (GetMaster `app.setup.ts`).

- Global exception filter: stack trace’ni oshkor qilmasdan standart error response (9.2).

- Request ID middleware: X-Request-Id (kelsa qabul qilinadi, bo‘lmasa UUID yaratiladi), log va javobga qo‘shiladi.

- Guard zanjirlari (har bir controller aniq bittasini ishlatadi): Public — OptionalAuthGuard; Mijoz — AuthGuard + OwnershipService; Do‘kon — AuthGuard → ShopMembershipGuard (path’dagi shopId bo‘yicha a’zolik) → ShopPermissionGuard (@RequireShopPermission(...)); Admin — AuthGuard → RolesGuard (ADMIN) → PermissionsGuard (`adminPermissions`, superadmin uchun hammasi). PlatformRoleGuard hech qachon ShopMember’ga, ShopPermissionGuard hech qachon User.role ga qaramaydi. Har bir controller’da guard zanjiri bo‘lmasa ilova ishga tushmaydi (boot-time tekshiruv).

- Rate limiting: GetMaster `RateLimitGuard` (Redis, IP + foydalanuvchi, bosqichma-bosqich blok — escalation ladder), qiymatlar 10.3-jadvalda.

- Idempotency interceptor (9.4).

- OpenAPI: barcha endpoint, sxema, auth talabi, response va error kodlari.

## 6.4. Autentifikatsiya arxitekturasi (GetMaster bo'yicha, yakuniy qaror)

`auth`, `otp`, `users` modullari GetMaster'dan olinadi. Asosiy qoidalar:

| Parametr | Qiymat |
|---|---|
| Kirish | Telefon (+998) + parol. Ro'yxatdan o'tish va ishonchsiz qurilmadan kirishda OTP. Email ixtiyoriy (OTP email orqali ham kelishi mumkin) |
| Do'kon kirishi (v3.1) | Telefon + parol, **OTP yo'q**. Hisobni admin yaratadi (3.7); birinchi kirishda vaqtincha parolni almashtirish majburiy (`User.mustPasswordChange`). Ro'yxatdan o'tish, Google va "Parolni unutdim" do'kon panelida yo'q — parolni admin tiklaydi. Login blok, rate-limit, panel bo'yicha sessiya va refresh cookie boshqa panellardagidek |
| Vaqtincha parol | Tizim yaratadi (≥ 12 belgi, kriptografik tasodifiy), adminga bir marta ko'rsatiladi, bazada faqat bcrypt hash, log/audit/xatolar jurnaliga yozilmaydi; `mustPasswordChange=true` bo'lganda do'kon API'si faqat `GET /users/me`, `POST /users/me/password/first` va chiqish uchun ochiq (qolgani 403 `PASSWORD_CHANGE_REQUIRED`) |
| Admin kirishi | Telefon + parol → 2FA OTP (`twoFactorEnabled`, superadmin boshqaradi). Birinchi admin `ADMIN_PHONE` / `ADMIN_PASSWORD` seed'dan (parol ≥ 12 belgi) |
| Access token | JWT, 900 s, faqat xotirada (JS o'zgaruvchisi), `Authorization: Bearer` |
| Refresh token | HttpOnly, Secure, SameSite=Lax cookie; **har panel o'z cookie nomi bilan** (`authCookieNames(panel)`); rotation va reuse detection (`familyId`) |
| Sessiyalar | `DeviceSession.panel` — panel bo'yicha alohida; bir paneldan chiqish boshqasiga ta'sir qilmaydi; max 2 faol qurilma har panelda (`MAX_ACTIVE_DEVICES`) |
| Ishonchli qurilma | 24 soat (`DEVICE_TRUST_SECONDS`) — shu vaqtda qayta OTP so'ralmaydi |
| OTP | 6 raqam, TTL 300 s, qayta yuborish 120 s, 3 ta so'rov / soat / telefon, 5 urinish |
| OTP yetkazish | Email (bo'lsa) → SMS (ulangan bo'lsa); Telegram operator chatiga ichki nusxa |
| **OTP test rejimi** | `OTP_DEV_ECHO=true` va `OTP_DEV_ECHO_AUTH=true` (faqat `NODE_ENV≠production`): kod API javobida qaytadi va kirish ekranida sariq "Test rejimi" kartasida ko'rsatiladi (U7.2). Production'da bu qiymatlar yoqilsa ilova ishga tushmaydi |
| Login blok | 10 xato / 10 daqiqa → 120 s blok; rate-limit 30 / 15 daqiqa |
| Parol | ≥ 8 belgi, bcrypt cost 12 |
| CSRF | Access token cookie'da emas, shuning uchun alohida CSRF token kerak emas; refresh endpointi SameSite=Lax va `Origin` tekshiruvi bilan himoyalanadi |

Rollar (`UserRole[]`): `CUSTOMER`, `SHOP`, `ADMIN`. Super Admin = `ADMIN` + `isSuperAdmin=true`. Do'kon ichidagi rol (`OWNER/MANAGER/STAFF`) — `ShopMember` orqali (TZ 2). Do'kon paneliga kirish uchun `SHOP` roli **va** kamida bitta `ShopMember` kerak; hisobni faqat admin yaratadi (3.7).

## 6.5. Background jobs va outbox

- Queue: BullMQ (Redis). Har bir job turi alohida queue; attempts, exponential backoff va failed jobs monitoringi.

- Davriy joblar BullMQ repeatable jobs orqali, aniq jobId bilan (bir nechta worker nusxasida ham bitta marta ishlaydi).

- Transactional outbox: biznes yozuvi va OutboxEvent bitta DB tranzaksiyasida yoziladi. Worker’dagi relay har 1 s da qayta ishlanmagan eventlarni FOR UPDATE SKIP LOCKED bilan oladi va tegishli queue’ga qo‘yadi. Bildirishnoma, analytics eventi va tashqi integratsiyalar faqat outbox orqali.

- Har bir job processori idempotent: idempotencyKey (masalan notification:{eventId}:{channel}) bo‘yicha qayta bajarilish tekshiriladi.

## 6.6. Ma’lumot konvensiyalari

- Barcha jadvallarda id UUID (v7), createdAt timestamptz, updatedAt timestamptz.

- Arxivlash/soft delete yagona usul bilan: archivedAt timestamptz NULL. Prisma client extension archivedAt IS NULL filtrini avtomatik qo‘shadi; arxivlanganlarni olish uchun faqat aniq includeArchived opsiyasi. \*\*Extension \$queryRaw/\$executeRaw ga ta’sir qilmaydi\*\*, shuning uchun GeoRepository’dagi har bir raw SQL so‘rov arxiv/holat shartini qo‘lda yozadi (archived_at IS NULL, ServiceArea.active = true, Shop.status = 'ACTIVE', ShopBranch.status = 'ACTIVE'). Buning uchun umumiy SQL fragmentlari (activeSiteFilter, activeShopGeoFilter) ishlatiladi va har bir geo so‘rov uchun "arxivlangan yozuv qaytmaydi" integration testi majburiy.

- Vaqt bo‘yicha jamlash: DBdagi barcha kunlik/oylik agregatsiyalar (analitika, dashboard, hisobotlar, "oy bo‘yicha" filtrlar) date_trunc('month', col AT TIME ZONE 'Asia/Tashkent') ko‘rinishida bajariladi; UTC bo‘yicha jamlash taqiqlangan. Davr filtri (from/to) Asia/Tashkent kalendar kunlari sifatida qabul qilinadi va UTC chegaralarga o‘giriladi. Kalkulyatorning soatlik qatori allaqachon Asia/Tashkent vaqtida (11.6), shuning uchun tarifning oylik pog‘onalari to‘g‘ri oyga tushadi.

- Bir vaqtda tahrirlanadigan yozuvlarda optimistic locking: version Int (Quote, ShopProduct, ProductOffer, TariffSchedule, CalculationSettings, FinancingProduct, ShopBranch). PATCH so‘rovi version yuboradi; mos kelmasa 409 VERSION_CONFLICT.

- Audit yozuvi servis qatlamida, biznes o‘zgarish bilan bitta tranzaksiyada yoziladi (interceptor emas, chunki before/after kerak).

# 7. Database — to‘liq model spetsifikatsiyasi

Quyidagi maydonlar mantiqiy spetsifikatsiya. Prisma schema’da nomlar camelCase, jadval nomlari snake_case (@@map), enumlar UPPER_SNAKE_CASE. Har bir model 6.6-bo‘limdagi umumiy maydonlarga ega (alohida yozilmagan).

## 7.1. Aniqlik va yaxlitlash (yakuniy qaror)

| **Qiymat turi**                                      | **DB turi**   | **Izoh**                      |
|------------------------------------------------------|---------------|-------------------------------|
| Pul summasi                                          | Decimal(18,2) | UZS va USD                    |
| Narx stavkasi (so‘m/kWh, foiz stavka, valyuta kursi) | Decimal(18,6) |                               |
| Energiya                                             | Decimal(14,4) | kWh                           |
| Quvvat                                               | Decimal(12,4) | kW; panel quvvati W butun son |
| Foiz/koeffitsient                                    | Decimal(7,6)  | 0..1 oralig‘ida saqlanadi     |
| Maydon                                               | Decimal(12,2) | m²                            |

- Oraliq hisoblar to‘liq aniqlikda (decimal.js, 34 xona) bajariladi. Yaxlitlash faqat yakuniy saqlanadigan va ko‘rsatiladigan qiymatlarda, ROUND_HALF_UP usulida.

- So‘m UIda butun songacha yaxlitlanib ko‘rsatiladi; DBda 2 xona saqlanadi.

- Quote qatori: lineTotal = round2(quantity × unitPrice); subtotal — yaxlitlangan qatorlar yig‘indisi.

## 7.2. Foydalanuvchi va auth modellari

| **Model**              | **Maydonlar**                                                                                                                                                                                                                                                                     | **Indeks/constraint**                                                                                          |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| User                   | id; fullName; email nullable; emailVerifiedAt nullable; phone nullable (E.164); phoneVerifiedAt nullable; passwordHash nullable; roles (UserRole[]: CUSTOMER/SHOP/ADMIN); isSuperAdmin; adminPermissions[]; status (ACTIVE/BLOCKED/DELETED); accountType (INDIVIDUAL/BUSINESS); locale (uz/oz/ru); twoFactorEnabled; mustPasswordChange boolean (default false; admin yaratgan/tiklagan vaqtincha parolda true) | email unique (partial, NOT NULL); phone unique (partial); email yoki phone’dan kamida bittasi majburiy (CHECK) |
| Organization           | id; userId; name; stir (9 raqam); address nullable                                                                                                                                                                                                                                | userId unique                                                                                                  |
| RefreshSession         | id; userId; panel (CUSTOMER/SHOP/ADMIN); deviceId; tokenHash; familyId; expiresAt; revokedAt; userAgentSummary; ipHash; lastUsedAt                                                                                                                                                                                       | tokenHash unique; userId index; raw token saqlanmaydi                                                          |
| VerificationCode       | id; target (phone/email); purpose (REGISTER/LOGIN/RESET/CHANGE_CONTACT); codeHash; attempts; expiresAt; consumedAt                                                                                                                                                                | target+purpose+createdAt index                                                                                 |
| PasswordResetToken     | id; userId; tokenHash; expiresAt; usedAt                                                                                                                                                                                                                                          | tokenHash unique                                                                                               |
| NotificationPreference | id; userId; type; channelsJson (IN_APP/EMAIL/SMS/TELEGRAM)                                                                                                                                                                                                                        | unique(userId,type)                                                                                            |
| TelegramLink           | id; userId; chatId; linkedAt; active                                                                                                                                                                                                                                              | userId unique; chatId unique                                                                                   |
| TelegramCallbackToken  | id; userId; action; payloadJson; tokenHash; expiresAt; usedAt                                                                                                                                                                                                                     | tokenHash unique; expiresAt index                                                                              |

## 7.3. Do‘kon modellari

| **Model**                | **Maydonlar**                                                                                                                                                                                                                                                                                                                                   | **Indeks/constraint**                                                                                   |
|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Shop                     | id; slug; name; description; logoFileId; coverFileId; stir; verificationStatus (NOT_SUBMITTED/PENDING/VERIFIED/REJECTED); status (DRAFT/PENDING_REVIEW/ACTIVE/SUSPENDED); createdSource (ADMIN; SELF faqat v3.0 dan qolgan yozuvlar); createdByUserId nullable; suspendedAt nullable; suspendReason nullable; phone; email; avgResponseMinutes nullable; ratingAvg; ratingCount | slug unique; status index                                                                               |
| ShopMember               | id; shopId; userId; memberRole (OWNER/MANAGER/STAFF); permissions text\[\]                                                                                                                                                                                                                                                                      | unique(shopId,userId); partial unique(shopId) WHERE memberRole=OWNER                                    |
| ShopVerificationDocument (eski, v3.1 da yangi yozuv yaratilmaydi) | id; shopId; fileId; docType (REGISTRATION/LICENSE/OTHER); status (PENDING/ACCEPTED/REJECTED); reviewerId nullable; reviewedAt; reason                                                                                                                                                                                                           | shopId index                                                                                            |
| ShopCertification (v3.1: faqat admin yaratadi, darhol APPROVED; fileId ixtiyoriy) | id; shopId; certType (OFFICIAL_DEALER/CERTIFIED_INSTALLER/LICENSE); brand nullable (OFFICIAL_DEALER uchun majburiy); issuer; certNumber nullable; fileId; validFrom; validUntil nullable; status (PENDING/APPROVED/REJECTED/EXPIRED); reviewerId; reviewedAt; reason                                                                            | shopId/status index; validUntil index                                                                   |
| ShopBranch               | id; shopId; name; address; location geography(Point,4326); phone; openingHoursJson; holidayExceptionsJson; status; version                                                                                                                                                                                                                      | shopId index; GiST(location). Alohida latitude/longitude ustunlari yo‘q                                 |
| ServiceArea              | id; branchId; geom geography(MultiPolygon,4326); serviceTypes text\[\]; active                                                                                                                                                                                                                                                                  | GiST(geom); branchId index                                                                              |
| ShopProject (portfolio)  | id; shopId; title; city; systemPowerKw; systemType; completedAt; installationId nullable; description                                                                                                                                                                                                                                           | shopId index                                                                                            |
| ShopProjectImage         | id; projectId; fileId; sortOrder                                                                                                                                                                                                                                                                                                                | projectId index                                                                                         |
| QuoteTemplate            | id; shopId; name; itemsJson; defaultWarrantyText; defaultTermsText                                                                                                                                                                                                                                                                              | shopId index                                                                                            |
| WidgetConfig             | id; shopId; publicKey; allowedDomains text\[\]; themeJson; active                                                                                                                                                                                                                                                                               | publicKey unique                                                                                        |

## 7.4. Katalog modellari

| **Model**                     | **Maydonlar**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Indeks/constraint**                                                                                                         |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Category                      | id; parentId nullable; slug; nameI18n; descriptionI18n; attributeSchemaJson; active; sortOrder                                                                                                                                                                                                                                                                                                                                                                                                               | slug unique; parentId index                                                                                                   |
| ProductModel (yagona katalog) | id; categoryId; brand; model; slug; status (PENDING/APPROVED/REJECTED/MERGED); mergedIntoId nullable; nominalPowerW nullable; efficiencyPct nullable; widthMm; heightMm; weightKg; tempCoeffPmaxPctPerC; vocV; vmpV; iscA; impA; degradationPctPerYear; inverterAcKw; inverterMaxDcV; mpptMinV; mpptMaxV; mpptMaxCurrentA; batteryVoltageV; batteryCapacityKwh; batteryUsableDod; batteryChemistry; batteryCycles; warrantyMonths; specsJson (qolgan atributlar); datasheetFileId; proposedByShopId nullable | unique(brand,model); slug unique; categoryId/status index; filtr uchun ishlatiladigan ustunlarga B-tree indeks; specsJson GIN |
| ProductModelImage             | id; productModelId; fileId; altText; sortOrder                                                                                                                                                                                                                                                                                                                                                                                                                                                               | productModelId index                                                                                                          |
| ShopProduct                   | id; shopId; productModelId; description; status (DRAFT/ACTIVE/ARCHIVED); version                                                                                                                                                                                                                                                                                                                                                                                                                             | unique(shopId,productModelId); shopId/status index                                                                            |
| ProductOffer                  | id; shopProductId; branchId nullable; price Decimal; currency (UZS/USD); vatIncluded; stockStatus (IN_STOCK/ON_ORDER/OUT_OF_STOCK); quantity nullable; validFrom; validUntil nullable; version                                                                                                                                                                                                                                                                                                               | shopProductId/branchId/stockStatus index                                                                                      |
| Service                       | id; shopId; branchId nullable; serviceType (INSTALLATION/SITE_VISIT/AUDIT/MAINTENANCE/DELIVERY); pricingModel (FIXED/FROM/PER_KW/PER_UNIT/QUOTE_REQUIRED); price nullable; currency; descriptionI18n; warrantyMonths nullable; active                                                                                                                                                                                                                                                                        | shopId/serviceType/active index                                                                                               |
| ExchangeRate                  | id; currency (USD); rateToUzs Decimal(18,6); rateDate (date); source; fetchedAt                                                                                                                                                                                                                                                                                                                                                                                                                              | unique(currency,rateDate)                                                                                                     |
| ImportJob                     | id; shopId; fileId; status (UPLOADED/VALIDATED/APPLIED/FAILED); rowCount; errorCount; errorsFileId nullable; appliedAt                                                                                                                                                                                                                                                                                                                                                                                       | shopId/createdAt index                                                                                                        |

## 7.5. Mijoz obyektlari va hisob modellari

| **Model**           | **Maydonlar**                                                                                                                                                                                                                                                                                                                                                                                                            | **Indeks/constraint**                                                                                                      |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| CustomerSite        | id; userId; title; siteType (HOUSE/BUSINESS/WAREHOUSE/GARAGE/OTHER); address; location geography(Point,4326); regionCode; districtCode; notes nullable; archivedAt                                                                                                                                                                                                                                                       | userId index; GiST(location)                                                                                               |
| SiteArea            | id; siteId; name; areaType (ROOF/GROUND/CARPORT); roofShape (FLAT/PITCHED); polygon geometry(Polygon,4326); projectedAreaM2; surfaceAreaM2; usableFactor; usableAreaM2; azimuthDeg nullable; tiltDeg nullable; shadingLevel (NONE/LIGHT/HEAVY); obstacleInfoJson                                                                                                                                                         | GiST(polygon); siteId index                                                                                                |
| SolarDataset        | id; provider (PVGIS/NASA_POWER/DEFAULT); cellKey; tiltBucket; azimuthBucket; database; datasetVersion; objectKey (normallashgan 1 kWp soatlik qator, gzip); annualYieldKwhPerKwp; monthlyYieldJson; fetchedAt; expiresAt; status (FRESH/STALE/FAILED)                                                                                                                                                                    | unique(provider,cellKey,tiltBucket,azimuthBucket,database)                                                                 |
| TariffSchedule      | id; regionCode; customerType (HOUSEHOLD/LEGAL); title; billingPeriod (MONTH); fixedChargeMonthly Decimal nullable; touEnabled; sourceUrl; verifiedAt; verifiedBy; effectiveFrom; effectiveUntil nullable; status (DRAFT/PUBLISHED/ARCHIVED); version                                                                                                                                                                     | region/customerType/effective dates/status index; bir hudud+tur uchun effective davrlar kesishmaydi (exclusion constraint) |
| TariffTier          | id; scheduleId; seasonMonths int\[\] (bo‘sh — butun yil); touPeriod (ALL/DAY/NIGHT); minKwh; maxKwh nullable; ratePerKwh Decimal(18,6); currency; notes                                                                                                                                                                                                                                                                  | scheduleId index; bir season+touPeriod ichida oraliqlar kesishmaydi                                                        |
| TouPeriod           | id; scheduleId; touPeriod (DAY/NIGHT); startHour; endHour                                                                                                                                                                                                                                                                                                                                                                | scheduleId index                                                                                                           |
| ExportRule          | id; regionCode; customerType; compensationType (NONE/NET_METERING/NET_BILLING/FEED_IN); ratePerKwh nullable; settlementPeriod (MONTH/YEAR); maxSystemKw nullable; eligibilityJson; currency; sourceUrl; verifiedAt; effectiveFrom; effectiveUntil; status                                                                                                                                                                | region/customerType/effective dates/status index                                                                           |
| GridConnectionLimit | id; regionCode; customerType; maxKw; sourceUrl; verifiedAt; effectiveFrom; status                                                                                                                                                                                                                                                                                                                                        | region/customerType index                                                                                                  |
| LoadProfile         | id; code (HOUSEHOLD_STD/HOUSEHOLD_AC/BUSINESS_DAY/ROUND_THE_CLOCK); nameI18n; monthlyFactors Decimal\[12\]; hourlyFactorsJson (12×24); active                                                                                                                                                                                                                                                                            | code unique                                                                                                                |
| ApplianceTemplate   | id; code; nameI18n; itemsJson (applianceTypeCode, count, hoursPerDay, months, isCritical); customerType; active; sortOrder                                                                                                                                                                                                                                                                                               | code unique                                                                                                                |
| ApplianceType       | id; code; nameI18n; defaultPowerW; defaultHoursPerDay; defaultMonths int\[\]; surgeFactor; hourlyUsageTemplate Decimal\[24\]; isMotorLoad; active; sortOrder                                                                                                                                                                                                                                                             | code unique                                                                                                                |
| FinancingProduct    | id; providerName; financingType (BANK_LOAN/INSTALLMENT/LEASING); annualRate Decimal(18,6); minTermMonths; maxTermMonths; allowedTerms int\[\]; minDownPaymentPct; maxAmount nullable; oneTimeFeePct; monthlyFee; paymentType (ANNUITY/DIFFERENTIATED); customerTypes text\[\]; sourceUrl; verifiedAt; effectiveFrom; effectiveUntil; status; version                                                                     | status/effective index                                                                                                     |
| CalculationSettings | id; modelVersion; parametersJson (default yo‘qotishlar, degradatsiya, soiling, DC/AC, diskont stavkasi, tarif o‘sishi, CO₂ koeffitsienti, inverter almashtirish yili va narxi, minimal harorat va h.k.); sourceNotes; effectiveFrom; effectiveUntil; status; createdBy; version                                                                                                                                          | modelVersion unique; status/effective index                                                                                |
| CalculationDraft    | id; userId nullable; cookieTokenHash; inputJson; expiresAt                                                                                                                                                                                                                                                                                                                                                               | cookieTokenHash unique; expiresAt index                                                                                    |
| Calculation         | id; userId; siteId nullable; mode (QUICK/DETAILED); inputSnapshotJson; outputSummaryJson (oylik/yillik, moliya, ssenariylar, 25 yil, moliyalashtirish, zaxira); hourlySeriesObjectKey nullable; modelVersion; calculationSettingsId; tariffScheduleId nullable; exportRuleId nullable; financingProductId nullable; solarDatasetId nullable; exchangeRateId nullable; productionMethod (A_PV_YIELD/B_IRRADIANCE/DEFAULT) | userId/createdAt index; tarixiy snapshot qayta yozilmaydi                                                                  |
| CalculationShare    | id; calculationId; tokenHash; expiresAt nullable; revokedAt; viewCount                                                                                                                                                                                                                                                                                                                                                   | tokenHash unique                                                                                                           |

## 7.6. So‘rov, taklif va montaj modellari

| **Model**            | **Maydonlar**                                                                                                                                                                                                                                                                                                                      | **Indeks/constraint**                                                                   |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| QuoteRequest         | id; userId; siteId nullable; calculationId nullable; title; systemType; requiredCapacityKw nullable; batteryNeeded; installationNeeded; financingInterest; notes; regionCode; districtCode; status (13.1); closedAt nullable                                                                                                       | userId/status/createdAt index                                                           |
| QuoteRequestShop     | id; requestId; shopId; status (13.1); contactRevealedAt nullable; assignedMemberId nullable; pipelineStage (NEW/CONTACTED/SITE_VISIT/PROPOSAL/WON/LOST); declineReason nullable; sentAt; viewedAt nullable; firstResponseAt nullable                                                                                               | unique(requestId,shopId); shopId/status index                                           |
| ShopLeadNote         | id; requestShopId; authorId; body                                                                                                                                                                                                                                                                                                  | requestShopId index                                                                     |
| ConversationMessage  | id; requestShopId; senderUserId; senderSide (CUSTOMER/SHOP/SYSTEM); body; attachmentFileIds uuid\[\]; readAt nullable                                                                                                                                                                                                              | requestShopId/createdAt index                                                           |
| SiteVisit            | id; requestShopId; proposedSlotsJson; confirmedStart nullable; status (PROPOSED/CONFIRMED/DONE/CANCELLED); notes                                                                                                                                                                                                                   | requestShopId index                                                                     |
| Quote                | id; requestId; shopId; currentRevision int; equipmentSubtotal; installationSubtotal; deliveryCost; otherCosts; discountAmount; vatIncluded; vatRate; vatAmount; total; currency; warrantyEquipmentMonths; warrantyInstallationMonths; warrantyText; durationDays; includedScope; excludedScope; validUntil; status (13.1); version | requestId/shopId/status index; unique(requestId,shopId) WHERE status NOT IN (WITHDRAWN) |
| QuoteRevision        | id; quoteId; revision; snapshotJson (barcha maydonlar va qatorlar); createdBy; createdAt                                                                                                                                                                                                                                           | unique(quoteId,revision)                                                                |
| QuoteItem            | id; quoteId; productModelId nullable; serviceId nullable; titleSnapshot; specsSnapshotJson; quantity Decimal; unitPrice Decimal; lineTotal Decimal; itemType (EQUIPMENT/INSTALLATION/DELIVERY/OTHER)                                                                                                                               | quoteId index                                                                           |
| QuoteFinancingOption | id; quoteId; financingType; providerName; annualRate; termMonths; downPaymentPct; paymentType; notes                                                                                                                                                                                                                               | quoteId index                                                                           |
| Installation         | id; quoteId; requestId; userId; shopId; status (13.1); scheduledDate nullable; installedAt nullable; confirmedAt nullable; cancelReason nullable; checklistTemplateId; checklistResultJson (\[{code, status: OK/ISSUE/NA, comment, photoFileIds}\]); checklistCompletedAt nullable                                                 | quoteId unique; userId/shopId/status index                                              |
| InstalledSystem      | id; userId; siteId; installationId nullable; systemPowerKw; systemType; componentsJson; installedAt; expectedMonthlyKwhJson                                                                                                                                                                                                        | userId index                                                                            |
| WarrantyItem         | id; installedSystemId; component; months; startsAt; endsAt                                                                                                                                                                                                                                                                         | installedSystemId/endsAt index                                                          |
| ProductionReading    | id; installedSystemId; periodMonth (date, oyning 1-kuni); generatedKwh; meterReading nullable; source (MANUAL)                                                                                                                                                                                                                     | unique(installedSystemId,periodMonth)                                                   |
| MaintenanceReminder  | id; installedSystemId; type (CLEANING/INSPECTION/WARRANTY_EXPIRY); intervalDays nullable; nextAt; lastSentAt; active                                                                                                                                                                                                               | nextAt/active index                                                                     |

## 7.7. Sharh, shikoyat, bildirishnoma va boshqalar

| **Model**                   | **Maydonlar**                                                                                                                                                                                                                                                                                                                                                                   | **Indeks/constraint**                                                                                 |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Review                      | id; userId; shopId; installationId; rating int; comment; moderationStatus (PENDING/PUBLISHED/HIDDEN); moderatedAt nullable; riskFlags text\[\]; riskScore int; ipHash; deviceHash                                                                                                                                                                                               | rating CHECK 1..5; unique(installationId) — bitta montajga bitta sharh; shopId/moderationStatus index |
| ReviewReply                 | id; reviewId; shopId; authorId; body; moderationStatus                                                                                                                                                                                                                                                                                                                          | reviewId unique                                                                                       |
| Complaint                   | id; reporterId; targetType (REVIEW/SHOP/PRODUCT_MODEL/MESSAGE/USER); targetId; reason (SPAM/FAKE/ABUSE/WRONG_INFO/OTHER); details; status (OPEN/RESOLVED/REJECTED); resolvedBy; resolvedAt                                                                                                                                                                                      | targetType/targetId index; status index                                                               |
| Favorite                    | id; userId; shopId nullable; productModelId nullable                                                                                                                                                                                                                                                                                                                            | CHECK aynan bittasi NOT NULL; unique(userId,shopId); unique(userId,productModelId)                    |
| Notification                | id; userId; channel; type; payloadJson; status (PENDING/SENT/FAILED/READ); sentAt; readAt; errorCode; idempotencyKey                                                                                                                                                                                                                                                            | unique(idempotencyKey); userId/status/createdAt index                                                 |
| KnowledgeCategory           | id; slug; nameI18n; parentId nullable; sortOrder                                                                                                                                                                                                                                                                                                                                | slug unique                                                                                           |
| GuideArticle                | id; slug; articleType (GUIDE/ARTICLE/FAQ/VIDEO/GLOSSARY); categoryId; titleI18n; summaryI18n; bodyI18n (Markdown); videoUrl nullable; coverFileId nullable; tags text\[\]; seoTitleI18n; seoDescriptionI18n; ctaType (CALCULATOR/OUTAGE/FINANCING/SHOPS/NONE); authorId; readingMinutes; sourceUrls text\[\]; verifiedAt; publishedAt; status (DRAFT/PUBLISHED/ARCHIVED)        | slug unique; categoryId/status/publishedAt index; title va body uchun trigram (GIN) indeks            |
| AcceptanceChecklistTemplate | id; systemType; version; itemsJson (\[{code, titleI18n, hintI18n, required, photoRequired}\]); active                                                                                                                                                                                                                                                                           | systemType+version unique                                                                             |
| SupportTicket               | id; number (SUP-000123); requesterUserId nullable; guestContact nullable; shopId nullable; category; priority (URGENT/HIGH/NORMAL); status (OPEN/IN_PROGRESS/WAITING_USER/RESOLVED/CLOSED); relatedType nullable; relatedId nullable; requestIdRef nullable; assigneeId nullable; firstResponseDueAt; firstRespondedAt nullable; resolvedAt nullable; satisfaction int nullable | number unique; status/priority/firstResponseDueAt index; requesterUserId index                        |
| SupportMessage              | id; ticketId; senderUserId nullable; senderSide (USER/AGENT/SYSTEM); body; attachmentFileIds uuid\[\]; isInternal                                                                                                                                                                                                                                                               | ticketId/createdAt index                                                                              |
| SupportReplyTemplate        | id; titleI18n; bodyI18n; category; active                                                                                                                                                                                                                                                                                                                                       | category index                                                                                        |
| FileObject                  | id; ownerUserId; purpose (PRODUCT_IMAGE/SHOP_LOGO/VERIFICATION_DOC/MESSAGE_ATTACHMENT/REPORT/IMPORT/PORTFOLIO); storageKey; mimeType; sizeBytes; status (PENDING_UPLOAD/UPLOADED/SCANNED_CLEAN/INFECTED); variantsJson                                                                                                                                                          | storageKey unique; ownerUserId index                                                                  |
| SubscriptionPlan            | id; name; price; currency; billingPeriod (MONTH/YEAR); limitsJson (maxBranches, maxProducts, maxMembers, maxRequestsPerMonth, analyticsEnabled, widgetEnabled, importEnabled); active                                                                                                                                                                                           | active index                                                                                          |
| ShopSubscription            | id; shopId; planId; status (TRIAL/ACTIVE/PAST_DUE/CANCELLED/EXPIRED); startedAt; endsAt; autoRenew                                                                                                                                                                                                                                                                              | shopId/status/endsAt index                                                                            |
| Payment                     | id; shopId; subscriptionId; provider (CLICK/PAYME/UZUM); providerTransactionId; amount; currency; status (CREATED/PENDING/PAID/FAILED/REFUNDED); paidAt; rawEventJson                                                                                                                                                                                                           | unique(provider,providerTransactionId)                                                                |
| AnalyticsEvent              | id; eventType; userId nullable; anonymousId nullable; shopId nullable; entityId nullable; regionCode nullable; propertiesJson (PII yo‘q); occurredAt                                                                                                                                                                                                                            | eventType/occurredAt index; shopId/occurredAt index; oylik partition                                  |
| OutboxEvent                 | id; eventType; aggregateType; aggregateId; payloadJson; createdAt; processedAt nullable; attempts; lastError                                                                                                                                                                                                                                                                    | processedAt IS NULL partial index                                                                     |
| AuditLog                    | id; actorId nullable; action; entityType; entityId; beforeJson; afterJson (PII maskalangan); requestId; ipHash; createdAt                                                                                                                                                                                                                                                       | entityType/entityId/createdAt; actorId/createdAt index                                                |
| ReportJob                   | id; userId; reportType (CALCULATION_PDF/QUOTE_PDF/ANALYTICS_CSV); inputRef; status; fileId nullable; errorCode; completedAt; expiresAt                                                                                                                                                                                                                                          | userId/status/createdAt index                                                                         |
| SiteBlock                   | id; page (HOME/CALCULATOR_LANDING/…); blockType (HERO/STEPS/STATS/CALCULATORS/SHOPS/TRUST/VIDEO/FAQ/PARTNERS/CTA); sortOrder; contentI18n (jsonb); mediaAssetIds uuid\[\]; status (DRAFT/PUBLISHED/ARCHIVED); version; publishedAt                                                                                                                                              | page/status/sortOrder index                                                                           |
| MediaAsset                  | id; kind (VIDEO/IMAGE); originalFileId; variantsJson (webm, mp4, hls, poster, preview, o‘lchamlar); durationSec; subtitlesJson (uz/oz/ru WebVTT fayllari); altI18n; status (UPLOADED/PROCESSING/READY/FAILED)                                                                                                                                                                   | status index                                                                                          |
| OpsDeployment               | id; service (web/api/worker/widget); environment; version; gitSha; status (STARTED/SUCCEEDED/FAILED/ROLLED_BACK); startedAt; finishedAt; triggeredBy; changelogUrl                                                                                                                                                                                                              | service/environment/startedAt index                                                                   |
| OpsAlertEvent               | id; fingerprint; alertName; severity (CRITICAL/WARNING/INFO); status (FIRING/RESOLVED); startsAt; endsAt nullable; summary; labelsJson; acknowledgedBy nullable; acknowledgedAt nullable                                                                                                                                                                                        | fingerprint+startsAt unique; status/severity index                                                    |
| OpsBackupRun                | id; kind (DB_FULL/DB_WAL/OBJECT_STORAGE); status (RUNNING/SUCCEEDED/FAILED); startedAt; finishedAt; sizeBytes; location; restoreTestedAt nullable                                                                                                                                                                                                                               | kind/startedAt index                                                                                  |
| ProviderQuotaSnapshot       | id; provider (ESRI_BASEMAP/ESRI_GEOCODE/PVGIS/NASA_POWER/SMS/TELEGRAM/EMAIL); metric; used; limit nullable; periodStart; capturedAt                                                                                                                                                                                                                                             | provider/capturedAt index                                                                             |

## 7.8. Database integrity talablari

- Foreign key va onDelete strategiyasi har bir relation uchun aniq: tarixiy quote/calculation/installation bilan bog‘langan yozuvlar RESTRICT; foydalanuvchiga tegishli bog‘liq yozuvlar (site → area) CASCADE faqat jismoniy o‘chirish anonimlashtirish jarayonida.

- QuoteItem’da mahsulot nomi, xususiyatlari va unit price snapshot saqlanadi; QuoteRevision har bir yuborishda to‘liq snapshot saqlaydi.

- Calculation input/output bilan birga modelVersion va ishlatilgan tarif, eksport qoidasi, moliyalashtirish mahsuloti, solar dataset va valyuta kursi ID’lari saqlanadi.

- Tarif pog‘onalari oralig‘i bir season+touPeriod ichida ustma-ust kelmasligi DB constraint va servis validatsiyasi bilan tekshiriladi.

- SiteArea geometriyasi serverda validatsiya qilinadi; frontend yuborgan maydon qiymati qabul qilinmaydi.

- Sensitive JSON maydonlarga parol, token yoki boshqa secret kiritilmaydi.

- Soatlik hisob qatorlari (8760 × ssenariylar) DBga yozilmaydi: gzip JSON sifatida object storage’da (calculations/{id}/hourly.json.gz, 1 yil saqlanadi). DBda faqat oylik va yillik yig‘indilar.

- AnalyticsEvent oylik partitsiyalanadi; 24 oydan eski partitsiyalar arxivlanadi.

# 8. Prisma loyiha qoidalari

- schema.prisma — modellarning yagona deklarativ manbasi.

- Migrationlar version control’da. Development: prisma migrate dev; production: prisma migrate deploy.

- Productionda db push yoki avtomatik schema alter ishlatilmaydi.

- Prisma Client faqat repository qatlamidan ishlatiladi.

- PostGIS ustunlari Prisma’da Unsupported("geometry(Polygon,4326)") va h.k. bo‘ladi. Ularga barcha yozish/o‘qish faqat GeoRepository dagi \$queryRaw/\$executeRaw (tagged template, parametrli) orqali; natija tiplari qo‘lda yozilgan TS interfeyslar bilan. \$queryRawUnsafe taqiqlangan.

- PostGIS extension, GiST indekslar, exclusion constraintlar, partial unique indekslar va CHECK constraintlar SQL migration bilan qo‘shiladi va izohlanadi.

- Soft-delete client extension (6.6) barcha archivedAt li modellarga qo‘llanadi.

- Seed: development uchun demo kategoriyalar, ProductModel’lar, fake do‘konlar, LoadProfile va ApplianceType standart to‘plami. Haqiqiy tarif, eksport qoidasi va moliyalashtirish mahsulotlari seed orqali productionga kiritilmaydi — faqat admin panel orqali, manba bilan.

# 9. API standartlari

## 9.1. Umumiy response

> Success (bitta resurs): { "data": { ... } }
>
> Success (offset list): { "data": \[\], "meta": { "page": 1, "limit": 20, "total": 0 } }
>
> Success (cursor list): { "data": \[\], "meta": { "nextCursor": "...", "limit": 50 } }
>
> Error:
>
> {
>
> "statusCode": 400,
>
> "errorCode": "VALIDATION_ERROR",
>
> "message": "Kiritilgan ma'lumotlarni tekshiring",
>
> "fieldErrors": { "monthlyKwh": "POSITIVE_REQUIRED" },
>
> "requestId": "..."
>
> }

- message foydalanuvchi tilida (Accept-Language) qaytadi; fieldErrors qiymatlari — mashina kodlari, frontend ularni i18n orqali tarjima qiladi.

- Pagination: public katalog va kichik ro‘yxatlar — offset (limit max 100). Audit log, analytics, bildirishnomalar, yozishmalar — cursor.

- Sort/filter faqat ruxsat etilgan qiymatlar ro‘yxatidan; DB ustun nomi to‘g‘ridan-to‘g‘ri qabul qilinmaydi.

- Request body’dagi userId, shopId (path’dan tashqari), role, status, total kabi server belgilaydigan maydonlar qabul qilinmaydi.

- POST create 201 va yaratilgan resursni qaytaradi. PATCH faqat ruxsat etilgan maydonlarni o‘zgartiradi va version talab qiladi (6.6).

- Tashqi servis xatolari foydalanuvchiga 502/503 PROVIDER_UNAVAILABLE sifatida, ichki tafsilotsiz qaytadi.

- API versiyalash: buzuvchi o‘zgarish faqat /api/v2 da; eskirgan endpoint Deprecation va Sunset header’lari bilan kamida 90 kun ishlaydi.

## 9.2. Xato kodlari katalogi

| **errorCode**                                          | **HTTP**    | **Qachon**                                                     |
|--------------------------------------------------------|-------------|----------------------------------------------------------------|
| SHOP_LIMIT_REACHED                                     | 409         | Foydalanuvchi do‘konlar soni limitiga yetgan (3 ta)            |
| INVITATION_INVALID / INVITATION_EXPIRED                | 404/410     | Taklif topilmadi, bekor qilingan yoki muddati o‘tgan           |
| INVITATION_CONTACT_MISMATCH                            | 403         | Taklif boshqa telefon/email uchun                              |
| SHOP_SUSPENDED                                         | 423         | To‘xtatilgan do‘kon yozish amalini bajara olmaydi              |
| OPS_METRIC_NOT_ALLOWED                                 | 400         | DevOps paneliga ruxsat etilmagan metrika so‘raldi              |
| MAP_QUOTA_EXCEEDED                                     | 503         | Xarita yoki geocoding bepul limiti tugagan (fallback ishlaydi) |
| VALIDATION_ERROR                                       | 400         | Sxema validatsiyasi                                            |
| UNAUTHENTICATED                                        | 401         | Sessiya yo‘q yoki muddati o‘tgan                               |
| FORBIDDEN                                              | 403         | Rol/permission yetarli emas                                    |
| NOT_FOUND                                              | 404         | Resurs yo‘q yoki egasi boshqa                                  |
| CONFLICT                                               | 409         | Unikal qiymat band (email, slug)                               |
| VERSION_CONFLICT                                       | 409         | Optimistic lock                                                |
| INVALID_STATUS_TRANSITION                              | 409         | 13-bo‘lim jadvaliga zid o‘tish                                 |
| IDEMPOTENCY_CONFLICT                                   | 409         | Bir xil kalit, boshqa body                                     |
| PLAN_LIMIT_EXCEEDED                                    | 402         | Obuna limiti                                                   |
| RATE_LIMITED                                           | 429         | Limit oshdi (Retry-After bilan)                                |
| OTP_INVALID / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS      | 400/400/429 | OTP                                                            |
| POLYGON_INVALID / POLYGON_TOO_LARGE                    | 400         | Geometriya                                                     |
| TARIFF_NOT_FOUND                                       | 422         | Hudud uchun amaldagi tarif yo‘q                                |
| SOLAR_DATA_UNAVAILABLE                                 | 503         | Provider va kesh yo‘q (default estimate ishlatilmagan holatda) |
| QUOTE_REQUEST_CLOSED                                   | 409         | Yopilgan so‘rovga amal                                         |
| SHOP_NOT_RECIPIENT                                     | 404         | Do‘kon so‘rov qabul qiluvchisi emas                            |
| CONTACT_NOT_REVEALED                                   | 403         | Kontakt hali ochilmagan                                        |
| REVIEW_NOT_ELIGIBLE                                    | 403         | Montaj tasdiqlanmagan                                          |
| FILE_TYPE_NOT_ALLOWED / FILE_TOO_LARGE / FILE_INFECTED | 400         | Fayl                                                           |
| PROVIDER_UNAVAILABLE                                   | 503         | Tashqi servis                                                  |
| INTERNAL_ERROR                                         | 500         | Kutilmagan xato                                                |

Yangi kod faqat shu jadvalga (va src/common/constants/error-codes.ts) qo‘shilgandan keyin ishlatiladi.

## 9.3. Do‘kon konteksti

Do‘kon boshqaruvi endpointlari /api/v1/manage/shops/:shopId/... ko‘rinishida. Server har bir so‘rovda foydalanuvchining shu shopId da a’zoligini va kerakli permission’ni tekshiradi. GET /api/v1/me/shops foydalanuvchi a’zo bo‘lgan do‘konlarni qaytaradi.

## 9.4. Idempotentlik

POST /quote-requests, POST .../quotes, POST .../quotes/:id/send, POST /payments/\*, POST .../report uchun Idempotency-Key header majburiy. Kalit va javob 24 soat saqlanadi; bir xil kalit bilan boshqa body kelsa 409 IDEMPOTENCY_CONFLICT.

## 9.5. Auth API

| **Method + path**                                                   | **Auth**            | **Mazmuni**                                                               |
|---------------------------------------------------------------------|---------------------|---------------------------------------------------------------------------|
| POST /api/v1/auth/otp/request                                       | Public + rate limit | phone yoki email, purpose; javob mavjudlikni oshkor qilmaydi              |
| POST /api/v1/auth/otp/verify                                        | Public + rate limit | target, code, purpose; REGISTER/LOGIN uchun sessiya yaratadi              |
| POST /api/v1/auth/register                                          | Public + rate limit | fullName, phone yoki email, password (ixtiyoriy), tasdiqlangan OTP tokeni |
| POST /api/v1/auth/login                                             | Public + rate limit | email/phone + password; sessiya cookie’lari                               |
| POST /api/v1/auth/refresh                                           | Refresh cookie      | Rotation; reuse detection                                                 |
| POST /api/v1/auth/logout                                            | Logged-in           | Joriy sessiyani bekor qilish; idempotent                                  |
| GET /api/v1/auth/sessions; DELETE /api/v1/auth/sessions/:id         | Logged-in           | Sessiyalar ro‘yxati va bekor qilish                                       |
| POST /api/v1/auth/forgot-password; POST /api/v1/auth/reset-password | Public + rate limit | Javob mavjudlikni oshkor qilmaydi; reset barcha sessiyalarni bekor qiladi |
| POST /api/v1/auth/verify-otp; PATCH /api/v1/users/me/two-factor     | Logged-in           | 2FA (OTP) tasdiqlash va yoqish/o‘chirish (GetMaster)                      |
| GET/PATCH /api/v1/users/me                                          | Logged-in           | Profil, til, hisob turi, tashkilot                                        |
| POST /api/v1/users/me/contact-change                                | Logged-in + OTP     | Telefon/email almashtirish                                                |
| GET/PUT /api/v1/users/me/notification-preferences                   | Logged-in           | Kanal sozlamalari                                                         |
| POST /api/v1/users/me/telegram-link                                 | Logged-in           | Bot deep-link tokeni (10 daqiqa)                                          |
| DELETE /api/v1/users/me                                             | Logged-in + re-auth | Anonimlashtirish workflow’i (16-bo‘lim)                                   |

## 9.6. Public katalog API

| **Method + path**                                                                                                                    | **Query/body**                                                                           | **Javob**                                                |
|--------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|----------------------------------------------------------|
| GET /api/v1/shops                                                                                                                    | q, region, serviceType, verified, minRating, openNow, page, limit, sort                  | Faqat ACTIVE do‘konlar                                   |
| GET /api/v1/shops/:slug                                                                                                              | —                                                                                        | Profil, xizmatlar, filiallar, reyting, javob tezligi     |
| GET /api/v1/shops/:slug/reviews                                                                                                      | page, limit, rating                                                                      | PUBLISHED sharhlar va javoblar                           |
| GET /api/v1/shops/:slug/projects                                                                                                     | page, limit                                                                              | Portfolio                                                |
| GET /api/v1/product-models                                                                                                           | categoryId, brand, minPowerW, maxPowerW, minPrice, maxPrice, stock, q, page, limit, sort | APPROVED modellar, eng past narx va takliflar soni bilan |
| GET /api/v1/product-models/:slug                                                                                                     | —                                                                                        | Xususiyatlar va datasheet                                |
| GET /api/v1/product-models/:slug/offers                                                                                              | region, sort, page                                                                       | Faol takliflar (narx, do‘kon, filial, masofa)            |
| GET /api/v1/product-models/compare                                                                                                   | ids (2–4)                                                                                | Bir xil atributlar va moslik natijasi                    |
| GET /api/v1/categories                                                                                                               | parentId                                                                                 | Faol kategoriyalar daraxti                               |
| GET /api/v1/knowledge/categories; GET /api/v1/knowledge/articles; GET /api/v1/knowledge/articles/:slug; GET /api/v1/knowledge/search | locale, type, categoryId, tag, q, page                                                   | Bilimlar markazi                                         |
| GET /api/v1/exchange-rates/latest                                                                                                    | currency                                                                                 | Joriy kurs va sanasi                                     |
| GET /api/v1/appliance-types; GET /api/v1/appliance-templates; GET /api/v1/load-profiles; GET /api/v1/financing-products              | —                                                                                        | Kalkulyator ma’lumotnomalari                             |

## 9.7. Do‘kon boshqaruvi API (/api/v1/manage/shops/:shopId)

| **Method + path**                                        | **Vazifa**                             | **Ruxsat/validatsiya**                                                |
|----------------------------------------------------------|----------------------------------------|-----------------------------------------------------------------------|
| PATCH /                                                  | Profilni tahrirlash                    | shop.profile (OWNER/MANAGER)                                          |
| POST /api/v1/users/me/password/first                     | Birinchi kirishda yangi parol (mustPasswordChange) | Faqat `mustPasswordChange=true`; yangi parol ≥ 8 belgi, vaqtinchadan farqli |
| GET/POST/PATCH/DELETE /members, POST /members/:userId/reset-password | Xodimlar ro‘yxati, qo‘shish (login + vaqtincha parol), permissions, chiqarish, parolni tiklash | members.manage (faqat ega) |
| CRUD /branches                                           | Filiallar                              | branches.write; valid koordinata                                      |
| PUT /branches/:id/service-area                           | Xizmat hududi                          | Polygon valid, max 500 vertex, max 20 000 km²                         |
| CRUD /products                                           | ShopProduct                            | catalog.write; ProductModel APPROVED                                  |
| POST /product-models/propose                             | Yangi model taklifi                    | catalog.write; admin moderatsiyasiga                                  |
| CRUD /products/:id/offers                                | Narx/zaxira                            | offers.write; price ≥ 0; sanalar valid                                |
| POST /imports; GET /imports/:id; POST /imports/:id/apply | Ommaviy import                         | catalog.write; plan limiti                                            |
| CRUD /services                                           | Xizmatlar                              | services.write                                                        |
| GET /requests; GET /requests/:id                         | Kelgan so‘rovlar                       | requests.read                                                         |
| PATCH /requests/:id                                      | Pipeline bosqichi, mas’ul xodim        | requests.assign                                                       |
| POST /requests/:id/decline                               | Rad etish (sabab bilan)                | requests.read                                                         |
| GET/POST /requests/:id/notes                             | Ichki izohlar                          | requests.read                                                         |
| CRUD /quote-templates                                    | Shablonlar                             | quote.draft                                                           |
| GET/PATCH /installations/:id                             | Montaj holati                          | installations.write                                                   |
| CRUD /projects                                           | Portfolio                              | portfolio.write                                                       |
| POST /reviews/:id/reply                                  | Sharhga javob                          | reviews.reply                                                         |
| GET/PUT /widget                                          | Vidjet sozlamalari                     | widget.manage; plan                                                   |
| GET /dashboard; GET /analytics                           | KPI va analitika                       | analytics.read; date range max 366 kun                                |

## 9.8. Xarita va obyekt API

| **Method + path**                                                                   | **Request**                                                                        | **Javob / talab**                                                                                                 |
|-------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| GET /api/v1/map/shops                                                               | west,south,east,north, zoom, serviceType, category, verified                       | zoom \< 13: klasterlar (server-side, PostGIS ST_SnapToGrid); aks holda max 500 marker                             |
| GET /api/v1/map/shops/:id                                                           | —                                                                                  | Marker mini-card                                                                                                  |
| GET /api/v1/map/shops/serving                                                       | lat, lon, serviceType                                                              | Nuqtaga xizmat ko‘rsatadigan do‘konlar (ST_Covers)                                                                |
| POST/GET /api/v1/sites; GET/PATCH /api/v1/sites/:id; POST /api/v1/sites/:id/archive | —                                                                                  | Ownership                                                                                                         |
| POST /api/v1/sites/:id/areas; PATCH/DELETE /api/v1/sites/:id/areas/:areaId          | name, areaType, roofShape, polygon (GeoJSON), tilt, azimuth, shading, usableFactor | Server geometriyani tekshiradi va maydonlarni qayta hisoblaydi                                                    |
| POST /api/v1/geocoding/search; POST /api/v1/geocoding/reverse                       | q / lat,lon                                                                        | Esri geocoding orqali (\`forStorage=false\`); natija serverda saqlanmaydi va keshlanmaydi (12-bo‘lim); rate limit |

## 9.9. Kalkulyator API

| **Method + path**                                                          | **Vazifa**                        | **Talab**                                                                           |
|----------------------------------------------------------------------------|-----------------------------------|-------------------------------------------------------------------------------------|
| POST /api/v1/calculations/estimate                                         | Vaqtinchalik hisob (Tez/Batafsil) | Auth ixtiyoriy; 10.3 rate limit; timeout 10 s                                       |
| PUT /api/v1/calculations/draft                                             | Draftni saqlash (guest ham)       | Cookie draft ID                                                                     |
| POST /api/v1/calculations                                                  | Hisobni saqlash                   | Logged-in; snapshot va versiyalar                                                   |
| GET /api/v1/calculations; GET /api/v1/calculations/:id                     | Ro‘yxat va natija                 | Ownership; tarixiy snapshot                                                         |
| GET /api/v1/calculations/compare                                           | ids (2–3)                         | Ownership                                                                           |
| POST /api/v1/calculations/:id/recalculate                                  | Joriy ma’lumot bilan qayta hisob  | Yangi Calculation yoziladi                                                          |
| POST /api/v1/calculations/:id/share; DELETE /api/v1/calculations/:id/share | Read-only link                    | Link manzil va poligonni ko‘rsatmaydi                                               |
| GET /api/v1/shared/:token                                                  | Ulashilgan hisob                  | Public, rate limit                                                                  |
| POST /api/v1/calculations/:id/report                                       | PDF job (shareViaQr bool)         | Job ID; shareViaQr=true bo‘lsa CalculationShare yaratiladi yoki mavjudi ishlatiladi |
| GET /api/v1/reports/:jobId; GET /api/v1/reports/:jobId/download            | Status va yuklab olish            | Egasi; signed URL 10 daqiqa                                                         |
| POST /api/v1/financing/estimate                                            | Kredit hisobi                     | Auth ixtiyoriy                                                                      |
| POST /api/v1/outage/estimate                                               | Zaxira hisobi                     | Auth ixtiyoriy                                                                      |
| POST /api/v1/compatibility/check                                           | Komponentlar mosligi              | Auth ixtiyoriy                                                                      |

## 9.10. So‘rov, yozishma, taklif, montaj, sharh API

| **Method + path**                                                                                                                                                                                                     | **Vazifa**                                    | **Qoidalar**                                                                                                                                                                                          |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| POST /api/v1/quote-requests                                                                                                                                                                                           | So‘rov yaratish                               | Customer; 1–5 do‘kon; bir vaqtda max 3 ochiq so‘rov; kuniga max 5                                                                                                                                     |
| GET /api/v1/quote-requests/me; GET /api/v1/quote-requests/:id                                                                                                                                                         | Ro‘yxat va detail                             | Egasi yoki qabul qiluvchi do‘kon (kontakt siyosati bilan)                                                                                                                                             |
| POST /api/v1/quote-requests/:id/shops                                                                                                                                                                                 | Do‘kon qo‘shish                               | Jami 5 tadan oshmaydi; so‘rov OPEN                                                                                                                                                                    |
| POST /api/v1/quote-requests/:id/reveal-contact                                                                                                                                                                        | Kontaktni do‘konga ochish                     | Customer; shopId                                                                                                                                                                                      |
| POST /api/v1/quote-requests/:id/close                                                                                                                                                                                 | Yopish                                        | Customer                                                                                                                                                                                              |
| GET/POST /api/v1/request-shops/:id/messages; POST .../messages/read                                                                                                                                                   | Yozishma                                      | Ikki tomon; ilova max 5 fayl × 10 MB                                                                                                                                                                  |
| POST/PATCH /api/v1/request-shops/:id/site-visits                                                                                                                                                                      | O‘lchov uchrashuvi                            | Do‘kon taklif qiladi, mijoz tasdiqlaydi; tasdiq kontaktni ochadi                                                                                                                                      |
| POST /api/v1/quote-requests/:id/quotes                                                                                                                                                                                | Taklif qoralamasi                             | quote.draft; qabul qiluvchi                                                                                                                                                                           |
| PATCH /api/v1/quotes/:id                                                                                                                                                                                              | Qoralamani tahrirlash                         | Faqat DRAFT; version                                                                                                                                                                                  |
| POST /api/v1/quotes/:id/send                                                                                                                                                                                          | Yuborish (yangi revision)                     | quote.send                                                                                                                                                                                            |
| POST /api/v1/quotes/:id/revise                                                                                                                                                                                        | Yuborilgan taklifni yangilash                 | quote.send; yangi QuoteRevision; mijozga xabar                                                                                                                                                        |
| POST /api/v1/quotes/:id/withdraw                                                                                                                                                                                      | Qaytarib olish                                | quote.withdraw; 13.1                                                                                                                                                                                  |
| POST /api/v1/quotes/:id/accept; POST /api/v1/quotes/:id/reject                                                                                                                                                        | Mijoz qarori                                  | Customer; accept Installation yaratadi                                                                                                                                                                |
| GET /api/v1/quotes/:id/pdf                                                                                                                                                                                            | Tijoriy taklif PDF                            | Ikki tomon                                                                                                                                                                                            |
| GET/PATCH /api/v1/installations/:id; GET /api/v1/installations/:id/checklist; PUT /api/v1/installations/:id/checklist; POST /api/v1/installations/:id/confirm; POST .../dispute                                       | Montaj va qabul chek-listi                    | 13.1 va 13.7; confirm chek-list to‘liq bo‘lmasa 409                                                                                                                                                   |
| POST /api/v1/support/tickets; GET /api/v1/support/tickets; GET /api/v1/support/tickets/:id; POST /api/v1/support/tickets/:id/messages; POST /api/v1/support/tickets/:id/reopen; POST /api/v1/support/tickets/:id/rate | Yordam markazi                                | Egasi; guest — OTP bilan; kuniga max 5 yangi murojaat                                                                                                                                                 |
| GET /api/v1/support/suggestions                                                                                                                                                                                       | Murojaatdan oldin FAQ tavsiyasi               | q, category                                                                                                                                                                                           |
| GET/POST /api/v1/installed-systems; POST /api/v1/installed-systems/:id/readings                                                                                                                                       | Montajdan keyingi kabinet                     | Egasi                                                                                                                                                                                                 |
| POST /api/v1/reviews                                                                                                                                                                                                  | Sharh                                         | Installation CONFIRMED; rating 1..5                                                                                                                                                                   |
| POST /api/v1/complaints                                                                                                                                                                                               | Shikoyat                                      | Logged-in; kuniga max 10                                                                                                                                                                              |
| POST/DELETE /api/v1/favorites                                                                                                                                                                                         | Sevimlilar                                    | Shop yoki productModel’dan aynan bittasi                                                                                                                                                              |
| GET /api/v1/notifications; POST /api/v1/notifications/read                                                                                                                                                            | Bildirishnomalar                              | Cursor; ids yoki "all"                                                                                                                                                                                |
| POST /api/v1/files/presign; POST /api/v1/files/:id/complete                                                                                                                                                           | Fayl yuklash                                  | purpose, mime, size; server key beradi                                                                                                                                                                |
| POST /api/v1/payments/:provider/webhook                                                                                                                                                                               | To‘lov webhook                                | Imzo tekshiruvi; idempotent                                                                                                                                                                           |
| POST /api/v1/telegram/webhook                                                                                                                                                                                         | Telegram update va inline tugma callback’lari | X-Telegram-Bot-Api-Secret-Token tekshiruvi; callback TelegramCallbackToken orqali (bir martalik, 48 soat), chatId → TelegramLink → user → ShopPermissionGuard xuddi web’dagi kabi; har bir amal audit |
| POST /api/v1/widget/:publicKey/lead                                                                                                                                                                                   | Vidjetdan so‘rov                              | Origin allowedDomains’da; captcha; rate limit                                                                                                                                                         |

## 9.11. Admin API

| **Method + path**                                                                                                          | **Vazifa**                                                                                                                                                |
|----------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| GET /api/v1/admin/shops; GET /api/v1/admin/shops/:id | Do‘konlar ro‘yxati va tafsiloti (a’zolar, belgilar) |
| POST /api/v1/admin/shops; GET /api/v1/admin/shops/duplicates?stir=&phone= | Do‘kon + egasining hisobi + vaqtincha parol yaratish (3.7.1): dublikat tekshiruvi, ACTIVE/VERIFIED, parol javobda bir marta, audit |
| POST /api/v1/admin/shops/:id/members; POST /api/v1/admin/shops/:id/members/:userId/reset-password | Xodim qo‘shish (login + vaqtincha parol); a’zo parolini qayta tiklash (3.7.2) |
| POST /api/v1/admin/shops/:id/owner | Egani almashtirish: mavjud a’zo OWNER, eski ega MANAGER (3.7.2) |
| POST /api/v1/admin/shops/:id/suspend; POST /api/v1/admin/shops/:id/resume | To‘xtatish va qayta yoqish (sabab majburiy, 3.7.3) |
| POST /api/v1/admin/shops/:id/badges; DELETE /api/v1/admin/shops/:id/badges/:badgeId | Do‘kon belgisi (rasmiy diler, sertifikatli montajchi, litsenziya) qo‘yish va olib tashlash |
| PUT /api/v1/admin/shops/:id/… (admin rejimi) | Filial, xizmat hududi, xizmatlar va importni admin ham to‘ldira oladi; do‘kon endpointlari bilan bir xil validatsiya, audit |
| CRUD /api/v1/admin/categories                                                                                              | Kategoriyalar va attribute schema                                                                                                                         |
| GET/PATCH /api/v1/admin/product-models; POST /api/v1/admin/product-models/:id/merge                                        | Model moderatsiyasi va dublikatlarni birlashtirish                                                                                                        |
| CRUD /api/v1/admin/tariff-schedules (+tiers, tou-periods); POST .../:id/preview; POST .../:id/publish                      | Tarif, preview va nashr                                                                                                                                   |
| CRUD /api/v1/admin/export-rules; CRUD /api/v1/admin/grid-connection-limits                                                 | Eksport va ulanish limitlari                                                                                                                              |
| CRUD /api/v1/admin/financing-products                                                                                      | Moliyalashtirish mahsulotlari                                                                                                                             |
| CRUD /api/v1/admin/appliance-types; CRUD /api/v1/admin/appliance-templates; CRUD /api/v1/admin/load-profiles               | Kalkulyator ma’lumotnomalari                                                                                                                              |
| CRUD /api/v1/admin/calculation-settings                                                                                    | Versiyalangan parametrlar                                                                                                                                 |
| GET /api/v1/admin/exchange-rates; POST .../refresh                                                                         | Kurslar                                                                                                                                                   |
| CRUD /api/v1/admin/knowledge/categories; CRUD /api/v1/admin/knowledge/articles                                             | Bilimlar markazi                                                                                                                                          |
| (olib tashlangan) /api/v1/admin/certifications | v3.1: sertifikat tekshiruvi navbati yo‘q; belgilar `…/shops/:id/badges` orqali |
| CRUD /api/v1/admin/acceptance-checklists                                                                                   | Montaj chek-listi shablonlari                                                                                                                             |
| GET/PATCH /api/v1/admin/support/tickets; POST .../:id/messages; CRUD /api/v1/admin/support/reply-templates                 | Yordam navbati                                                                                                                                            |
| GET/PATCH /api/v1/admin/reviews (riskFlags filtri); GET/PATCH /api/v1/admin/complaints                                     | Moderatsiya                                                                                                                                               |
| GET/PATCH /api/v1/admin/users; POST /api/v1/admin/users/:id/revoke-sessions                                                | Foydalanuvchilar                                                                                                                                          |
| CRUD /api/v1/admin/subscription-plans                                                                                      | Obuna rejalari                                                                                                                                            |
| GET /api/v1/admin/analytics/funnel                                                                                         | Konversiya funnel’i (davr, hudud)                                                                                                                         |
| GET /api/v1/admin/audit-logs                                                                                               | Audit (cursor); Super Admin yoki audit.read                                                                                                               |
| CRUD /api/v1/admin/site-blocks; POST /api/v1/admin/site-blocks/:id/publish; POST /api/v1/admin/media (presign + transcode) | Bosh sayt bloklari, video va rasmlar (5.5)                                                                                                                |
| GET /api/v1/admin/ops/overview                                                                                             | DevOps paneli umumiy holati (19.1): xizmatlar, SLO, ochiq alertlar, oxirgi deploy, backup, kvotalar. SUPER_ADMIN + TOTP                                   |
| GET /api/v1/admin/ops/metrics?metric=&range=&step=                                                                         | Oldindan belgilangan metrikalar (allowlist, 19.1); serverda Prometheus HTTP API’ga proksi; ixtiyoriy PromQL qabul qilinmaydi                              |
| GET /api/v1/admin/ops/queues; POST …/queues/:name/pause\|resume; POST …/queues/:name/jobs/:id/retry                        | Navbatlar holati va xavfsiz amallar (sabab bilan, audit)                                                                                                  |
| GET /api/v1/admin/ops/deployments; GET /api/v1/admin/ops/alerts; POST /api/v1/admin/ops/alerts/:id/ack                     | Deploylar tarixi; alertlar va ularni qabul qilish                                                                                                         |
| GET /api/v1/admin/ops/database; GET /api/v1/admin/ops/backups; GET /api/v1/admin/ops/providers                             | DB ulanishlari va sekin so‘rovlar (top 10, parametrsiz), backup natijalari, tashqi provayder kvotalari                                                    |
| POST /api/v1/ops/webhooks/alertmanager; POST /api/v1/ops/webhooks/deploy                                                   | Alertmanager va CI/CD dan kiruvchi hodisalar (HMAC imzo, IP allowlist)                                                                                    |

# 10. Validatsiya qoidalari

## 10.1. Umumiy

- Stringlar trim qilinadi; har bir maydonga max length (nom 120, sarlavha 200, izoh 2 000, xabar 4 000, tavsif 10 000).

- Foydalanuvchi matni HTML sifatida render qilinmaydi; Markdown ruxsat etilgan joylarda sanitize qilinadi.

- Email RFC 5322 (amaliy subset); telefon +998 bilan 12 raqam (E.164). Xorijiy raqam V1.0 da qabul qilinmaydi.

- Pul ≥ 0; max 999 999 999 999,99; 2 kasr xonadan ko‘p bo‘lmaydi.

- Oylik kWh: 1..100 000; nol faqat "Hozircha iste’mol yo‘q" (yangi qurilish) belgisi bilan.

- Latitude -90..90, longitude -180..180; O‘zbekiston chegarasidan tashqarida ogohlantirish.

- Azimut konvensiyasi (yakuniy): 0° = shimol, 90° = sharq, 180° = janub, 270° = g‘arb, soat strelkasi bo‘yicha. Qabul qilinadigan oraliq 0..359. Provider adapterlari o‘z konvensiyasiga o‘giradi (PVGIS: aspect = azimut − 180).

- Qiyalik 0..90°.

- Polygon: yopiq ring, 3..500 vertex, self-intersection yo‘q (ST_IsValid), SRID 4326, mijoz maydoni max 50 000 m², xizmat hududi max 20 000 km².

- Page/limit: limit max 100.

- Sana oralig‘i: effectiveUntil ≥ effectiveFrom; teskari oraliq taqiqlangan.

- Quote: quantity \> 0; total va subtotal faqat serverda hisoblanadi; validUntil ≥ bugun.

- Kredit: muddat mahsulot ruxsat bergan oylar ichida; boshlang‘ich to‘lov ≥ minDownPaymentPct.

## 10.2. Fayllar

| **Purpose**                      | **Ruxsat etilgan MIME**                            | **Max hajm**      |
|----------------------------------|----------------------------------------------------|-------------------|
| Rasm (mahsulot, logo, portfolio) | image/jpeg, image/png, image/webp                  | 10 MB             |
| Verifikatsiya hujjati            | application/pdf, image/jpeg, image/png             | 20 MB             |
| Yozishma ilovasi                 | application/pdf, image/jpeg, image/png, image/webp | 10 MB             |
| Import                           | text/csv, .xlsx                                    | 5 MB, 5 000 qator |

- Yuklash: presigned URL → complete → antivirus skanlash (ClamAV) → SCANNED_CLEAN bo‘lgandan keyin foydalaniladi.

- Rasm EXIF ma’lumotlari (GPS bilan) o‘chiriladi; 320/640/1280 px WebP variantlar yaratiladi.

## 10.3. Rate limit jadvali

| **Endpoint guruhi**               | **Limit**                                  |
|-----------------------------------|--------------------------------------------|
| auth/login, auth/register         | 10/daqiqa/IP; 20/soat/akkaunt              |
| auth/otp/request                  | 3/daqiqa va 10/kun bitta raqam/email uchun |
| calculations/estimate (guest)     | 10/daqiqa/IP, 100/kun/IP                   |
| calculations/estimate (logged-in) | 30/daqiqa/user                             |
| geocoding                         | 30/daqiqa/IP                               |
| quote-requests                    | 5/kun/user                                 |
| messages                          | 60/daqiqa/user                             |
| public list/search                | 120/daqiqa/IP                              |
| widget lead                       | 5/soat/IP                                  |

# 11. Quyosh energiyasi hisoblash — to‘liq biznes mantiqi

Barcha formulalar `src/modules/calculator/engine/` da sof funksiyalar sifatida yoziladi. Hisob deterministik: bir xil input + modelVersion + dataset = bir xil natija. Barcha default parametrlar CalculationSettings.parametersJson dan olinadi; kodda qattiq yozilgan raqam bo‘lmaydi.

## 11.1. Kiruvchi parametrlar

| **Parametr**                    | **Birlik / format**                         | **Talab**                                                                                                                                              |
|---------------------------------|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Latitude / longitude            | degree                                      | Manzil koordinatasi                                                                                                                                    |
| Hisob davri                     | —                                           | Tipik meteorologik yil (TMY) asosida 8760 soat; natija kun/hafta/oy/yilga yig‘iladi                                                                    |
| Area polygon                    | GeoJSON Polygon/MultiPolygon                | Serverda validatsiya                                                                                                                                   |
| Projected area                  | m²                                          | Poligonning gorizontal proyeksiyasi (PostGIS geography)                                                                                                |
| Roof shape, tilt, azimuth       | enum, degree                                | 10.1 konvensiyasi; noma’lum bo‘lsa default va noaniqlik                                                                                                |
| Usable area factor              | 0..1                                        | Default 0,70 (qiya tom), 0,80 (tekis tom/yer)                                                                                                          |
| System type                     | ON_GRID / HYBRID / OFF_GRID                 | Majburiy. Default: Tez/Batafsil hisobda ON_GRID; /outage kalkulyatorida va mijoz "Uzilishda ham ishlashi kerak" texnikalarni belgilaganda HYBRID (4.9) |
| Panel                           | ProductModel yoki default                   | Default: 550 W, 2278×1134 mm, −0,35 %/°C, degradatsiya 0,5 %/yil                                                                                       |
| Shading level                   | NONE/LIGHT/HEAVY                            | Yo‘qotish: 0 % / 7 % / 18 % (settings)                                                                                                                 |
| System losses                   | fraction                                    | Kabel, mismatch, ulanishlar va boshqalar: default 8 %; soiling (chang) default 4 %; har biri bir marta qo‘llanadi                                      |
| Consumption                     | kWh/oy, so‘m/oy, 12 oy yoki maishiy texnika | Kiritish turi (provenance) saqlanadi                                                                                                                   |
| Load profile                    | LoadProfile code yoki maishiy texnikadan    | Default HOUSEHOLD_STD                                                                                                                                  |
| Battery                         | kWh, kW, round-trip efficiency, SOC min/max | Default: efficiency 0,90, SOC 10–100 % (LiFePO4)                                                                                                       |
| Customer type                   | HOUSEHOLD / LEGAL                           | Tarif va eksport qoidasi tanlovi uchun                                                                                                                 |
| Tariff, export rule, grid limit | versioned ID                                | Hisob sanasida amaldagi PUBLISHED yozuv                                                                                                                |
| CAPEX/OPEX                      | so‘m                                        | Uskuna, montaj, yetkazish, servis, almashtirish                                                                                                        |
| Financing                       | FinancingProduct yoki qo‘lda                | Ixtiyoriy                                                                                                                                              |

## 11.2. Quyosh chiqishi/botishi

- Sunrise/sunset astronomik formula (NOAA algoritmi) bilan hisoblanadi; koordinata, sana va Asia/Tashkent vaqt mintaqasi hisobga olinadi.

- Bu vaqtlar faqat ma’lumot uchun ko‘rsatiladi; kWh ishlab chiqarish faqat irradiance/PV-yield ma’lumotlaridan hisoblanadi.

## 11.3. Maydon geometriyasi va panel soni

> projectedAreaM2 = ST_Area(polygon::geography)
>
> surfaceAreaM2 = roofShape == PITCHED ? projectedAreaM2 / cos(tilt) : projectedAreaM2
>
> usableAreaM2 = surfaceAreaM2 × usableFactor

Qiya tomda panel tom tekisligiga parallel o‘rnatiladi deb hisoblanadi; xaritadagi poligon gorizontal proyeksiya bo‘lgani uchun haqiqiy yuza cos(tilt) ga bo‘linadi (30° da ≈ +15 %).

Tekis tom va yerda panellar qatorlar bilan, qiyalik β (default 25°) bilan o‘rnatiladi va qatorlar orasidagi masofa qishki soyani oldini olish uchun hisoblanadi:

> αmin = 90° − \|latitude\| − 23,44° \# 21-dekabr peshindagi quyosh balandligi
>
> L = panel uzunligi (qiyalik bo'ylab, m)
>
> rowPitch = L × (cos β + sin β / tan αmin)
>
> panelsPerRow = floor(rowWidth / panelWidth)

Qiya tomda: maxPanelCountByArea = floor(usableAreaM2 / panelAreaM2 × 0,90). Panel portret yoki landshaft joylashuvi ikkalasi hisoblanib, ko‘prog‘i tanlanadi (to‘g‘ri to‘rtburchak yaqinlashuvi: poligonning minimal o‘rab turuvchi to‘rtburchagi bo‘yicha).

Natija "taxminiy sig‘im" deb ko‘rsatiladi va professional layout o‘rnini bosmaydi.

## 11.4. Tizim hajmini tavsiya qilish algoritmi

> annualLoadKwh = 12 oylik iste'mol yig'indisi
>
> specificYield = solar dataset bo'yicha 1 kWp yillik ishlab chiqarish (tilt/azimut/soya bilan)
>
> coverageTarget = exportRule.compensationType ∈ {NET_METERING, NET_BILLING, FEED_IN} va VERIFIED ? 1,00 : 0,80
>
> kWp_needed = annualLoadKwh × coverageTarget / specificYield
>
> kWp_area = maxPanelCountByArea × Pnom / 1000
>
> kWp_grid = GridConnectionLimit.maxKw × dcAcRatio (ON_GRID/HYBRID uchun)
>
> kWp_budget = budget berilgan bo'lsa: budget / narx_per_kWp (katalog medianasi)
>
> recommendedKwp = min(kWp_needed, kWp_area, kWp_grid, kWp_budget)
>
> panelCount = floor(recommendedKwp × 1000 / Pnom), kamida 1

- OFF_GRID uchun: kWp_needed eng yomon oy (odatda dekabr) bo‘yicha hisoblanadi: kWp = (dekabr kunlik iste'moli × 1,15) / dekabr kunlik specificYield.

- Uchta variant: **Tejamkor** = 0,6 × recommended; **Muvozanatli** = recommended; **Maksimal** = min(kWp_area, kWp_grid). Har biri butun panel soniga yaxlitlanadi; Maksimal Muvozanatlidan ≤ 5 % farq qilsa ko‘rsatilmaydi.

- Qaysi cheklov hal qiluvchi bo‘lgani UIda yoziladi: "Tom maydoni cheklaydi", "Ulanish limiti cheklaydi" va h.k.

## 11.5. Invertor va akkumulyator hajmini tanlash

- Invertor AC quvvati: inverterKw = DC_kWp / dcAcRatio (default dcAcRatio 1,20), keyin standart qatordagi keyingi kattaroq qiymatga: 3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50 kW.

- HYBRID/OFF_GRID: invertor quvvati kritik yuklamaning pik quvvatidan (ishga tushish koeffitsienti bilan, 11.12) kam bo‘lmasligi kerak; kam bo‘lsa kattaroq invertor tanlanadi.

- Invertor clipping: soatlik simulyatsiyada AC chiqishi inverterKw bilan cheklanadi; clipping yo‘qotishi natijada alohida ko‘rsatiladi.

- Akkumulyator tavsiyasi:

<!-- -->

- Zaxira maqsadi: E_batt = criticalLoadKw × backupHours / (usableDoD × η).

- O‘z iste’molini oshirish maqsadi (HYBRID): E_batt = o'rtacha kechki/tungi iste'mol (18:00–07:00).

- OFF_GRID: E_batt = kunlik iste'mol × autonomyDays (default 1,5) / (usableDoD × η).

- Natija 2,5 kWh qadamga yuqoriga yaxlitlanadi.

## 11.6. Ishlab chiqarish prognozi va ma’lumot manbasi (yakuniy qaror)

| **Usul**   | **Manba**                                                                                                                                                                                     | **Qachon**                                                                                 |
|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| A (asosiy) | PVGIS API — seriescalc (pvcalculation=1) yoki PVcalc: 1 kWp uchun soatlik PV chiqishi, tilt/aspect/loss parametrlari bilan, TMY                                                               | Default                                                                                    |
| B (zaxira) | NASA POWER soatlik irradiance (GHI, DNI, DHI, harorat) + calc-engine’dagi TS PV modeli (Erbs dekompozitsiyasi, Hay-Davies transpozitsiyasi, harorat modeli NOCT, invertor samaradorligi 0,97) | PVGIS mavjud bo‘lmaganda                                                                   |
| DEFAULT    | Admin kiritgan viloyat bo‘yicha oylik specific yield jadvali                                                                                                                                  | Ikkala provider ham mavjud bo‘lmasa; "Provider ma’lumoti yo‘q, viloyat o‘rtachasi" belgisi |

- Python/pvlib ishlatilmaydi; B usulining TS implementatsiyasi PVGIS natijalari bilan golden test orqali tekshiriladi (17.1).

- Kesh: koordinata 0,05° to‘rga yaxlitlanadi (cellKey), tilt va azimut 5° qadamga. Saqlanadigan qator — **1 kWp uchun normallashgan** soatlik ishlab chiqarish; tizim quvvatiga ko‘paytiriladi. Kesh muddati 180 kun; muddati o‘tgan kesh STALE sifatida ishlatilishi mumkin va fon jobi yangilaydi.

- PVGIS loss parametri 0 bilan so‘raladi; barcha yo‘qotishlar (tizim, soiling, soya, clipping) faqat calc-engine’da bir marta qo‘llanadi. B usulida ham xuddi shu yo‘qotishlar ro‘yxati. Bir yo‘qotish ikki marta qo‘llanmaydi.

- Harorat ta’siri: A usulida PVGIS ichida; B usulida panel tempCoeffPmax bilan.

- Degradatsiya 1-yil uchun qo‘llanmaydi; 25 yillik modelda (11.10).

- Soatlik vaqt: provider qatorlari UTC’da keladi va Asia/Tashkent (UTC+5, yozgi vaqt yo‘q) ga o‘giriladi.

- Kunlik/haftalik/oylik/yillik natijalar soatlik qatorlar yig‘indisi.

> E_gen\[t\] = kWp × yield1kWp\[t\] × (1 − shadingLoss) × (1 − systemLoss) × (1 − soilingLoss)
>
> E_ac\[t\] = min(E_gen\[t\], inverterKw × 1h)

## 11.7. Iste’mol va yuklama profili

- Oylik kWh kiritilsa: 12 oyga LoadProfile.monthlyFactors bilan taqsimlanadi (yillik o‘rtacha kiritilgan qiymatga teng bo‘ladigan qilib normallashtiriladi).

- 12 oylik qiymat kiritilsa: shu qiymatlar ishlatiladi.

- Shablon (ApplianceTemplate) tanlansa, u maishiy texnika ro‘yxatini to‘ldiradi va keyin oddiy ro‘yxat kabi hisoblanadi; provenance FROM_APPLIANCES + templateCode.

- Maishiy texnika ro‘yxati: har bir texnika uchun power × count × hours × kunlar (faqat tanlangan oylarda) va hourlyUsageTemplate bo‘yicha soatlik taqsimot. Natija 1,10 koeffitsient bilan (hisobga olinmagan mayda iste’mol) ko‘paytiriladi.

- Soatlik profil: oylik kWh × LoadProfile.hourlyFactors\[oy\]\[soat\] (har oy uchun 24 qiymat yig‘indisi 1).

- Faqat so‘m kiritilsa: tarif bo‘yicha teskari hisob (11.8.3). Ikkalasi kiritilsa farq ko‘rsatiladi va mijoz qaysi birini asos qilishni tanlaydi (default: kWh).

- Natijada provenance saqlanadi: USER_KWH, USER_12_MONTHS, FROM_BILL, FROM_APPLIANCES.

## 11.8. Tarif dvigateli

### 11.8.1. Tarif tuzilmasi

- TariffSchedule: hudud + iste’molchi turi + effective davr; qat’iy oylik to‘lov (bo‘lsa); kun/tun rejimi (bo‘lsa).

- TariffTier: pog‘ona (minKwh–maxKwh), mavsum (oylar), kun/tun davri.

- Pog‘onalar har bir hisob oyi uchun kumulyativ qo‘llanadi: oy ichidagi iste’molning birinchi qismi 1-pog‘ona stavkasida, keyingisi 2-pog‘onada va h.k.

- Pog‘ona chegarasi: minKwh kiradi, maxKwh kirmaydi (\[min, max)).

### 11.8.2. Hisob

> billMonth(kWh_by_tou, month) =
>
> fixedChargeMonthly
>
> \+ Σ_tou Σ_tier min(max(kWh_tou − tier.min, 0), tier.max − tier.min) × tier.rate
>
> billWithoutSolar = Σ_month billMonth(load\[month\])
>
> billWithSolar = Σ_month billMonth(netImport\[month\]) \# 11.9 ga qarang
>
> saving = billWithoutSolar − billWithSolar

### 11.8.3. Billdan kWh ni teskari hisoblash

Pog‘onali tarifda billMonth(kWh) monoton o‘suvchi bo‘lgani uchun binar qidiruv bilan (0..100 000 kWh, aniqlik 0,1 kWh) billMonth(kWh) = kiritilgan summa yechiladi. Kun/tun tarifida LoadProfile bo‘yicha kun/tun ulushi qo‘llanadi. Natija "billdan taxmin qilingan" belgisi bilan.

- Amaldagi tarif topilmasa: tizim o‘zboshimchalik bilan stavka tanlamaydi; TARIFF_NOT_FOUND statusi va "Tarif ma’lumoti yo‘q — kWh kiriting" xabari; moliyaviy bloklar "hisoblab bo‘lmaydi" holatida.

## 11.9. Energiya balansi va eksport kompensatsiyasi

Balans soatlik qadamda hisoblanadi.

> direct\[t\] = min(E_ac\[t\], load\[t\])
>
> surplus\[t\] = E_ac\[t\] − direct\[t\]
>
> deficit\[t\] = load\[t\] − direct\[t\]
>
> \# Akkumulyator (HYBRID/OFF_GRID):
>
> charge\[t\] = min(surplus\[t\], P_batt_max, (SOCmax − SOC\[t−1\]) × C / η_c)
>
> discharge\[t\] = min(deficit\[t\], P_batt_max, (SOC\[t−1\] − SOCmin) × C × η_d)
>
> SOC\[t\] = SOC\[t−1\] + (charge\[t\] × η_c − discharge\[t\] / η_d) / C
>
> gridImport\[t\] = deficit\[t\] − discharge\[t\]
>
> gridExport\[t\] = surplus\[t\] − charge\[t\] \# OFF_GRID da: curtailment\[t\], eksport = 0

- η_c = η_d = √(round-trip efficiency). SOC boshlang‘ich qiymati 50 %. Akkumulyator tarmoqdan zaryadlanmaydi (V1.0 qarori).

- Har bir soat uchun invariant tekshiriladi: E_ac = direct + charge + gridExport (+ curtailment), load = direct + discharge + gridImport, SOCmin ≤ SOC ≤ SOCmax.

Eksport kompensatsiyasi ExportRule.compensationType bo‘yicha:

| **Tur**                  | **Hisob**                                                                                                                                                                                  |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| NONE yoki tasdiqlanmagan | netImport\[month\] = Σ gridImport; eksport kWh ko‘rsatiladi, puli "tasdiqlanmagan, hisoblanmadi"                                                                                           |
| NET_METERING             | netImport\[month\] = max(Σ gridImport − Σ gridExport − carryOver, 0); ortiqcha kWh keyingi oyga o‘tadi (settlementPeriod YEAR bo‘lsa yil oxirida nollanadi); alohida eksport daromadi yo‘q |
| NET_BILLING / FEED_IN    | netImport\[month\] = Σ gridImport; exportIncome = Σ gridExport × ratePerKwh                                                                                                                |

- maxSystemKw dan katta tizimda eksport qoidasi qo‘llanmaydi va ogohlantirish chiqadi.

- Soliq, subsidiya, kompensatsiya yoki imtiyoz faqat rasmiy manba va eligibility tekshirilgan bo‘lsa qo‘shiladi.

## 11.10. CAPEX, OPEX, qoplanish va 25 yillik model

> initialCost = equipmentCost + installationCost + deliveryCost + otherOneTimeCosts
>
> annualNetBenefit1 = saving1 + exportIncome1 − annualOpex1
>
> simplePaybackYears = initialCost / annualNetBenefit1 \# faqat annualNetBenefit1 \> 0

- Xarajatlar quote bo‘lmasa katalogdagi tasdiqlangan takliflar medianasidan (oxirgi 90 kun), montaj — kVt uchun mediana narxdan olinadi va "taxminiy" belgilanadi. Quote tanlansa, quote qiymatlari bilan qayta hisoblanadi.

- annualNetBenefit ≤ 0 bo‘lsa: "O‘zini oqlamaydi — yillik sof foyda musbat emas" (paybackUnavailableReason = NON_POSITIVE_BENEFIT).

25 yillik model (N = 25, settings):

> production_y = production_1 × (1 − d)^(y−1) \# d = panel degradatsiyasi
>
> tariff_y = tariff_1 × (1 + e)^(y−1) \# e = tarif o'sishi (default settings, mijoz o'zgartira oladi)
>
> benefit_y = saving_y(production_y, tariff_y) + exportIncome_y − opex_1 × (1 + i)^(y−1)
>
> replacement = inverter: 12-yilda inverterCost × replacementFactor; akkumulyator: cycles/yillik sikl bo'yicha hisoblangan yilda
>
> cashFlow_0 = −initialCost
>
> cashFlow_y = benefit_y − replacement_y
>
> NPV = Σ cashFlow_y / (1 + r)^y \# r = diskont stavkasi
>
> IRR = NPV = 0 bo'ladigan r (Newton–Raphson, bisection fallback; topilmasa "hisoblanmadi")
>
> LCOE = (initialCost + Σ (opex_y + replacement_y)/(1+r)^y) / Σ (production_y/(1+r)^y)
>
> discountedPayback = jamg'arilgan diskontlangan oqim ≥ 0 bo'lgan birinchi yil
>
> CO2_kg = Σ production_y × gridEmissionFactor \# factor settings'da, manbasi bilan

- Ssenariylar: konservativ / standart / optimistik. Farqlar (settings): yield −10 % / 0 / +5 %; yo‘qotishlar +3 p.p. / 0 / −2 p.p.; tarif o‘sishi standart − 2 p.p. / standart / standart + 2 p.p. Farqlar foydalanuvchiga ochiq ko‘rsatiladi.

## 11.11. Moliyalashtirish (kredit/bo‘lib to‘lash) hisobi

> financedAmount = initialCost − downPayment
>
> totalFees = financedAmount × oneTimeFeePct + monthlyFee × n
>
> r = annualRate / 12
>
> ANNUITY: payment = financedAmount × r / (1 − (1 + r)^(−n)); r = 0 bo'lsa financedAmount / n
>
> DIFFERENTIATED: principal = financedAmount / n
>
> payment_k = principal + (financedAmount − principal × (k − 1)) × r
>
> totalPaid = Σ payment_k + totalFees + downPayment
>
> overpayment = totalPaid − initialCost
>
> monthlyNet_k = payment_k + monthlyFee − monthlySaving_k \# monthlySaving — 11.8–11.9 dan oylik
>
> breakEvenMonth = jamg'arilgan (tejash − to'lovlar − downPayment) ≥ 0 bo'lgan birinchi oy
>
> shortestSelfFundingTerm = allowedTerms ichida max(payment_k + monthlyFee) ≤ o'rtacha oylik tejash bo'lgan eng qisqa muddat

- Natija: oylik to‘lov (differensialda birinchi va oxirgi), jami to‘lov, ortiqcha to‘lov, oylik "cho‘ntakdan" summa, breakEvenMonth, shortestSelfFundingTerm, oylik jadval.

- Do‘kon taklifida QuoteFinancingOption bo‘lsa, solishtirish ekranida shu shart bilan ham hisoblanadi.

- Barcha natijalar "taxminiy" va FinancingProduct manbasi/sanasi bilan ko‘rsatiladi.

## 11.12. Elektr uzilishi (zaxira) hisobi

> criticalLoadKw = Σ (power × count) kritik texnikalar uchun / 1000
>
> peakStartKw = Σ (power × count × (isMotorLoad ? surgeFactor : 1)) / 1000 \# surge default 3
>
> usableBatteryKwh = C × (SOCmax − SOCmin) × η_d
>
> backupHoursNight = usableBatteryKwh / criticalLoadKw
>
> backupHoursDay = kunduzi: o'rtacha quyosh ishlab chiqarishi criticalLoad'ni qoplasa "quyosh bor paytda cheksiz", aks holda usableBatteryKwh / (criticalLoadKw − avgSolarKw)
>
> inverterOk = inverterKw ≥ criticalLoadKw va inverterSurgeKw (inverterKw × 2, datasheet bo'lsa undan) ≥ peakStartKw

- ON_GRID tizimda zaxira 0 va aniq ogohlantirish (4.9).

- Natija oylar bo‘yicha (qish/yoz) ham ko‘rsatiladi.

## 11.13. Uskunalar mosligi tekshiruvi

Qoida asosida (AI’siz), ProductModel’dagi tiplangan maydonlar bo‘yicha. Natija: OK, WARNING, ERROR va izoh.

> Voc_cold = Voc × (1 + tempCoeffVoc × (Tmin − 25)) \# Tmin settings'da (default −15 °C), tempCoeffVoc yo'q bo'lsa −0,28 %/°C
>
> Vmp_hot = Vmp × (1 + tempCoeffPmax × (Tmax_cell − 25)) \# Tmax_cell default 70 °C
>
> seriesCount × Voc_cold ≤ inverterMaxDcV \# aks holda ERROR
>
> seriesCount × Vmp_hot ≥ mpptMinV \# aks holda WARNING
>
> seriesCount × Vmp ≤ mpptMaxV \# aks holda WARNING
>
> parallelStrings × Imp ≤ mpptMaxCurrentA \# aks holda WARNING (clipping)
>
> batteryVoltageV == inverter battery voltage \# aks holda ERROR
>
> batteryChemistry ∈ inverter qo'llaydiganlar \# aks holda ERROR
>
> DC_kWp / inverterAcKw ∈ \[1,0; 1,35\] \# aks holda WARNING

- Ma’lumot yetarli bo‘lmasa UNKNOWN holati ("Datasheet ma’lumoti yetarli emas").

- UIda: "Bu dastlabki texnik tekshiruv; yakuniy loyihani montajchi tasdiqlaydi."

## 11.14. Natija formatidagi majburiy maydonlar

- systemType, systemPowerKw, panelCountEstimate, inverterKw, batteryKwh, projectedAreaM2, surfaceAreaM2, usableAreaM2, limitingFactor.

- sizingOptions (Tejamkor/Muvozanatli/Maksimal).

- daily/weekly/monthly/annual generation kWh; clippingLossKwh; curtailmentKwh.

- monthly/annual load kWh, consumptionProvenance, selfConsumed kWh, batteryThroughput kWh, gridImport kWh, gridExport kWh.

- billWithoutSolar, billWithSolar, savings, exportIncome {status: VERIFIED/UNVERIFIED/NOT_APPLICABLE, value}, annualOpex, initialCost, costProvenance.

- simplePaybackYears yoki paybackUnavailableReason; lifetime {years\[\], npv, irr, lcoe, discountedPayback, co2Kg}.

- financing (tanlangan bo‘lsa), outage (hisoblangan bo‘lsa), compatibility (modellar tanlangan bo‘lsa).

- insights\[\]: {type, month, value} — qoidalar: BEST_SAVING_MONTH (oylik tejash maksimumi), LOWEST_GENERATION_MONTH (ishlab chiqarish minimumi va maksimumga nisbati, nisbat ≥ 1,5 bo‘lsa), PEAK_IMPORT_MONTH (tarmoqdan olish maksimumi), BATTERY_CRITICAL_MONTH (HYBRID/OFF_GRID: tungi yuklama / akkumulyator sig‘imi nisbati eng katta oy), SUMMER_SURPLUS (iyun–avgust eksporti yillik eksportning ≥ 40 % bo‘lsa). Har biri calc-engine’da deterministik hisoblanadi.

- scenarioLow/base/high, modelVersion, calculationSettingsId, tariffVersion, exportRuleVersion, solarDataSource, productionMethod, exchangeRate, assumptions\[\], warnings\[\], calculatedAt.

## 11.15. Unumdorlik

- estimate p95 ≤ 1,5 s (solar kesh mavjud), ≤ 8 s (provider’dan yangi yuklash bilan); timeout 10 s.

- Soatlik simulyatsiya (8760 × 3 ssenariy) bitta so‘rovda ≤ 300 ms (calc-engine benchmark testi bilan).

- Bir xil cellKey uchun bir vaqtdagi provider so‘rovlari birlashtiriladi (Redis lock), provider’ga bitta so‘rov ketadi.

# 12. Xarita va geospatial qoidalar

- MapLibre GL JS renderer; tile provider (vektor xarita + sun’iy yo‘ldosh rastri) alohida adapter/config orqali tanlanadi. Provider shartlari, rate limit va attribution tekshiriladi. \*\*V1.0 qarori — Esri (ArcGIS Location Platform), bepul tarif;\*\* tafsilotlar quyida.

- Marker API viewport bounds bo‘yicha qidiradi; zoom \< 13 da server-side klasterlash; barcha do‘konlar bitta javobda qaytarilmaydi.

- PostGIS turlari: nuqtalar va xizmat hududlari — geography (masofa va maydon metrda); mijoz poligoni — geometry(Polygon,4326), maydon ST_Area(polygon::geography) bilan geodezik hisoblanadi.

- Polygon validatsiya: 10.1 bo‘yicha.

- Server maydon yuzasini qayta hisoblaydi; klient yuborgan qiymat faqat preview.

- Service area va mijoz tomi poligoni turli entity va turli jadvallarda.

- Uy poligoni va aniq manzil private: public API, ulashilgan hisob va do‘kon (kontakt ochilmaguncha) ularni olmaydi.

- Geocoding qidiruvlari rate-limited; natijalari serverda saqlanmaydi va keshlanmaydi (12.1).

- Do‘kon qidiruvi masofa bo‘yicha ST_DWithin + \<-\> KNN indeksi bilan.

### 12.1. Xarita provayderi: Esri (bepul tarif)

- **Ulanish:** MapLibre GL JS + rasmiy MapLibre ArcGIS plagini; oddiy xarita arcgis/streets (yoki arcgis/navigation), sun’iy yo‘ldosh arcgis/imagery basemap uslubi; til parametri uz/ru. Kalit — ArcGIS Location Platform’ning bepul akkauntida yaratilgan API key, faqat xarita va geocoding huquqlari bilan, ruxsat etilgan domenlar (referrer) bilan cheklangan.

- **Bepul limitlar** (2026-10 holatiga, provayder sahifasida qayta tekshiriladi): basemap plitkalari — oyiga 2 000 000; geocoding (natija saqlanmasa) — oyiga 20 000. Limitdan keyingi narx: 1 000 plitka — \$0,15; 1 000 geocode — \$0,50; saqlanadigan geocode — \$4 / 1 000.

- **Attribution (majburiy):** xaritaning o‘ng pastida "Powered by Esri" (Esri — esri.com havolasi) va basemap xizmatining copyrightText matni doim ko‘rinib turadi; kichik ekranda ochiladigan tugma; boshqa UI uni yopmaydi. Plagin buni avtomatik qo‘yadi — o‘chirish taqiqlanadi.

- **Geocoding:** manzil qidiruvi Esri geocoding orqali forStorage=false bilan; natijalar serverda keshlanmaydi va bazaga yozilmaydi. Bazada saqlanadigan koordinata — foydalanuvchi xaritada **o‘zi tasdiqlagan pin** (foydalanuvchi ma’lumoti). Teskari geocoding faqat ko‘rsatish uchun.

- **Kvota nazorati:** provider-quota-poll jobi (14.1) ishlatilgan plitka va geocode sonini oladi; 80 % da Super Admin’ga ogohlantirish, 95 % da kritik alert (DevOps paneli, 19.1).

- **Limit tugaganda (fallback):** sun’iy yo‘ldosh qatlami o‘chadi va foydalanuvchiga "Sun’iy yo‘ldosh xaritasi vaqtincha mavjud emas — maydonni raqam bilan kiriting" ko‘rsatiladi; oddiy xarita OpenStreetMap asosidagi zaxira uslubga (MAP_FALLBACK_STYLE_URL) o‘tadi; manzil qidiruvi o‘rniga pin va koordinata. Kalkulyator ishlashda davom etadi. API MAP_QUOTA_EXCEEDED ni frontendga signal sifatida beradi.

- **Production’dan oldin majburiy:** (1) foydalanuvchi tomni sun’iy yo‘ldosh rasmi ustida chizib, poligonni saqlashiga ruxsat — Esri’dan yozma tasdiq; (2) O‘zbekistonning 10 ta nuqtasida (Toshkent, Samarqand, Nukus, Farg‘ona, Termiz, 5 ta qishloq) rasm aniqligi va sanasi tekshiruvi; (3) ruxsat bo‘lmasa yoki sifat yetarli bo‘lmasa — pullik provayderga adapter orqali o‘tish (23-bo‘lim), kod o‘zgarmaydi.

- **Keyinga o‘tish yo‘li:** trafik oshib bepul limitdan chiqsa, Esri’ning pullik tarifiga o‘tiladi (billing ulanadi) yoki provayder almashtiriladi — faqat env va adapter.

# 13. So‘rov, taklif va montaj biznes qoidalari

## 13.1. Statuslar va o‘tish jadvallari

**QuoteRequest.status**

| **Dan** | **Ga**              | **Kim / qachon**                           |
|---------|---------------------|--------------------------------------------|
| —       | OPEN                | Customer yaratadi                          |
| OPEN    | CLOSED_SELECTED     | Customer taklifni qabul qiladi (avtomatik) |
| OPEN    | CLOSED_NO_SELECTION | Customer yopadi                            |
| OPEN    | EXPIRED             | 30 kun faollik yo‘q (job)                  |
| OPEN    | CANCELLED           | Customer hisobini o‘chiradi                |

**QuoteRequestShop.status**

| **Dan**                                       | **Ga**                  | **Kim / qachon**                                                       |
|-----------------------------------------------|-------------------------|------------------------------------------------------------------------|
| —                                             | SENT                    | So‘rov yaratilganda                                                    |
| SENT                                          | VIEWED                  | Do‘kon a’zosi birinchi ochganda                                        |
| SENT, VIEWED                                  | CLARIFICATION_REQUESTED | Do‘kon savol yuboradi                                                  |
| CLARIFICATION_REQUESTED                       | VIEWED                  | Mijoz javob beradi                                                     |
| SENT, VIEWED, CLARIFICATION_REQUESTED         | QUOTED                  | Do‘kon taklif yuboradi                                                 |
| SENT, VIEWED, CLARIFICATION_REQUESTED         | DECLINED                | Do‘kon rad etadi (sabab majburiy)                                      |
| QUOTED                                        | SELECTED                | Mijoz shu do‘kon taklifini qabul qiladi                                |
| QUOTED, VIEWED, SENT, CLARIFICATION_REQUESTED | NOT_SELECTED            | Mijoz boshqa taklifni qabul qiladi yoki so‘rov yopiladi/muddati o‘tadi |

**Quote.status**

| **Dan**             | **Ga**    | **Kim / qachon**                                              |
|---------------------|-----------|---------------------------------------------------------------|
| —                   | DRAFT     | Do‘kon yaratadi                                               |
| DRAFT               | SENT      | send (revision 1)                                             |
| SENT                | VIEWED    | Mijoz birinchi ochganda                                       |
| SENT, VIEWED        | SENT      | revise (revision +1, mijozga xabar, VIEWED qayta hisoblanadi) |
| SENT, VIEWED        | ACCEPTED  | Mijoz qabul qiladi (validUntil o‘tmagan)                      |
| SENT, VIEWED        | REJECTED  | Mijoz rad etadi yoki boshqa taklif qabul qilinadi             |
| SENT, VIEWED        | EXPIRED   | validUntil o‘tadi (job)                                       |
| DRAFT, SENT, VIEWED | WITHDRAWN | Do‘kon qaytarib oladi                                         |

**Installation.status**

| **Dan**                                              | **Ga**                   | **Kim / qachon**                                      |
|------------------------------------------------------|--------------------------|-------------------------------------------------------|
| —                                                    | AGREED                   | Quote ACCEPTED bo‘lganda                              |
| AGREED                                               | SITE_VISIT_SCHEDULED     | O‘lchov tasdiqlanadi                                  |
| AGREED, SITE_VISIT_SCHEDULED                         | INSTALLATION_SCHEDULED   | Do‘kon montaj sanasini belgilaydi                     |
| INSTALLATION_SCHEDULED                               | INSTALLED                | Do‘kon "Montaj bajarildi" deydi                       |
| INSTALLED                                            | CONFIRMED                | Mijoz chek-listni to‘liq to‘ldirib tasdiqlaydi (13.7) |
| INSTALLED                                            | DISPUTED                 | Mijoz e’tiroz bildiradi (admin ko‘radi)               |
| DISPUTED                                             | CONFIRMED yoki CANCELLED | Admin qarori                                          |
| AGREED, SITE_VISIT_SCHEDULED, INSTALLATION_SCHEDULED | CANCELLED                | Har ikki tomon (sabab majburiy)                       |

- INSTALLED holatida mijoz 14 kun ichida javob bermasa, unga 3 marta eslatma yuboriladi; avtomatik tasdiqlash yo‘q.

- Jadvalda yo‘q o‘tish 409 INVALID_STATUS_TRANSITION qaytaradi. O‘tish qoidalari har entity uchun `src/modules/<entity>/<entity>-state-machine.ts` da (GetMaster `order-state-machine.ts` naqshi); controller emas, service chaqiradi.

## 13.2. Kontaktni ochish siyosati

- Kontakt ochilmaguncha do‘kon ko‘radi: hudud/tuman, tizim turi va quvvati, iste’mol, maydon hajmi, hisob xulosasi, mijoz izohi. Ko‘rmaydi: ism-familiya (faqat ism), telefon, email, aniq manzil, poligon.

- Kontakt ochiladi: mijoz "Kontaktni ochish" tugmasini bosganda, o‘lchov uchrashuvini tasdiqlaganda yoki taklifni qabul qilganda (contactRevealedAt).

- Yozishma kontakt ochilmasdan ham ishlaydi.

## 13.3. Taklif qoidalari

- Do‘kon taklif yuborishi uchun so‘rovga qabul qiluvchi bo‘lishi va so‘rov OPEN bo‘lishi shart.

- Qator jami serverda quantity × unitPrice; subtotal va total serverda yig‘iladi: total = equipmentSubtotal + installationSubtotal + deliveryCost + otherCosts − discountAmount (+ vatAmount, agar vatIncluded = false); manfiy total taqiqlangan.

- Taklif valyutasi bitta. Katalog narxi USD bo‘lsa, quote builder MB kursi bo‘yicha so‘mga o‘girib taklif qiladi; quote’da kurs va sanasi saqlanadi.

- Taklifda validUntil, kafolat (uskuna va montaj alohida), montaj muddati, nimalar kiradi va kirmaydi — majburiy.

- Har bir yuborish/yangilash QuoteRevision snapshot yaratadi; mijoz revisionlar tarixini ko‘radi.

- Bitta so‘rovga bitta do‘kondan bitta faol taklif.

- Taklifni qabul qilish platforma ichidagi shartnoma yoki to‘lov emas; UIda "Siz bu do‘kon bilan ishlashni tanladingiz" deb nomlanadi.

## 13.4. Sharh qoidalari

- Sharh faqat Installation.CONFIRMED dan keyin, faqat shu montaj mijozi tomonidan, bitta montajga bitta sharh.

- Sharh 1..5 reyting + izoh (ixtiyoriy, max 2 000). Avtomatik filtr (havolalar, telefon raqamlari) bo‘lsa PENDING, aks holda darhol PUBLISHED.

- Do‘kon har bir sharhga bitta ommaviy javob yozadi.

- Reyting: PUBLISHED sharhlarning o‘rtachasi; profil "N ta tasdiqlangan montaj asosida" deb ko‘rsatadi.

- **Soxta sharhlarga qarshi qoidalar** (deterministik, AI’siz). Sharh yuborilganda quyidagi belgilar hisoblanadi va riskFlags/riskScore ga yoziladi:

| **Belgi**               | **Shart**                                                                              | **Ball**   |
|-------------------------|----------------------------------------------------------------------------------------|------------|
| SELF_REVIEW             | Sharh muallifi shu do‘konning a’zosi (yoki oxirgi 90 kunda a’zo bo‘lgan)               | Bloklanadi |
| SHARED_DEVICE_WITH_SHOP | deviceHash yoki ipHash oxirgi 30 kunda shu do‘kon a’zosi tomonidan ishlatilgan         | 60         |
| NEW_ACCOUNT             | Akkaunt yoshi \< 7 kun va boshqa faolligi yo‘q                                         | 20         |
| FAST_CONFIRM            | INSTALLED dan CONFIRMED gacha \< 2 soat                                                | 20         |
| BURST                   | Shu do‘konga oxirgi 24 soatda ≥ 5 sharh                                                | 30         |
| DUPLICATE_TEXT          | Shu do‘kondagi boshqa sharh bilan trigram o‘xshashligi ≥ 0,8                           | 40         |
| SAME_IP_CLUSTER         | Bir ipHash dan oxirgi 30 kunda turli akkauntlar orqali ≥ 3 sharh (har qanday do‘konga) | 40         |
| CONTACT_IN_TEXT         | Matnda telefon raqami yoki havola                                                      | 20         |

- riskScore ≥ 40 bo‘lsa sharh PENDING (admin moderatsiyasi), aks holda darhol PUBLISHED. Moderatsiyadan o‘tmagan sharh reytingga qo‘shilmaydi. Belgilarning sababi faqat admin’ga ko‘rinadi; foydalanuvchiga "Sharhingiz tekshiruvdan keyin chiqadi" deyiladi.

- Bir do‘konning 30 kunda ≥ 3 ta sharhi SELF_REVIEW yoki SHARED_DEVICE_WITH_SHOP sababli rad etilsa, do‘konga avtomatik shikoyat (Complaint) ochiladi va admin ko‘rib chiqadi.

- Qoidalar chegaralari CalculationSettings emas, alohida ModerationSettings (admin sozlamasi, audit bilan) da saqlanadi.

## 13.5. Javob tezligi

avgResponseMinutes = oxirgi 90 kunda sentAt dan firstResponseAt gacha (birinchi xabar, aniqlashtirish yoki taklif) bo‘lgan vaqtlar medianasi (kalendar vaqti bilan, ish vaqti alohida hisobga olinmaydi). Kamida 5 ta so‘rov bo‘lsa ko‘rsatiladi. Kunlik job hisoblaydi.

## 13.6. Vidjet orqali so‘rovlar

- Vidjet Tez hisob rejimini do‘kon brendi bilan ko‘rsatadi. Mijoz natijadan keyin telefonini OTP bilan tasdiqlab, faqat shu do‘konga so‘rov yuboradi (platformada akkaunt avtomatik yaratiladi).

- Vidjet allowedDomains dan tashqarida ishlamaydi (frame-ancestors CSP).

## 13.7. Montajni qabul qilish chek-listi

- Do‘kon "Montaj bajarildi" deganda mijozga tizim turiga mos chek-list shabloni (AcceptanceChecklistTemplate) ochiladi. Default bandlar (admin o‘zgartira oladi):

<!-- -->

- Panellar mahkam o‘rnatilgan, ramkada shikast yo‘q (rasm ixtiyoriy).

- Invertor yoqilgan va ishlab chiqarishni ko‘rsatmoqda (ekran rasmi majburiy).

- Yerga ulash (zazemlenie) bajarilgan.

- DC va AC tomonida himoya avtomatlari/uzgichlar o‘rnatilgan va belgilangan.

- Kabellar himoya qutisi/gofra ichida, ochiq joyda osilib qolmagan.

- Akkumulyator (bo‘lsa) shamollatiladigan joyda, ulanishlar yopiq.

- Mijozga tizimni yoqish/o‘chirish va favqulodda o‘chirish ko‘rsatildi.

- Kafolat hujjatlari va datasheet’lar topshirildi.

- Ish joyi tozalandi, tomda shikast yo‘q.

<!-- -->

- Har bir band: OK / Muammo bor / Tegishli emas; "Muammo bor" tanlansa izoh majburiy, rasm ixtiyoriy.

- Majburiy bandlar to‘ldirilmaguncha "Tasdiqlash" tugmasi faol emas. Kamida bitta "Muammo bor" bo‘lsa mijozga ikki yo‘l: "Baribir tasdiqlash" yoki "Do‘kondan tuzatishni so‘rash" (yozishmaga avtomatik xabar, status INSTALLED qoladi) yoki "E’tiroz bildirish" (DISPUTED).

- Chek-list natijasi do‘konga ko‘rinadi va InstalledSystem kartasida saqlanadi; tasdiqlangan montajlarda "Muammosiz qabul qilingan" ulushi do‘kon analitikasida ko‘rsatiladi.

# 14. Bildirishnomalar, PDF va background jobs

## 14.1. Joblar

| **Queue/job**                  | **Trigger**                    | **Qayta urinish va xavfsizlik**                                                                                                  |
|--------------------------------|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| outbox-relay                   | Har 1 s                        | SKIP LOCKED; event bir marta queue’ga                                                                                            |
| report-generation              | Mijoz PDF so‘raydi             | Max 3 urinish; fayl private; signed URL 10 daqiqa                                                                                |
| notification-send              | Outbox eventlari               | Kanal bo‘yicha retry/backoff; idempotencyKey bilan dublikat yo‘q                                                                 |
| telegram-send                  | notification-send dan          | Telegram rate limit (30 msg/s); do‘kon xabarlariga inline tugmalar va bir martalik callback tokenlari qo‘shiladi                 |
| telegram-callback              | Telegram webhook               | Token tekshiruvi, permission, status o‘tishi 13.1 bo‘yicha; natija o‘sha Telegram xabarida tahrirlanadi ("✓ Bog‘landim — 14:32") |
| solar-data-refresh             | Kesh STALE yoki admin          | Provider kvotasi, timeout 10 s, backoff                                                                                          |
| exchange-rate-refresh          | Har kuni 09:30 (Asia/Tashkent) | MB rasmiy kursi; muvaffaqiyatsiz bo‘lsa oxirgi kurs + alert                                                                      |
| subscription-check             | Har kuni                       | Idempotent; to‘lov holati reconciliation                                                                                         |
| quote-expiry-check             | Har soat                       | EXPIRED o‘tishi va bildirishnoma                                                                                                 |
| request-expiry-check           | Har kuni                       | 30 kun faolliksiz so‘rov EXPIRED                                                                                                 |
| installation-reminder          | Har kuni                       | INSTALLED holatida tasdiqlash eslatmasi (3, 7, 14-kun)                                                                           |
| maintenance-reminder           | Har kuni                       | nextAt yetgan eslatmalar                                                                                                         |
| tariff-change-notify           | Admin tarif nashr qiladi       | Saqlangan hisobi bor va rozilik bergan mijozlarga                                                                                |
| response-time-recalc           | Har kuni                       | avgResponseMinutes                                                                                                               |
| certification-expiry           | Har kuni                       | 30 kun qolganda eslatma; muddati o‘tganda EXPIRED va belgi yashiriladi                                                           |
| support-sla-watch              | Har 5 daqiqa                   | Birinchi javob muddati yaqinlashsa/o‘tsa admin’ga ogohlantirish                                                                  |
| support-autoclose              | Har kuni                       | RESOLVED + 7 kun → CLOSED                                                                                                        |
| review-risk-scan               | Sharh yaratilganda             | 13.4 belgilarini hisoblash; idempotent                                                                                           |
| image-processing               | Fayl yuklandi                  | EXIF o‘chirish, WebP variantlar                                                                                                  |
| file-scan                      | Fayl yuklandi                  | ClamAV; INFECTED bo‘lsa fayl karantinga                                                                                          |
| import-validate / import-apply | Do‘kon import                  | Bitta tranzaksiya; xatolar fayli                                                                                                 |
| cleanup-expired                | Har kuni                       | Muddati o‘tgan report, draft, OTP, ulashish linklari; audit                                                                      |
| video-transcode                | Admin video yuklaydi           | FFmpeg: WebM (AV1/VP9), MP4 (H.264), HLS, poster, preview; max 2 urinish; natija MediaAsset.status                               |
| provider-quota-poll            | Har 15 daqiqa                  | Esri basemap va geocoding, PVGIS, SMS balansi; ProviderQuotaSnapshot; 80 % / 95 % chegaralarda alert                             |
| shop-invitation-expiry         | Har soat                       | PENDING takliflar muddati o‘tsa EXPIRED; Super Admin’ga xabar                                                                    |
| ops-backup-verify              | Har hafta                      | Oxirgi backup’ni test muhitiga tiklash; natija OpsBackupRun.restoreTestedAt                                                      |

## 14.2. Bildirishnoma turlari

| **Tur**                                                       | **Qabul qiluvchi**          | **Default kanallar**                                 |
|---------------------------------------------------------------|-----------------------------|------------------------------------------------------|
| QUOTE_REQUEST_RECEIVED                                        | Do‘kon                      | In-app, Telegram, SMS                                |
| NEW_MESSAGE                                                   | Ikkala tomon                | In-app, Telegram                                     |
| QUOTE_RECEIVED / QUOTE_REVISED                                | Mijoz                       | In-app, Telegram, SMS                                |
| QUOTE_ACCEPTED / QUOTE_NOT_SELECTED                           | Do‘kon                      | In-app, Telegram                                     |
| QUOTE_EXPIRING (48 soat qoldi)                                | Mijoz                       | In-app                                               |
| SITE_VISIT_PROPOSED / CONFIRMED                               | Ikkala tomon                | In-app, Telegram, SMS                                |
| INSTALLATION_STATUS_CHANGED                                   | Mijoz                       | In-app, Telegram                                     |
| INSTALLATION_CONFIRM_REMINDER                                 | Mijoz                       | In-app, SMS                                          |
| REVIEW_PUBLISHED / REVIEW_REPLY                               | Do‘kon / Mijoz              | In-app                                               |
| SHOP_VERIFICATION_RESULT                                      | Do‘kon                      | In-app, email, SMS                                   |
| MAINTENANCE_REMINDER / WARRANTY_EXPIRING                      | Mijoz                       | In-app, Telegram                                     |
| TARIFF_CHANGED                                                | Mijoz (rozilik bilan)       | In-app, email                                        |
| SUBSCRIPTION_EXPIRING / PAYMENT_RESULT                        | Do‘kon OWNER                | In-app, email, SMS                                   |
| SUPPORT_REPLY / SUPPORT_RESOLVED                              | Murojaat egasi              | In-app, email, Telegram                              |
| CERTIFICATION_RESULT / CERTIFICATION_EXPIRING                 | Do‘kon OWNER                | In-app, email                                        |
| INSTALLATION_ISSUE_REPORTED (chek-listda muammo)              | Do‘kon                      | In-app, Telegram                                     |
| SECURITY_ALERT (yangi qurilma, parol almashdi, sessiya reuse) | Foydalanuvchi               | In-app, SMS/email (o‘chirib bo‘lmaydi)               |
| SHOP_INVITATION                                               | Taklif qilingan ega/a’zo    | SMS, email, Telegram                                 |
| SHOP_SUSPENDED / SHOP_RESUMED / SHOP_OWNERSHIP_TRANSFERRED    | Do‘kon OWNER (va yangi ega) | In-app, email, SMS                                   |
| OPS_ALERT (critical/warning)                                  | Super Admin                 | In-app, Telegram, email; critical — tungi vaqtda ham |

- Shablonlar 3 tilda admin tomonidan boshqariladi; SMS 160 belgidan (lotin) oshmaydi.

- SMS tungi vaqtda (22:00–08:00) faqat SECURITY_ALERT va OTP uchun yuboriladi; boshqalari ertalabga qoldiriladi.

## 14.3. PDF va umumiy qoidalar

- PDF serverda HTML shablon + headless Chromium (Playwright) bilan worker’da yaratiladi; shriftlar (Inter) konteynerga o‘rnatilgan.

- Queue jobga maxfiy credential yoki to‘liq shaxsiy profil qo‘shilmaydi; faqat ID’lar.

- PDF faqat foydalanuvchi ruxsati bilan olinadi; URL signed va qisqa muddatli.

- Report xatosida foydalanuvchiga "Qayta urinish"; sabab server logida requestId bilan.

- Notification kanal providerlari adapter bilan izolyatsiya qilinadi.

# 15. Obuna va monetizatsiya

- Shop subscription plan: nom, narx, billing period, limitlar (limitsJson: maxBranches, maxProducts, maxMembers, maxRequestsPerMonth, analyticsEnabled, widgetEnabled, importEnabled), active.

- Plan limitlari serverda tekshiriladi; oshganda 402 PLAN_LIMIT_EXCEEDED va UIda yangilash taklifi.

- Bepul (FREE) reja mavjud; yangi do‘konga 30 kunlik TRIAL.

- To‘lov provayderlari: Click, Payme, Uzum. Har biri alohida adapter: rasmiy API, webhook/callback imzo tekshiruvi, idempotency (provider + providerTransactionId unique), to‘lovni bekor qilish va qaytarish qoidalari, kunlik reconciliation.

- Provider ulanmaguncha productionda to‘lov funksiyasi o‘chirilgan (feature flag); soxta muvaffaqiyatli to‘lov yaratadigan mock faqat development/staging‘da.

- Sponsored placement bo‘lsa "Reklama" deb aniq belgilanadi va organik reyting/saralashdan ajratiladi.

- Lead fee yoki komissiya V1.0 da ishlatilmaydi (yakuniy qaror); kelajakda kiritilsa alohida TZ talab qilinadi.

# 16. Security va privacy

- Parol hashing Argon2id (memory 64 MB, iterations 3, parallelism 1); parol, OTP va tokenlar logga tushmaydi.

- Sessiya va token qoidalari 6.4-bo‘limda.

- CORS allowlist (faqat web va widget domenlari), Helmet/security headers, CSP (frame-ancestors vidjet uchun alohida), request body limiti 1 MB (fayllar presigned URL orqali).

- class-validator (whitelist + forbidNonWhitelisted); SQL injectionga qarshi faqat parametrli so‘rovlar.

- IDOR testlari: boshqa mijozning site/calculation/quote/xabar/installation, boshqa do‘konning product/quote/lead’i, admin resurslari.

- Fayl yuklash: 10.2 bo‘yicha allowlist, hajm, server key, private bucket, antivirus, EXIF tozalash.

- Admin va Super Admin uchun 2FA (parol + OTP); admin harakatlari audit qilinadi; AuditLog‘da telefon/email maskalanadi.

- **Ma’lumotlarni lokalizatsiya qilish:** O‘zbekiston fuqarolarining shaxsiy ma’lumotlari "Shaxsga doir ma’lumotlar to‘g‘risida"gi qonun talabiga muvofiq O‘zbekiston hududidagi serverlarda saqlanadi va qayta ishlanadi. Production DB, object storage va backup O‘zbekistondagi data-markazda joylashadi. Talabning amaldagi tahriri yurist tomonidan tasdiqlanadi va hosting tanlovidan oldin hujjatlashtiriladi.

- Personal data minimal yig‘iladi; maxfiylik siyosati va foydalanish shartlari ro‘yxatdan o‘tishda qabul qilinadi (vaqt va versiya saqlanadi).

- Hisobni o‘chirish: 14 kunlik bekor qilish oralig‘i, keyin anonimlashtirish — ism "O‘chirilgan foydalanuvchi", kontaktlar, poligonlar, manzillar va yozishma matnlari o‘chiriladi; quote/installation/sharh yozuvlari statistik maqsadda anonim qoladi.

- Ma’lumot saqlash muddatlari: AuditLog 3 yil; AnalyticsEvent 24 oy; soatlik hisob qatorlari 1 yil; PDF 30 kun; draft 7 kun; OTP 24 soat.

- Production secrets secret manager’da; repository, frontend bundle va client logga kirmaydi.

- Dependency audit (CI’da har kuni), patching siyosati (critical — 72 soat ichida) va har chorakda backup restore testi.

- Kontakt ochish siyosati (13.2) va ulashilgan hisobda manzil/poligon yashirilishi xavfsizlik testlari bilan tekshiriladi.

# 17. Test strategiyasi va test case’lar

| **Test qatlami** | **Majburiy ssenariylar**                                                                                                                                                                                                                                                                                                                                                                                     |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Unit             | calc-engine: geometriya, qiyalik tuzatishi, qator oralig‘i, tavsiya algoritmi, invertor/akkumulyator tanlash, energiya balansi invariantlari, akkumulyator SOC, tarif (pog‘ona, mavsum, kun/tun, qat’iy to‘lov), billdan teskari hisob, eksport turlari, payback, NPV/IRR/LCOE, kredit (annuitet, differensial, 0 %), zaxira, moslik qoidalari, decimal yaxlitlash; status state machine’lari; Zod sxemalari |
| Integration      | Prisma + test DB (PostGIS); auth va OTP; ownership va shop permission; quote/revision yaratish; tarif versiya snapshot; outbox → queue; idempotency; optimistic lock; import                                                                                                                                                                                                                                 |
| E2E (Playwright) | Ro‘yxatdan o‘tish (OTP) → obyekt → poligon → Batafsil hisob → kredit bloki → saqlash → PDF → taklif so‘rovi → do‘kon yozishmasi → o‘lchov → taklif → revision → solishtirish → qabul → montaj → tasdiqlash → sharh → o‘rnatilgan tizim. Alohida: Guest Tez hisob → login → draft saqlanishi. Vidjet orqali so‘rov                                                                                            |
| Security         | IDOR, cross-shop, privilege escalation (ADMIN ↔ ShopMember chegarasi har ikki yo‘nalishda), CSRF, rate limit, malformed polygon, fayl cheklovlari, kontakt oshkor bo‘lmasligi, refresh reuse, Telegram callback (soxta/eskirgan/boshqa chat tokeni), arxivlangan geo yozuvlar raw SQL’da qaytmasligi, do‘kon a’zosining o‘z do‘koniga sharh yoza olmasligi                                                   |
| UI/Accessibility | axe-core avtomatik tekshiruv (0 critical/serious), klaviatura, focus, mobil/desktop vizual regression, empty/loading/error holatlari, grafik jadval alternativasi, 3 tilda matn sig‘ishi                                                                                                                                                                                                                     |
| Resilience       | Solar provider timeout/limit, stale kesh, Redis to‘xtashi, SMS/Telegram/email xatosi, to‘lov webhook takrorlanishi, job dublikati                                                                                                                                                                                                                                                                            |
| Performance      | k6: 11.15 va 20-bo‘lim maqsadlari; 200 parallel estimate                                                                                                                                                                                                                                                                                                                                                     |
| Migration        | Bo‘sh DBga migration, seed, staging upgrade, backup/restore                                                                                                                                                                                                                                                                                                                                                  |

## 17.1. Hisoblash testlari

- Generation = 0 bo‘lsa tejash va eksport daromadi = 0.

- Tarif topilmasa tizim stavka o‘ylab topmaydi; TARIFF_NOT_FOUND holati.

- Eksport qoidasi tasdiqlanmagan bo‘lsa eksport kWh ko‘rsatiladi, puli daromad sifatida chiqmaydi.

- Har bir soat uchun energiya balansi invariantlari bajariladi; SOC chegaradan chiqmaydi.

- Pog‘ona chegarasidagi kWh to‘g‘ri pog‘onaga tushadi (\[min, max)).

- NET_METERING‘da oyma-oy o‘tkazish va davr oxirida nollanish to‘g‘ri.

- Annual net benefit ≤ 0 bo‘lsa qoplanish muddati musbat son sifatida chiqmaydi.

- Kredit: annuitet formulasi bank kalkulyatori namunasiga 1 so‘m aniqlikda mos; 0 % stavka; differensial to‘lovlar yig‘indisi = kredit + foizlar.

- Tarif keyin o‘zgarsa eski hisob tarixiy snapshot bilan o‘qiladi.

- Oy chegarasi: 31-yanvar 23:00 va 1-fevral 02:00 (Asia/Tashkent) soatlaridagi iste’mol mos ravishda yanvar va fevral pog‘onalariga tushadi; DB agregatsiyasida ham xuddi shunday (UTC 18:00–23:59 oralig‘i to‘g‘ri oyga).

- /outage kalkulyatori HYBRID bilan ochiladi; ON_GRID natijasida zaxira 0 soat raqam sifatida ko‘rsatilmaydi.

- Insight qoidalari: shart bajarilmasa insight chiqmaydi; bir xil input — bir xil insightlar.

## 17.2. Moderatsiya, chek-list va yordam testlari

- Har bir risk belgisi uchun ijobiy va salbiy holat; chegaraviy qiymatlar (riskScore 39 va 40).

- Chek-listda majburiy band to‘ldirilmasa confirm 409 qaytaradi; "Muammo bor" izohsiz qabul qilinmaydi.

- Muddati o‘tgan sertifikat profilda ko‘rinmaydi va filtrga tushmaydi.

- Support SLA: ish vaqti hisobi (dam olish kunlari, 18:00 dan keyingi murojaat) to‘g‘ri; boshqa foydalanuvchining murojaatini ko‘rish 404.

- Bir xil input + model version + dataset = bir xil natija (bit-bit).

- **Golden testlar:** 5 ta nuqta (Toshkent, Samarqand, Nukus, Farg‘ona, Termiz), 3 ta konfiguratsiya (janub 30°, sharq 15°, tekis 0°). A usuli yillik natijasi PVGIS PVcalc (bir xil yo‘qotishlar bilan) dan ±2 %, B usuli ±8 % dan ko‘p farq qilmaydi. Natijalar repozitoriyda fixture sifatida saqlanadi.

# 18. Environment va developer setup

.env.example barcha o‘zgaruvchi nomlari va izohlarni saqlaydi; haqiqiy credential bo‘lmaydi.

> NODE_ENV=development
>
> WEB_URL=http://localhost:3000
>
> API_URL=http://localhost:4000
>
> COOKIE_DOMAIN=localhost
>
> DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/solar_platform
>
> REDIS_URL=redis://localhost:6379
>
> AUTH_JWT_PRIVATE_KEY=
>
> AUTH_JWT_PUBLIC_KEY=
>
> AUTH_ACCESS_TTL_SECONDS=900
>
> AUTH_REFRESH_TTL_DAYS=30
>
> CSRF_SECRET=replace_me
>
> OTP_DEV_ECHO=false
>
> OTP_DEV_ECHO_AUTH=false
>
> ADMIN_PHONE=replace_me
>
> ADMIN_PASSWORD=replace_me
>
> OBJECT_STORAGE_ENDPOINT=
>
> OBJECT_STORAGE_BUCKET=
>
> OBJECT_STORAGE_ACCESS_KEY=
>
> OBJECT_STORAGE_SECRET_KEY=
>
> CLAMAV_HOST=
>
> MAP_TILE_PROVIDER=ESRI
>
> MAP_TILE_API_KEY=
>
> MAP_BASEMAP_STYLE=arcgis/streets
>
> GEOCODING_PROVIDER=ESRI
>
> GEOCODING_API_KEY=
>
> SOLAR_PRIMARY_PROVIDER=PVGIS
>
> SOLAR_FALLBACK_PROVIDER=NASA_POWER
>
> PVGIS_BASE_URL=
>
> NASA_POWER_BASE_URL=
>
> EXCHANGE_RATE_SOURCE_URL=
>
> EMAIL_PROVIDER=
>
> EMAIL_API_KEY=
>
> SMS_PROVIDER=
>
> SMS_API_KEY=
>
> TELEGRAM_BOT_TOKEN=
>
> TELEGRAM_WEBHOOK_SECRET=
>
> PAYMENT_CLICK_SERVICE_ID=
>
> PAYMENT_CLICK_SECRET_KEY=
>
> PAYMENT_PAYME_MERCHANT_ID=
>
> PAYMENT_PAYME_SECRET_KEY=
>
> PAYMENT_UZUM_SERVICE_ID=
>
> PAYMENT_UZUM_SECRET_KEY=
>
> CAPTCHA_SECRET=
>
> SENTRY_DSN=
>
> OTEL_EXPORTER_OTLP_ENDPOINT=
>
> MAP_SATELLITE_STYLE=arcgis/imagery
>
> MAP_FALLBACK_STYLE_URL=
>
> MAP_QUOTA_WARN_PERCENT=80
>
> PROMETHEUS_URL=
>
> ALERTMANAGER_WEBHOOK_SECRET=
>
> DEPLOY_WEBHOOK_SECRET=
>
> VIDEO_MAX_UPLOAD_MB=500

- README: Node/pnpm versiyasi, install, env setup, Docker Compose servislari (Postgres+PostGIS, Redis, MinIO, ClamAV, Mailpit), migrate, seed, web/api/worker ishga tushirish, lint, test, build.

- Development, staging va production envlar ajratilgan.

- Swagger development/staging‘da ochiq; productionda faqat admin autentifikatsiyasi bilan.

- Health endpointlari: GET /health/live (jarayon tirik) va GET /health/ready (DB va Redis; tashqi providerlar degraded sifatida, readiness’ni yiqitmaydi). Secret oshkor qilinmaydi.

# 19. Deploy, monitoring va backup

- Docker image’lar: web, api, worker (bitta Dockerfile, alohida build target). Image’lar non-root, minimal base.

- Hosting: O‘zbekistondagi data-markaz (16-bo‘lim). Static assetlar uchun CDN faqat shaxsiy ma’lumotsiz fayllar bilan.

- CI pipeline: lint → typecheck → unit → integration → build → E2E (staging) → security/dependency scan → image scan. Main branch himoyalangan.

- Production DB migration deploy jarayonida alohida qadam sifatida; orqaga qaytariladigan (expand/contract) migration siyosati.

- PostgreSQL: kunlik to‘liq backup + WAL arxivi (PITR); RPO ≤ 15 daqiqa, RTO ≤ 4 soat; har chorakda restore drill.

- Object storage: versioning, kunlik backup, report fayllari 30 kun.

- Structured JSON loglar: timestamp, level, requestId, userId (hash), route, status, duration; token/parol/OTP/poligon/aniq manzil loglanmaydi.

- Monitoring: Sentry (frontend + backend xatolari), OpenTelemetry → Prometheus + Grafana (API latency/error rate, queue depth/failed, DB ulanishlari, solar provider kvotasi, SMS balansi, report xatolari, to‘lov webhook xatolari).

- Alertlar: provider qayta-qayta xatosi, queue backlog \> 1 000 yoki 10 daqiqadan eski job, backup xatosi, auth abuse, 5xx \> 1 % (5 daqiqa), valyuta kursi 2 kun yangilanmagan, SMS balansi past.

## 19.1. Super Admin DevOps paneli

Maqsad: Super Admin Grafana’ga kirmasdan platformaning holatini bir sahifada ko‘radi va eng ko‘p kerak bo‘ladigan xavfsiz amallarni bajaradi. Panel kuzatuv tizimining o‘rnini bosmaydi: chuqur tahlil uchun har grafikdan Grafana, Sentry va loglarga havola bor. Dizayn va grafiklar — UI/UX spetsifikatsiyasining 12.11-bo‘limi.

### 19.1.1. Bloklar va ma’lumot manbalari

| **Blok**            | **Ko‘rsatkichlar**                                                                                                                                                     | **Manba**                                    | **Yangilanish** |
|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------|-----------------|
| Umumiy holat        | Har xizmat (web, api, worker, PostgreSQL, Redis, object storage, ClamAV) — sog‘lom / pasaygan / ishlamayapti; 30 kunlik mavjudlik (SLO 99,5 %) va qolgan xato byudjeti | /health/ready, Prometheus up, blackbox probe | 30 s            |
| API (RED)           | So‘rovlar soni (RPS), 5xx foizi, p50/p95/p99 latency; marshrut guruhlari bo‘yicha (auth, calculator, catalog, quotes, admin)                                           | Prometheus (OpenTelemetry metrikalari)       | 30 s            |
| Kalkulyator         | estimate p95 (kesh bilan / provider bilan), solar kesh hit-rate, provider xatolari                                                                                     | Prometheus                                   | 1 daq           |
| Navbatlar           | Har queue: kutayotgan, bajarilayotgan, muvaffaqiyatsiz, eng eski job yoshi; outbox’da qayta ishlanmagan eventlar                                                       | BullMQ API, OutboxEvent                      | 15 s            |
| Ma’lumotlar bazasi  | Ulanishlar (ishlatilgan / limit), tranzaksiyalar/s, eng sekin 10 so‘rov (pg_stat_statements, parametrsiz), replikatsiya kechikishi, jadval hajmlari                    | postgres_exporter, pg_stat_statements        | 1 daq           |
| Resurslar (USE)     | CPU, xotira, disk, tarmoq — har konteyner/VM; disk to‘lishi prognozi                                                                                                   | node_exporter, cAdvisor                      | 1 daq           |
| Deploylar           | Oxirgi 20 deploy: xizmat, versiya, git SHA, kim, davomiyligi, natija; grafiklarda vertikal belgi sifatida                                                              | CI/CD webhook → OpsDeployment                | Hodisa bo‘yicha |
| Alertlar            | Faol va so‘nggi 7 kundagi alertlar, darajasi, davomiyligi, kim qabul qildi                                                                                             | Alertmanager webhook → OpsAlertEvent         | Hodisa bo‘yicha |
| Backup              | Oxirgi to‘liq backup, WAL arxivi kechikishi, object storage backup, oxirgi tiklash testi (RPO 15 daq / RTO 4 soat bilan solishtirish)                                  | OpsBackupRun                                 | 5 daq           |
| Tashqi provayderlar | Esri plitka va geocoding limiti (%), PVGIS/NASA xatolari, SMS balansi, Telegram va email yetkazish foizi, to‘lov webhook xatolari                                      | ProviderQuotaSnapshot, Prometheus            | 15 daq          |
| Biznes pulsi        | So‘nggi 24 soat: hisoblar, taklif so‘rovlari, ro‘yxatdan o‘tishlar, to‘lovlar — oldingi hafta bilan solishtirish                                                       | AnalyticsEvent (agregat)                     | 5 daq           |

### 19.1.2. Xavfsizlik va cheklovlar

- Faqat SUPER_ADMIN (2FA bilan). Panel faqat o‘qish uchun; ruxsat etilgan amallar: navbatni pauza/davom ettirish, muvaffaqiyatsiz jobni qayta ishga tushirish, alertni qabul qilish, kvota chegarasini o‘zgartirish — har biri sabab bilan va audit qilinadi. Deploy, rollback, server qayta ishga tushirish, DB’ga to‘g‘ridan-to‘g‘ri so‘rov **paneldan qilinmaydi** (CI/CD orqali).

- Metrikalar faqat oldindan belgilangan ro‘yxatdan (metric allowlist) so‘raladi; foydalanuvchi PromQL yoki SQL yubora olmaydi.

- Panelda secret, token, to‘liq IP, telefon, email, so‘rov parametrlari ko‘rsatilmaydi; sekin so‘rovlar normallashtirilgan ko‘rinishda (qiymatlarsiz).

- Prometheus, Alertmanager va Grafana ichki tarmoqda; API ularga server tomondan murojaat qiladi, brauzer to‘g‘ridan-to‘g‘ri ulanmaydi.

- Davr tanlovi: 1 soat / 6 soat / 24 soat / 7 kun / 30 kun; 30 kundan uzun ma’lumot Grafana’da.

# 20. Nofunksional talablar

| **Ko‘rsatkich**                             | **Maqsad**                                          |
|---------------------------------------------|-----------------------------------------------------|
| API read p95                                | ≤ 300 ms                                            |
| API write p95                               | ≤ 500 ms                                            |
| Calculation estimate p95                    | ≤ 1,5 s (kesh bilan), ≤ 8 s (provider bilan)        |
| Sahifa LCP (mobil, 4G)                      | ≤ 2,5 s; CLS ≤ 0,1; INP ≤ 200 ms                    |
| JS bundle (birinchi yuklash, public sahifa) | ≤ 250 KB gzip (xarita alohida lazy chunk)           |
| Bir vaqtdagi faol foydalanuvchilar          | 2 000; estimate 50 so‘rov/s                         |
| Mavjudlik (availability)                    | 99,5 % oylik                                        |
| RPO / RTO                                   | 15 daqiqa / 4 soat                                  |
| Accessibility                               | WCAG 2.1 AA                                         |
| Brauzerlar                                  | 5.4-bo‘lim                                          |
| Tillar                                      | uz, oz, ru — barcha ekranlar 100 % tarjima qilingan |

# 21. Ishlab chiqish ketma-ketligi (bitta V1.0 ichida)

Ish tartibi 1.5-bo‘limdagi M1–M7 bosqichlari bo‘yicha. Har bir bosqich oxirida oraliq qabul o‘tkaziladi; production reliz faqat M7 dan keyin.

1.  M1 — GetMaster karkasini ko‘chirish, CI, Docker, env validatsiya, DB va PostGIS, auth (OTP, sessiyalar, 2FA), rollar va permissionlar, audit, outbox, i18n karkasi, design system va Figma asosiy ekranlar.

2.  M2 — Kategoriyalar, ProductModel, do‘kon, filial, xizmatlar, takliflar, import, verifikatsiya, valyuta kurslari, public katalog va SEO.

3.  M3 — Map provider, sun’iy yo‘ldosh qatlami, geocoding, klasterlash, xizmat hududlari, poligon muharriri, obyektlar.

4.  M4 — calc-engine (barcha 11-bo‘lim), solar adapterlar va kesh, tarif dvigateli, moliyalashtirish, zaxira, moslik, golden testlar, calculation API.

5.  M5 — Tez va Batafsil kalkulyator UI, maishiy texnika, natijalar, kredit va zaxira bloklari, PDF, ulashish, solishtirish, draft va guest oqimi.

6.  M6 — So‘rovlar, yozishma, kontakt siyosati, o‘lchov, takliflar va revisionlar, solishtirish, montaj, sharhlar, bildirishnomalar (Telegram bilan), sevimlilar.

7.  M7 — Montajdan keyingi kabinet, montaj qabul chek-listi, portfolio, sertifikatlar, vidjet, yordam markazi, bilimlar markazi (kamida 20 material), lead pipeline, analitika va funnel, obuna va to‘lovlar, admin preview va qo‘llanmalar, xavfsizlik, yuklama va accessibility testlari, staging qabul, backup/monitoring, production reliz.

# 22. Qabul qilish mezonlari — Definition of Done

1.  Har bir route desktop va mobilda Figma maketiga mos ishlaydi; loading/empty/error/success holatlari bor.

2.  Barcha ekranlar uz, oz, ru tillarida to‘liq; son, pul va sana formatlari 4.3 ga mos.

3.  Guest public katalog, xarita va kalkulyatorni ishlata oladi; login talab qilinadigan amallar cheklangan; logindan keyin draft yo‘qolmaydi.

4.  Ro‘yxatdan o‘tish va login telefon OTP va email orqali ishlaydi; admin uchun 2FA majburiy.

5.  Customer obyekt va bir nechta maydon saqlaydi; boshqa user ularni ko‘ra olmaydi.

6.  Poligon serverda tekshiriladi; maydon geodezik va qiyalik tuzatishi bilan hisoblanadi.

7.  Tez hisob natijasi 3 daqiqadan kam vaqtda olinadi (usability testi, 5 ishtirokchi); natija sahifasi asosiy javobdan boshlanadi.

8.  Kalkulyator tizim hajmini tavsiya qiladi (3 variant, cheklovchi omil bilan), kun/hafta/oy/yil prognozini beradi, data source va taxminlarni yashirmaydi.

9.  Elektr sarfi kWh, so‘m, 12 oy yoki maishiy texnika orqali kiritiladi; provenance ko‘rsatiladi.

10. Tejash, eksport daromadi (tur bo‘yicha), tarmoqdan olish/berish, qoplanish va 25 yillik ko‘rsatkichlar aniq ajratilgan.

11. Kredit/bo‘lib to‘lash bloki oylik to‘lov, ortiqcha to‘lov, "cho‘ntakdan" summa va o‘zini moliyalash muddatini ko‘rsatadi.

12. Zaxira bloki kritik yuklama uchun zaxira vaqti va invertor yetarliligini ko‘rsatadi; on-grid ogohlantirishi bor.

13. Tarif, eksport qoidasi, ulanish limiti, moliyalashtirish mahsuloti va valyuta kursi manba/effective date/status bilan boshqariladi; tarif nashridan oldin preview ishlaydi.

14. Do‘kon (admin yaratgan hisob bilan kirib) katalog (ProductModel orqali), import, narx, zaxira, filial, xizmat, xizmat hududi, portfolio va vidjetni boshqaradi.

15. Do‘kon a’zosi Telegram’dan so‘rovni ko‘rdim/bog‘landim/rad etish va o‘lchov vaqtini taklif qilish amallarini bajara oladi; bu amallar web’dagi bilan bir xil ruxsat va status qoidalariga bo‘ysunadi.

16. Mijoz 1–5 do‘konga so‘rov yuboradi, yozishadi, o‘lchov band qiladi, takliflarni (revisionlar bilan) solishtiradi va tanlaydi; kontakt siyosati bajariladi.

17. Statuslar 13.1 jadvallariga to‘liq mos; jadvaldan tashqari o‘tish rad etiladi.

18. Sharh faqat tasdiqlangan montajdan keyin; do‘kon javob bera oladi.

19. Montajdan keyingi kabinet: kafolatlar, eslatmalar, ishlab chiqarishni kiritish va prognoz bilan taqqoslash ishlaydi.

20. PDF, bildirishnomalar (in-app, email, SMS, Telegram), sevimlilar, admin moderatsiya, obuna va to‘lov (Click/Payme/Uzum), audit va funnel analitikasi ishlaydi.

21. AI yoki AI’ga majburiy bog‘liqlik yo‘q.

22. Unit/integration/E2E/security/accessibility/performance testlari o‘tadi; golden testlar ruxsat etilgan farq ichida; 20-bo‘lim maqsadlari bajarilgan.

23. Migration va README to‘liq; productionda secretlar himoyalangan, ma’lumotlar O‘zbekistonda joylashgan, backup/restore va monitoring sozlangan.

24. Yordam markazi ishlaydi: murojaat, ustuvorlik va javob muddatlari, admin navbati, baho.

25. Montaj qabul chek-listisiz tasdiqlash mumkin emas; muammo topilsa tuzatish/e’tiroz yo‘llari ishlaydi.

26. Bilimlar markazi 3 tilda, SEO talablari (structured data, sitemap, hreflang) bajarilgan, ishga tushishda kamida 20 material.

27. Sertifikat belgilari admin tasdig‘idan keyin chiqadi va muddati o‘tganda avtomatik yashiriladi.

28. Soxta sharh qoidalari ishlaydi: o‘z do‘koniga sharh bloklanadi, xavfli sharhlar moderatsiyaga tushadi.

29. Super Admin do‘kon yaratadi, egani taklif qiladi, ega qabul qilgach do‘kon unga o‘tadi; OWNER’siz do‘kon public’da ko‘rinmaydi; to‘xtatish, qayta yoqish va egalikni o‘tkazish ishlaydi va audit qilinadi.

30. DevOps paneli 19.1.1 dagi barcha bloklarni real ma’lumot bilan ko‘rsatadi; ruxsat etilmagan metrika va amal rad etiladi; panel ma’lumot oshkor qilmaydi (security testi).

31. Xarita Esri bepul tarifida ishlaydi: "Powered by Esri" va data attribution ko‘rinadi, geocoding natijalari saqlanmaydi, kvota 80 % da ogohlantiradi, limit tugaganda fallback ishlaydi.

32. Bosh sayt hero videosi va animatsiyalari bilan mobil Lighthouse Performance ≥ 90, LCP ≤ 2,5 s; reduced-motion va Save-Data da video yuklanmaydi; har avtomatik video pauza qilinadi; tushuntiruvchi videolarda 3 tilda subtitr.

# 23. Tashqi servislar bo‘yicha qarorlar

Kod yozish provider tanlanishini kutmaydi: har bir servis uchun adapter interfeysi va test uchun fake provider yoziladi.

| **Servis**              | **Qaror / tanlashda tekshiriladi**                                                                                                                                                                                               | **Fallback**                                                                                             |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| Solar resource/PV yield | Asosiy: PVGIS (bepul, O‘zbekistonni qamrovchi radiatsiya bazasi, masalan PVGIS-ERA5). Zaxira: NASA POWER. Tijoriy provider (Solcast/Solargis) V1.0 da shart emas                                                                 | Viloyat bo‘yicha admin jadvali, "provider data yo‘q" belgisi                                             |
| Map tiles               | \*\*Qaror: Esri ArcGIS Location Platform, bepul tarif\*\* (\`arcgis/streets\` + \`arcgis/imagery\`, MapLibre plagini, oyiga 2 mln plitka). Production oldidan: tomni chizish ruxsati (yozma) va O‘zbekistonda rasm sifati (12.1) | OpenStreetMap asosidagi zaxira uslub (sun’iy yo‘ldoshsiz); manzil/koordinata va maydonni qo‘lda kiritish |
| Geocoding               | \*\*Qaror: Esri geocoding\*\* (\`forStorage=false\`, oyiga 20 ming bepul). O‘zbek/rus manzillar sifati 30–50 ta haqiqiy manzilda tekshiriladi; yetarli bo‘lmasa adapter orqali almashtiriladi                                    | Pin va koordinata                                                                                        |
| SMS                     | Mahalliy SMS provayderi (masalan Eskiz yoki Play Mobile), alfa-nom ro‘yxatdan o‘tkazish                                                                                                                                          | Email, Telegram, in-app                                                                                  |
| Telegram                | Telegram Bot API, webhook (secret token bilan)                                                                                                                                                                                   | In-app                                                                                                   |
| Email                   | Tranzaksion email provayderi, SPF/DKIM/DMARC                                                                                                                                                                                     | In-app                                                                                                   |
| Valyuta kursi           | O‘zbekiston Respublikasi Markaziy banki rasmiy kurslari                                                                                                                                                                          | Oxirgi saqlangan kurs + ogohlantirish                                                                    |
| Object storage          | S3-mos, O‘zbekistonda joylashgan, private bucket, signed URL                                                                                                                                                                     | Local storage faqat developmentda                                                                        |
| Hosting                 | O‘zbekistondagi data-markaz, managed PostgreSQL (PostGIS bilan) yoki VM                                                                                                                                                          | —                                                                                                        |
| Payment                 | Click, Payme, Uzum: rasmiy API, imzo, idempotency, qaytarish                                                                                                                                                                     | Provider ulanmaguncha to‘lov o‘chiq                                                                      |
| Antivirus               | ClamAV (self-hosted)                                                                                                                                                                                                             | Fayl SCANNED_CLEAN bo‘lmaguncha ishlatilmaydi                                                            |
| Captcha                 | Vidjet va public formalar uchun (Cloudflare Turnstile yoki hCaptcha)                                                                                                                                                             | Qattiqroq rate limit                                                                                     |

# 24. Yakuniy texnik qarorlar

- Asos: **GetMaster** karkasi (namuna loyiha) — arxitektura, auth, panellar, dizayn tizimi va landing dvigateli shundan olinadi (muqova jadvali).
- Arxitektura: modular monolith (NestJS 11), BullMQ processorlari shu ilovada (production'da alohida worker konteyneri, bitta image); mikroservislar yo‘q.
- Frontend: **Vite + React 18 + React Router 6** (SPA), to‘rtta rejim: bosh sayt, mijoz, do‘kon, admin; TanStack Query; Zustand; react-hook-form + zod (faqat UI); i18n uz/oz/ru; public sahifalar prerender.
- Validatsiya: backend — class-validator DTO (yagona manba server), frontend — zod (UI qulayligi uchun).
- Database: PostgreSQL + PostGIS; Prisma; geo so‘rovlar GeoRepository’da raw SQL; faqat migratsiyalar (`db push` taqiqlangan).
- Queue: BullMQ (Redis) + transactional outbox.
- Auth: telefon + parol, OTP (ro‘yxatdan o‘tish, ishonchsiz qurilma, 2FA), access token xotirada, refresh HttpOnly cookie panel bo‘yicha alohida, reuse detection; dev'da OTP ekranda (`OTP_DEV_ECHO`).
- UI: GetMaster token tizimi (`--qs-`), panel aksenti (mijoz ko‘k, do‘kon zumrad, admin indigo), Onest + Inter + JetBrains Mono, yorug‘/qorong‘i mavzu; bosh saytda Three.js "Quyosh filmi".
- Map: MapLibre GL JS + Esri ArcGIS Location Platform (bepul tarif); provider adapter orqali almashtiriladi (12.1).
- Do‘kon hayot sikli: foydalanuvchi o‘zi ochadi (3.5) yoki Super Admin yaratib egasiga topshiradi (3.7).
- DevOps paneli: GetMaster `admin-devops` asosida, Super Admin uchun (19.1).
- Calculation: `src/modules/calculator/engine/` — sof TS, versiyalangan model, PVGIS (asosiy) / NASA POWER (zaxira), soatlik balans, tarif dvigateli, 25 yillik model, moliyalashtirish, zaxira va moslik tekshiruvi.
- Ma’lumotlar O‘zbekiston hududida saqlanadi. AI ishlatilmaydi.
- Release: bitta V1.0; ichki bosqichlar M1–M7.
- Taxminiy moliyaviy natija hech qachon kafolatlangan tejash, daromad yoki kredit sharti sifatida taqdim etilmaydi.

## Ilova A. TZ tahrirlari tarixi (v1.0 → v1.1)

| **№** | **Bo‘lim**                        | **O‘zgarish**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1     | Butun hujjat                      | Ro‘yxat raqamlash har bo‘limda 1 dan; "kabi/masalan/tanlanishi mumkin" kabi noaniq qarorlar aniq qiymatlar bilan almashtirildi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2     | 0                                 | Vaqt mintaqasi, decimal va atamalar lug‘ati qoidalari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 3     | 1.3, 1.5                          | Yangi modullar; V1.0 ichki bosqichlari M1–M7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4     | 2                                 | User.role va ShopMember rollari ajratildi; OWNER yagona manba; STAFF roli va permissions ro‘yxati; 403/404 yakuniy qarori                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5     | 3                                 | Tez hisob, Guest → login, do‘kon onboarding, montajdan keyingi workflow; quote workflow 13-bo‘lim bilan moslashtirildi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6     | 4                                 | Figma talabi, aniq design tokenlar, WCAG 2.1 AA majburiy, atamalar lug‘ati, i18n, Tez hisob, vizual tanlagichlar, avtomatik narx, natija ierarxiyasi, kredit va zaxira bloklari, xarita UX (sun’iy yo‘ldosh, klaster, mobil chizish), takliflarni solishtirish ekrani, bildirishnomalar markazi, holatlar, kiritish formatlari, PDF dizayni                                                                                                                                                                                                                                                                                                                                                     |
| 7     | 5, 6                              | Monorepo (web/api/worker/widget + packages), Zod yagona manba, BullMQ, outbox, auth arxitekturasi, optimistic locking, soft delete, audit tranzaksiyada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8     | 7                                 | Yangi modellar: Organization, VerificationCode, PasswordResetToken, TelegramLink, ShopVerificationDocument, ProductModel (yagona katalog), ShopProduct, ExchangeRate, ImportJob, TouPeriod, GridConnectionLimit, LoadProfile, ApplianceType, FinancingProduct, CalculationDraft, CalculationShare, ConversationMessage, SiteVisit, ShopLeadNote, QuoteRevision, QuoteFinancingOption, Installation, InstalledSystem, WarrantyItem, ProductionReading, MaintenanceReminder, ReviewReply, Complaint, GuideArticle, FileObject, Payment, AnalyticsEvent, OutboxEvent, QuoteTemplate, WidgetConfig, ShopProject; tarif modeli kengaytirildi; aniqlik va yaxlitlash qarori; PostGIS ustunlari yagona |
| 9     | 8                                 | PostGIS uchun Unsupported + GeoRepository qoidasi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10    | 9                                 | Xato kodlari katalogi, cursor pagination, idempotency, do‘kon konteksti (/manage/shops/:shopId), barcha yetishmagan endpointlar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 11    | 10                                | Azimut konvensiyasi, aniq limitlar, fayl jadvali, rate limit jadvali                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 12    | 11                                | Qiyalik tuzatishi, qator oralig‘i, tavsiya algoritmi, invertor/akkumulyator tanlash, tizim turlari, PVGIS/NASA POWER qarori va kesh, vaqt mintaqasi, chang/harorat, 12 oy va maishiy texnika, kengaytirilgan tarif dvigateli, eksport turlari (net metering/net billing), 25 yillik model, kredit hisobi, zaxira hisobi, moslik tekshiruvi, unumdorlik                                                                                                                                                                                                                                                                                                                                          |
| 13    | 13                                | To‘rtta entity uchun status va o‘tish jadvallari, kontakt siyosati, revisionlar, sharh qoidalari, javob tezligi, vidjet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 14    | 14–16                             | Yangi joblar va bildirishnoma turlari, Telegram, Click/Payme/Uzum, ma’lumot lokalizatsiyasi, saqlash muddatlari, hisobni o‘chirish                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15    | 17–20                             | Golden testlar, accessibility va performance testlari, yangi env o‘zgaruvchilari, liveness/readiness, monitoring vositalari, nofunksional talablar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 16    | 22–24                             | Definition of Done va tashqi servis qarorlari yangilandi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 17    | 2.3, 6.3                          | Tashqi tahlil asosida: platforma roli va do‘kon ruxsati uchun alohida guard zanjirlari, boot-time tekshiruv                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 18    | 6.6, 17                           | Soft-delete extension raw SQL’ga ta’sir qilmasligi: GeoRepository’da qo‘lda filtr va majburiy test; DB agregatsiyasi Asia/Tashkent bo‘yicha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 19    | 4.6.2                             | Mobil Batafsil hisob: accordion + sticky jonli natija paneli                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20    | 4.6.3, 7.5, 11.7                  | Tayyor xonadon shablonlari (ApplianceTemplate)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 21    | 4.7, 11.14                        | Mavsumiy insight kartalari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 22    | 4.9, 11.1                         | /outage HYBRID bilan ochiladi; ON_GRID da "Gibrid variantni hisoblash"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 23    | 4.10                              | Mobil chizish: markaziy krest + "Nuqta qo‘shish" tugmasi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 24    | 4.12                              | Mobil takliflar kartasi va "Faqat farqlarni ko‘rsatish" tumbleri                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 25    | 4.18, 9.9                         | PDF QR-kod: ulashish linki yoki kabinet (mijoz tanlovi)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 26    | 4.14, 7.2, 9.10, 14.1             | Telegram orqali do‘kon tezkor amallari (inline tugmalar, xavfsiz callback)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 27    | 4.20, 7.7, 9.10, 9.11, 14         | Yordam markazi: murojaatlar, ustuvorlik va javob muddatlari, admin navbati                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 28    | 13.1, 13.7, 7.6                   | Montajni qabul qilish chek-listi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 29    | 4.4, 4.19, 7.7, 9.6               | Bilimlar markazi (qo‘llanmalar, maqolalar, FAQ, video) va SEO talablari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 30    | 4.11, 4.14, 7.3, 9.7              | Do‘kon sertifikatlari va belgilar (rasmiy diler, sertifikatli montajchi, litsenziya)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 31    | 13.4, 7.7                         | Soxta sharhlarga qarshi deterministik qoidalar va risk ballari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 32    | 1.3, 2.1, 3.7, 7.3, 9.2, 9.11, 14 | Super Admin do‘kon yaratishi, egani taklif qilish (ShopInvitation), to‘xtatish/qayta yoqish, egalikni o‘tkazish, reja tayinlash; Shop holatlari o‘tish jadvali (2026-10-28)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 33    | 7.7, 9.11, 14, 18, 19.1           | Super Admin DevOps paneli: bloklar, ma’lumot manbalari, xavfsizlik; OpsDeployment, OpsAlertEvent, OpsBackupRun, ProviderQuotaSnapshot; webhooklar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 34    | 9.8, 12, 12.1, 18, 23, 24         | Xarita qarori: Esri bepul tarifi, attribution, geocoding saqlanmaydi, kvota nazorati va fallback; env o‘zgaruvchilari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 35    | 1.3, 5.5, 7.7, 14, 22             | Bosh sayt: admin boshqaradigan bloklar, hero va tushuntiruvchi videolar, transkodlash, unumdorlik talablari                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 36    | Butun hujjat (v3.0)               | TZ va UI/UX bitta hujjatga birlashtirildi; stek, auth, rollar, panellar va dizayn tizimi GetMaster asosiga o‘tkazildi (Ilova B)  |

# II QISM — UI/UX DIZAYN SPETSIFIKATSIYASI

# U0. II qism haqida

II qism — ekranlar, dizayn tizimi, komponentlar, holatlar va animatsiyalar. UI GetMaster panellari bilan bir xil qurilishda: bir xil qobiq (sidebar, header, mobil navigatsiya), bir xil kirish ekrani, bir xil token tizimi va harakat tili; farqi — Quyosh domeni (kalkulyator, do'konlar, takliflar, montaj) va quyosh mavzusidagi signature elementlar (U1.2).

![Rasm 1. Mijoz paneli: hisob natijasi GetMaster qobig'ida — sidebar, KPI kartalari diapazon chizig'i bilan, bir kunlik energiya grafigi va takliflar.](design/g-customer.png)

# U1. Dizayn konsepsiyasi: «Quyosh yo'li»

## U1.1. G'oya

Platformaning har bir hisobi bitta savoldan boshlanadi: *bu tomga quyosh qachon va qancha tushadi?* Shuning uchun asosiy vizual element bezak emas — foydalanuvchi joylashuvi uchun hisoblangan **quyoshning kunlik yo'li** (TZ 11.2 dagi NOAA hisobi). U bosh sahifada jonli soat, kalkulyatorda qadamlar chizig'i, natijada ishlab chiqarish grafigining shakli, yuklanishda kutish indikatori bo'ladi.

Uch tamoyil:

1. **Ma'lumotdan bezak.** Har bir dekorativ element haqiqiy qiymatni ko'rsatadi: yoy — haqiqiy chiqish/botish vaqti, panel to'ri — haqiqiy panel soni, oqim chiziqlari — haqiqiy kWh ulushi. Ma'nosiz bezak yo'q.
2. **Iliq va tiniq.** Sovuq kulrang SaaS o'rniga iliq qumrang fon, chuqur tungi siyoh va quyosh sarig'i. Raqamlar katta, aniq va diapazon bilan.
3. **Halol noaniqlik.** Prognoz bitta "chiroyli raqam" bilan emas, diapazon chizig'i bilan ko'rsatiladi: past — standart — yuqori. Bu dizaynning o'ziga xos belgisi.


## U1.2. Beshta signature element

| Element | Nima | Qayerda | Qaysi haqiqiy ma'lumot |
|---|---|---|---|
| Quyosh yoyi (SunArc) | Ufq chizig'i ustidagi yarim ellips, quyosh doirasi va o'tilgan yo'l izi | Bosh sahifa hero, natija grafigi foni, bo'sh holatlar, yuklanish | Chiqish/botish vaqti va hozirgi quyosh balandligi (NOAA, TZ 11.2) |
| Qadamlar yoyi (StepArc) | Batafsil hisobning 6 qadami yoy bo'ylab: 1-qadam — tong, 6-qadam — kech | Batafsil hisob (mobil va desktop) | Tugallangan va joriy qadam |
| Diapazon chizig'i (RangeBar) | Past–yuqori oralig'i bo'yalgan chiziq, standart qiymatda qora belgi | Har bir prognoz KPI | scenarioLow/base/high (TZ 11.14) |
| Energiya oqimi (EnergyFlow) | Panel → invertor → uy / akkumulyator / tarmoq; chiziq qalinligi kWh ga mutanosib | Natija sahifasi "Energiya" bo'limi, PDF | selfConsumed, batteryThroughput, gridExport, gridImport |
| Panel to'ri (PanelLayer) | Chizilgan poligon ichida panellar qatorma-qator joylashadi | Maydon qadami, natija, PDF | panelCountEstimate, tom maydoni, yo'nalish |

## U1.3. Kun vaqti — 3D sahna yorug'ligi

GetMaster bosh sayti har doim qorong'i, kinematografik fonda (`#060d2b`). Quyosh'da bu fon "tungi osmon"ga aylanadi, Three.js sahnadagi quyoshning o'rni va yorug'lik rangi esa foydalanuvchining mahalliy vaqtiga mos:

| Davr | Qachon | Sahna | Hero ostidagi qator (namuna) |
|---|---|---|---|
| Tong | Quyosh chiqishidan +2 soatgacha | Quyosh ufqning chap pastida, pushti-to'q sariq yorug'lik | "Toshkentda quyosh 06:41 da chiqdi" |
| Kunduz | Tongdan kechgacha | Quyosh yuqorida, oq-sariq yorug'lik, panellarda yaltirash | "Bugun 11 soat 21 daqiqa quyosh" |
| Kech | Botishdan 1,5 soat oldin | Quyosh o'ngda pastda, qizg'ish yorug'lik, uzun soyalar | "Quyosh 18:02 da botadi" |
| Tun | Botishdan keyin | Quyosh ufq ostida, yulduzlar, ufqda tong shu'lasi | "Quyosh ertaga 06:42 da chiqadi" |

- Vaqt va chiqish/botish — foydalanuvchi joylashuvi bo'yicha (IP viloyati yoki oldin tanlangan manzil); noma'lum bo'lsa — Toshkent. Joylashuv ruxsati so'ralmaydi.
- Hisob klientda (NOAA formulasi, bezak uchun) — TZ'ning "hisob serverda" qoidasini buzmaydi.
- Panellar ichida (mijoz, do'kon, admin) yorug' va qorong'i mavzu foydalanuvchi tanlovi bilan (GetMaster `ThemeToggle`), kun vaqtiga bog'liq emas.

## U1.4. Nimalar qilinmaydi

- Bosh saytda fotosurat va stok rasmlar — hamma vizual Three.js, shader, SVG yoki CSS animatsiya. Haqiqiy fotolar faqat panellar ichida: do'kon portfoliosi, montaj isboti, mahsulot rasmlari.
- Neon ranglar va hamma joyda "glassmorphism"; shisha effekti faqat 3D sahna ustidagi o'qiladigan matn uchun (GetMaster qoidasi).
- Uzun intro yoki matnni kutdiruvchi animatsiya: hero sarlavhasi birinchi kadrda o'qiladi, 3D sahna uning orqasida yuklanadi.
- "Bepul elektr!", "100 % tejaysiz" kabi kafolat ohangidagi matnlar.
- Panellar ichida 3D: Three.js faqat bosh saytda; panellarda SVG signature elementlar va CSS harakat.

# U2. Dizayn tokenlari (GetMaster tizimi bo'yicha)

Token tizimi GetMaster `styles/tokens.css` dan olinadi, prefiks `--qs-`. Panel aksenti `:root[data-panel]` bilan, qorong'i mavzu `:root[data-theme='dark']` bilan almashadi. Komponent ichida xom HEX yoki px yozilmaydi.

## U2.1. Ranglar

| Token | Yorug' | Qorong'i | Qo'llanish |
|---|---|---|---|
| `--qs-color-bg` | #EEF2F9 | #08101F | Sahifa foni |
| `--qs-color-surface` | #FFFFFF | #0F1A30 | Karta, modal, sidebar |
| `--qs-color-surface-muted` | #E7ECF6 | #16233F | Qidiruv maydoni, segment, trek |
| `--qs-color-border` | #DBE2EF | #233252 | Karta chegarasi (dekorativ) |
| `--qs-color-border-strong` | #C3CDE0 | #32456B | Input chegarasi |
| `--qs-color-text` | #0C1730 | #EEF2F7 | Asosiy matn |
| `--qs-color-text-muted` | #58647E | #93A1B8 | Ikkilamchi matn (oq fonda 5,9:1) |
| `--qs-color-ink` | #07111D | #05080C | Bosh sayt va kirish ekranining qorong'i qismi |
| `--qs-color-accent` | #F0B84B | #F2C66B | Quyosh urg'usi: yutuq, tejash, hero sarlavhaning 2-qatori (faqat grafika va katta sarlavha) |
| `--qs-color-success` / `-bg` | #087B57 / #E4F7EF | #45D7A3 / #0E2B21 | Tasdiqlangan, muvaffaqiyat |
| `--qs-color-warning` / `-bg` | #A75C0A / #FFF3DF | #F2B46B / #2C2114 | Diqqat |
| `--qs-color-danger` / `-bg` | #D94352 / #FDECEF | #FF7C88 / #2A151A | Xato, xavfli amal |

**Panel aksenti (`--qs-color-primary`):**

| Panel | `data-panel` | Primary | Hover | Soft | Qorong'ida |
|---|---|---|---|---|---|
| Bosh sayt va mijoz | `CUSTOMER` | #2563EB | #1D4FD1 | #E0EBFF | #6F9CFF |
| Do'kon | `SHOP` | #059669 | #047857 | #D9F4E8 | #34D399 |
| Admin | `ADMIN` | #1E3A8A | #172E6E | #DDE6FA | #7D9FE8 |

Qoidalar:

- Rang yagona ma'no tashuvchi emas: status — rang + ikonka + matn; grafik — rang + legenda.
- Accent (#F0B84B) ustida matn faqat `--qs-color-ink`; accent matn sifatida faqat 40 px dan katta sarlavhada (qorong'i fonda).
- Focus halqasi: 2 px `--qs-focus-ring` (panel primary) + 2 px fon bo'shlig'i.
- Kontrastlar WCAG 2.1 AA: matn ≥ 4,5:1, input chegarasi va grafik ≥ 3:1.

## U2.2. Grafik (data-viz) ranglari

| Seriya | Rang | Qo'shimcha belgi |
|---|---|---|
| Ishlab chiqarish | #FFB21A to'ldirish + #9A5B00 kontur | — |
| Iste'mol | panel primary (#2563EB) | Uzluksiz chiziq |
| Tarmoqdan olish | `--qs-color-border-strong` shtrix | 45° shtrixli naqsh |
| Tarmoqqa berish | #F0643C | — |
| Akkumulyator | #2E9E66 | Uzuq chiziq |
| Prognoz diapazoni | #FFE2A3 → #FFB21A gradient | Standart nuqtada `--qs-color-text` belgi |
| Haqiqiy ishlab chiqarish | `--qs-color-text` | Doira nuqtalar |

Admin DevOps grafiklari uchun kategorik palitra: #2E6FBF, #C77700, #8A4FBF, #23955E (rang ko'rlik va kontrast tekshiruvidan o'tgan, 12.12). Har grafik ostida "Jadval ko'rinishida" tugmasi.

## U2.3. Qorong'i mavzu va bosh sayt fonlari

- Panellarda yorug'/qorong'i mavzu (GetMaster `ThemeToggle`, `data-theme`), tanlov `preferences` da saqlanadi; standart — tizim sozlamasi.
- Bosh sayt va kirish ekranining chap qismi doim qorong'i: `#060D2B` (siyoh), radial binafsha-ko'k nur (#3A2A6A → #14215A) va quyosh nuri (#FFC94A → #FF9A2F).
- Kirish ekranining chap paneli panel rangida animatsion shader fon: mijoz — #0A2A6B, do'kon — #063D2E, admin — #0B1640.

## U2.4. Tipografiya

GetMaster uchta shrift oilasidan foydalanadi (Manrope + Inter + JetBrains Mono). Quyosh **o'zbek kirill (oz) tilini** ham qo'llaydi, Manrope va JetBrains Mono'da esa Қ, Ғ, Ҳ va ʻ (U+02BB) harflari yo'q (glif testi o'tkazildi). Shuning uchun:

| Rol | Shrift | Sabab |
|---|---|---|
| Display va sarlavhalar, katta raqamlar | **Onest** 700/800 (Manrope o'rnida) | Manrope'ga yaqin geometrik shrift, uz/oz/ru ning barcha harflari bor, tabular raqamlar |
| Matn, forma, jadval | **Inter** 400/500/600 | GetMaster bilan bir xil |
| Eyebrow, bob raqami, kod, ID | **JetBrains Mono** 500, KATTA HARF, tracking 0,18 em | GetMaster uslubi; `oz` tilida Inter 600 bilan almashadi |

| Element | Shrift | Desktop | Mobil |
|---|---|---|---|
| Hero display | Onest 800, tracking −4,5 % | 76/74 | 42/44 |
| Bob sarlavhasi (film) | Onest 800 | 46/46 | 30/32 |
| H1 (panel sahifasi) | Onest 800, −2,5 % | 30/36 | 24/30 |
| H2 | Onest 700 | 22/28 | 20/26 |
| H3 / karta sarlavhasi | Onest 700 | 16/22 | 16/22 |
| KPI | Onest 800, tnum | 30 | 26 |
| Body | Inter 400 | 16/24 (panellarda 14/21) | 15/22 |
| Small | Inter 500 | 12,5–13 | 12,5 |
| Eyebrow | JetBrains Mono 500 | 11–12, tracking 0,18 em | 11 |

- Raqamlar doim tabular. Satr uzunligi 45–75 belgi.
- Shriftlar self-host (WOFF2, `font-display: swap`), faqat kerakli subsetlar (latin, latin-ext, cyrillic, cyrillic-ext).
- GetMaster'dagi kabi build vaqtida px → rem va "UI o'lchami" sozlamasi (kichik / o'rta / katta — `data-ui-size`).

## U2.5. Spacing, radius, soya, o'lchamlar

| Token | Qiymat |
|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 (`--qs-space-1…10`) |
| Radius | sm 8 · md 14 · lg 18 · xl 26 · 2xl 32; karta 20 (katta 26, kichik 14); chip 999 |
| Soya | sm `0 1px 2px rgba(18,28,70,.05), 0 4px 14px -6px rgba(18,28,70,.08)` · md `0 14px 34px -12px rgba(18,28,70,.18)` · lg `0 28px 70px -18px rgba(18,28,70,.28)` |
| Tugma balandligi | sm 32 · md 44 · lg 50 (`data-ui-size` bilan o'zgaradi) |
| Header | 64 px (mobil 56) |
| Sidebar | 288 px |
| Karta ichki bo'shlig'i | 22 px (ixcham 12×16) |
| Easing (umumiy) | `cubic-bezier(.2,.75,.2,1)` |

Kartalar chegara (1 px) + `shadow-sm` bilan; hover'da chegara primary rangga 40 % aralashadi.

## U2.6. Breakpointlar

| Diapazon | Layout |
|---|---|
| 360–767 px | Bitta ustun; pastki navigatsiya (kabinet); sticky CTA; jadvallar kartaga aylanadi; drawer — bottom sheet (90 % balandlik) |
| 768–1023 px | Ikki ustunli kartalar; ixcham header; kalkulyator natijasi — pastki sticky panel |
| 1024–1279 px | Desktop stepper, yonma-yon xarita va ro'yxat; kabinet sidebar ixcham (ikonka + qisqa nom) |
| 1280 px va yuqori | Kontent 1200 px; to'liq sidebar; kalkulyator 7/5 ustun (forma / sticky natija) |

Mobil sahifada gorizontal skroll yo'q. Istisno — aniq belgilangan gorizontal karusellar (insight kartalari), ular indikator va klaviatura bilan boshqariladi.

## U2.7. Ikonka, illyustratsiya, foto

- **Ikonkalar** — Lucide, 20 px (inline) va 24 px (navigatsiya), chiziq qalinligi 1,75. Matnsiz ikonkaga `aria-label` majburiy.
- **Maxsus ikonkalar** (Lucide'da yo'q): panel, invertor, akkumulyator, tarmoq ustuni, uy-tom, quyosh yoyi — xuddi shu grid va chiziq qalinligida chiziladi.
- **Illyustratsiya** — geometrik, tekis ranglar, ink-900 konturi 2 px; odam yuzlari chizilmaydi. Bo'sh holatlar uchun 8 ta illyustratsiya to'plami (21-bo'lim ro'yxati bo'yicha).
- **Foto** — faqat haqiqiy loyihalar va mahsulotlar; minimal 1600 px; WebP; `alt` matni majburiy (mazmunni tasvirlaydi, "rasm" demaydi).
# U3. UI atamalar lug'ati

TZ 0-bo'limi talabi: kodda inglizcha nomlar, UI'da faqat shu lug'atdagi o'zbekcha nomlar. Lug'at `apps/web/src/i18n` dagi tarjima kalitlarining asosi; yangi atama faqat shu jadvalga qo'shilgandan keyin ishlatiladi.

| Kod / atama (TZ) | UI — o'zbek lotin | UI — rus | Izoh (tooltip) |
|---|---|---|---|
| ON_GRID | Tarmoqqa ulangan | Сетевая | Elektr tarmog'iga ulanadi; tarmoq o'chsa tizim ham o'chadi |
| HYBRID | Gibrid | Гибридная | Tarmoq + akkumulyator; uzilishda kritik texnikani ta'minlaydi |
| OFF_GRID | Avtonom | Автономная | Tarmoqsiz, faqat panel va akkumulyator |
| systemPowerKw (kWp) | Tizim quvvati, kVt | Мощность системы, кВт | Panellarning jami nominal quvvati |
| inverterKw | Invertor quvvati, kVt | Мощность инвертора, кВт | |
| batteryKwh | Akkumulyator sig'imi, kWh | Ёмкость АКБ, кВт·ч | |
| generation | Ishlab chiqarish | Выработка | |
| selfConsumed | O'zida iste'mol | Собственное потребление | Panel energiyasidan uyda darhol ishlatilgan qismi |
| gridImport | Tarmoqdan olish | Из сети | |
| gridExport | Tarmoqqa berish | В сеть | |
| curtailment | Ishlatilmay qolgan energiya | Неиспользованная энергия | Avtonom tizimda sig'may qolgan ortiqcha |
| clippingLoss | Invertor cheklovi yo'qotishi | Потери ограничения инвертора | |
| savings | Tejash | Экономия | Elektr to'lovidagi kamayish |
| exportIncome | Tarmoqqa sotishdan daromad | Доход от продажи в сеть | Faqat tasdiqlangan qoida bo'lsa |
| NET_METERING | kWh hisobini qoplash | Взаимозачёт (net metering) | |
| NET_BILLING / FEED_IN | Tarmoqqa sotish | Продажа в сеть | |
| simplePaybackYears | O'zini oqlash muddati | Срок окупаемости | |
| discountedPayback | Diskontlangan o'zini oqlash muddati | Дисконтированная окупаемость | Faqat "Qanday hisoblandi?" bo'limida |
| NPV | Sof joriy qiymat | Чистая приведённая стоимость | Faqat kengaytirilgan bo'limda |
| IRR | Ichki daromadlilik | Внутренняя доходность | Faqat kengaytirilgan bo'limda |
| LCOE | 1 kWh tannarxi | Себестоимость 1 кВт·ч | |
| scenarioLow / Base / High | Past · Standart · Yuqori | Низкий · Базовый · Высокий | TZ 11.10 dagi "konservativ/standart/optimistik" bilan bir xil ma'no; UI'da faqat shu uchta so'z |
| sizingOptions | Tejamkor · Muvozanatli · Maksimal | Экономный · Сбалансированный · Максимальный | |
| limitingFactor | Cheklovchi omil | Ограничивающий фактор | "Tom maydoni cheklaydi" |
| tilt | Qiyalik | Наклон | |
| azimuth | Yo'nalish | Ориентация | Janub, janubi-sharq va h.k. |
| shadingLevel | Soya: yo'q · oz · ko'p | Тень: нет · немного · много | |
| QuoteRequest | Taklif so'rovi | Запрос предложения | |
| Quote | Narx taklifi | Коммерческое предложение | |
| QuoteRevision | Taklif tahriri | Редакция предложения | |
| SiteVisit | O'lchov uchrashuvi | Выезд на замер | Kontekstda "zamer" ham ishlatiladi |
| Installation | Montaj | Монтаж | |
| InstalledSystem | O'rnatilgan tizim | Установленная система | |
| CustomerSite | Obyekt | Объект | Uy, ofis, ombor |
| SiteArea | O'rnatish maydoni | Площадка | |
| ProductModel | Model | Модель | |
| ShopProduct / ProductOffer | Do'kon taklifi (narx) | Предложение магазина | |
| ServiceArea | Xizmat hududi | Зона обслуживания | |
| verificationStatus VERIFIED | Tasdiqlangan do'kon | Проверенный магазин | |
| OFFICIAL_DEALER | Rasmiy diler | Официальный дилер | |
| CERTIFIED_INSTALLER | Sertifikatli montajchi | Сертифицированный монтажник | |
| contactRevealed | Kontakt ochilgan | Контакт открыт | |
| financing | Moliyalashtirish | Финансирование | Kredit, bo'lib to'lash, lizing |
| outage | Elektr uzilishi | Отключение электричества | |
| criticalLoad | Muhim texnika | Критическая нагрузка | Uzilishda ishlashi shart bo'lgan texnika |

Uslub qoidalari: "kVt" (quvvat) va "kWh" (energiya) hech qachon almashtirilmaydi; "kafolat" so'zi faqat uskuna/montaj kafolati ma'nosida ishlatiladi, natija uchun emas.

# U4. Formatlar

Barcha formatlash faqat `lib/format.ts` orqali (TZ 5.4); komponentlar ichida qo'lda formatlash taqiqlanadi.

| Qiymat | uz (lotin) | oz (kirill) | ru | Qoida |
|---|---|---|---|---|
| Butun son | 1 250 000 | 1 250 000 | 1 250 000 | Minglik ajratkich — tor bo'shliq (U+202F) |
| Kasr | 6,6 | 6,6 | 6,6 | Vergul |
| Pul (so'm) | 1 250 000 so'm | 1 250 000 сўм | 1 250 000 сум | UI'da butun songa yaxlitlanadi (TZ 7.1) |
| Katta pul (KPI) | 38,4 mln so'm | 38,4 млн сўм | 38,4 млн сум | ≥ 10 mln da mln bilan, 1 kasr |
| Pul diapazoni | 410–520 ming so'm | 410–520 минг сўм | 410–520 тыс. сум | Bitta birlik, chiziqcha (–) |
| USD | 1 250 $ | 1 250 $ | 1 250 $ | Har doim yonida so'mdagi qiymat va kurs sanasi |
| Quvvat | 6,6 kVt | 6,6 кВт | 6,6 кВт | 1 kasr; panel quvvati — 550 Vt |
| Energiya | 9 840 kWh | 9 840 кВт·соат | 9 840 кВт·ч | < 100 da 1 kasr, aks holda butun |
| Foiz | 78 % | 78 % | 78 % | Son va % orasida tor bo'shliq |
| Muddat (yil) | 6,1–7,4 yil | 6,1–7,4 йил | 6,1–7,4 года | Diapazon, 1 kasr |
| Sana | 20.10.2026 | 20.10.2026 | 20.10.2026 | Asia/Tashkent |
| Sana + vaqt | 20.10.2026, 14:32 | 20.10.2026, 14:32 | 20.10.2026, 14:32 | 24 soatlik |
| Nisbiy vaqt | 5 daqiqa oldin | 5 дақиқа олдин | 5 минут назад | 24 soatdan keyin to'liq sana |
| Maydon | 52 m² | 52 м² | 52 м² | Butun son |
| Burchak | 30° · janub (180°) | 30° · жануб | 30° · юг | Yo'nalish so'z bilan, raqam qavsda |
| Telefon | +998 90 123 45 67 | +998 90 123 45 67 | +998 90 123 45 67 | Kiritishda niqob |

Kiritishda: pul maydonida ajratkich yozish paytida qo'yiladi, kursor sakramaydi; nusxa ko'chirilgan "1.250.000" yoki "1 250 000,00" to'g'ri o'qiladi; birlik maydon ichida o'ng tomonda (suffix) ko'rsatiladi va tahrirlanmaydi.

# U5. Komponentlar

Komponentlar GetMaster `apps/web/src/components/ui` to'plamidan olinadi (Button, Input, Select, Modal, Dialog, Toast, Skeleton, Badge, Dropdown, Pagination, Switch, InfoTip…) va Quyosh signature komponentlari `components/signature/` ga qo'shiladi. Har komponentning holatlari test (`*.spec.tsx`) bilan.

## U5.1. Asosiy kutubxona

| Komponent | Variantlar | Majburiy holatlar |
|---|---|---|
| Button | primary, secondary (outline), ghost, destructive, sun (faqat asosiy konversiya CTA), icon-only; o'lcham sm 32 / md 44 / lg 50 (GetMaster tokenlari) | default, hover, focus-visible, pressed, disabled, loading (spinner + matn saqlanadi) |
| Text input | text, phone, currency, number+birlik (kWh, kVt, m²), search, textarea | default, focus, filled, error, disabled, read-only, prefilled ("Taxminiy" belgisi bilan) |
| Select / Combobox | single, multi, searchable, async | open, selected, empty, loading, no results, error |
| Segmented control | 2–4 variant | selected, focus, disabled |
| Choice card | Tom/Hovli, hajm varianti, tizim turi | default, hover, selected (chegara + check), disabled, recommended (badge) |
| Slider | Qiyalik, boshlang'ich to'lov | Har doim yonida raqamli input (klaviatura uchun) |
| Card | KPI, do'kon, mahsulot, taklif, montaj, insight | default, hover (desktop), selected, disabled, skeleton |
| Badge | status (5.3), verified, sertifikat, reja, "Reklama", "Namuna" | rang + ikonka + matn |
| Chip | filtr, cheklovchi omil, ssenariy | default, active, removable |
| Toast | success, info, warning, error | 4 s; hover/focus'da pauza; xato toasti avtomatik yopilmaydi |
| Banner | info, warning, error, offline | inline, yopiladigan/yopilmaydigan |
| Modal / Drawer / Bottom sheet | confirm, form, detail, login | open/close, focus trap, Esc, fon bosilganda yopish (formada so'raladi) |
| Tabs | sahifa, karta ichida | Klaviatura: strelkalar |
| Accordion | natija bo'limlari, mobil qadamlar | Bir nechtasi ochiq bo'lishi mumkin |
| Table | data, solishtirish | sort, empty, loading, mobilda karta ko'rinishi |
| Timeline | montaj bosqichlari, revisionlar | o'tgan, joriy, kelgusi |
| File uploader | rasm, PDF, CSV/XLSX | drag-over, uploading (%), scanning ("tekshirilmoqda"), success, error, retry |
| Empty state | no data, no results, first-use | illyustratsiya + izoh + bitta amal |
| Map marker | do'kon, tanlangan, klaster, obyekt pin | default, hover, selected, disabled |
| Avatar / Logo | foydalanuvchi, do'kon | rasm, bosh harflar, yuklanmoqda |

## U5.2. Maxsus komponentlar

**SunArc (quyosh yoyi).** Props: `sunrise`, `sunset`, `now`, `mode` (`clock` — hero; `chart` — natija foni; `loading` — kutish). Ellips nisbati 2:1 (desktop), 3:1 (mobil). Ufq chizig'i 2 px ink-900; yoy — 1,5 px line-strong, nuqtali (2/7); o'tilgan iz — 4 px sun-400; quyosh — 26 px doira, radial gradient (#FFE29A → sun-400 → dawn-500) va 64 px yumshoq halo. Chiqish/botish vaqtlari yoy uchlarida small matn bilan. Ekran o'quvchi uchun: `role="img"` va label "Toshkent: quyosh 06:41 da chiqadi, 18:02 da botadi, hozir 38° balandlikda".

**StepArc (qadamlar yoyi).** Batafsil hisobning 6 qadami yoy bo'ylab teng burchak bilan. Tugallangan — leaf-700 doira va oq check; joriy — 20 px quyosh doirasi; kelgusi — oq doira, line-strong kontur. Har nuqta bosiladi (tugallangan qadamga qaytish). Asosida oddiy `<ol>` — ekran o'quvchi "4-qadam, 6 tadan: Tizim, joriy" deb o'qiydi. 1024 px dan keng ekranda yoy ostida qadam nomlari ham yoziladi.

**RangeBar (diapazon chizig'i).** Har bir prognoz KPI ostida: 8 px balandlik, sand-100 trek; past–yuqori oralig'i sun-100 → sun-400 gradient va 1 px sun-700 kontur; standart qiymat — 4×18 px ink-900 belgi. Ostida uchta label: "Past", "Standart 465", "Yuqori". Shkala chegaralari KPI turiga qarab belgilanadi (masalan o'zini oqlash 0–15 yil). Ekran o'quvchi uchun matn: "Oylik tejash: 410 dan 520 ming so'mgacha, standart ssenariyda 465 ming".

**EnergyFlow (energiya oqimi).** Tugunlar: Panellar, Invertor, Uy, Akkumulyator (bo'lsa), Tarmoq. Chiziq qalinligi 2–14 px, kWh ulushiga chiziqli mutanosib. Ranglar 2.2 jadvali bo'yicha. Harakat — 6.4, A5. Mobil: vertikal joylashuv. Har tugun ostida kWh va foiz. Grafikdan keyin xuddi shu raqamlar jadvalda.

**PanelLayer (panel to'ri).** Poligon ustida panellar to'rtburchaklari: sky-700 to'ldirish, ichida och ko'k (#9DBBE0) 1 px kesishgan chiziq, burchak radiusi 2 px. Joylashmagan potentsial o'rinlar — oq uzuq kontur. Burchak va yo'nalish poligonning minimal o'rab turuvchi to'rtburchagidan (TZ 11.3). Ustida karta: "12 / 14 panel joylashdi · foydali maydon 52 m²". Bu — taxminiy joylashuv; ostida doim "Yakuniy joylashuvni montajchi belgilaydi" yozuvi.

**KpiCard.** Label (small, ink-500) → qiymat (Onest 700 32 px, tabular) + birlik (Inter 600) → RangeBar yoki izoh. Qiymat kelmaganda — skeleton (qiymat o'lchamida); qiymat hisoblanmasa (TARIFF_NOT_FOUND) — "Hisoblab bo'lmaydi" va sabab havolasi.

**ChartFrame.** Har bir grafik uchun o'ram: sarlavha, davr tablari, grafik, legenda, "Jadval ko'rinishida" tugmasi, manba qatori ("PVGIS · 2005–2020 TMY · model v1.4"). Grafiklar — SVG komponentlar (GetMaster admin grafiklari naqshi), tashqi og'ir kutubxonasiz.

![Rasm 2. Natija sahifasi konsepti: bir jumlalik xulosa, 4 ta KPI diapazon chiziqlari bilan, cheklovchi omil chipi, quyosh yoyi fonidagi soatlik ishlab chiqarish/iste'mol grafigi va asosiy CTA.](design/g-result.png)

## U5.3. Status badge'lari

TZ 13.1 dagi har bir status UI'da faqat shu nom va ton bilan ko'rsatiladi. Ton: neytral (sand-100 fon, ink-700 matn), ma'lumot (sky-100 / sky-700), diqqat (sun-100 / sun-700), muvaffaqiyat (leaf-100 / leaf-700), xato (#FDECEA / error-700). Har badge'da ikonka bor.

| Entity | Status | Mijozga | Do'konga | Ton |
|---|---|---|---|---|
| QuoteRequest | OPEN | Takliflar kutilmoqda | — | ma'lumot |
| QuoteRequest | CLOSED_SELECTED | Do'kon tanlandi | — | muvaffaqiyat |
| QuoteRequest | CLOSED_NO_SELECTION | Yopilgan | — | neytral |
| QuoteRequest | EXPIRED | Muddati o'tgan | — | neytral |
| QuoteRequestShop | SENT | Yuborildi | Yangi so'rov | ma'lumot |
| QuoteRequestShop | VIEWED | Do'kon ko'rdi | Ko'rilgan | neytral |
| QuoteRequestShop | CLARIFICATION_REQUESTED | Do'kon savol berdi | Javob kutilmoqda | diqqat |
| QuoteRequestShop | QUOTED | Taklif keldi | Taklif yuborilgan | ma'lumot |
| QuoteRequestShop | DECLINED | Do'kon rad etdi | Rad etilgan | neytral |
| QuoteRequestShop | SELECTED | Siz tanladingiz | Mijoz sizni tanladi | muvaffaqiyat |
| QuoteRequestShop | NOT_SELECTED | Tanlanmadi | Boshqa do'kon tanlandi | neytral |
| Quote | DRAFT | — | Qoralama | neytral |
| Quote | SENT / VIEWED | Yangi taklif / Ko'rilgan | Yuborilgan / Mijoz ko'rdi | ma'lumot |
| Quote | ACCEPTED | Tanlangan | Qabul qilindi | muvaffaqiyat |
| Quote | REJECTED | Rad etilgan | Rad etildi | neytral |
| Quote | EXPIRED | Muddati o'tgan | Muddati o'tgan | neytral |
| Quote | WITHDRAWN | Do'kon qaytarib oldi | Qaytarib olingan | neytral |
| Installation | AGREED | Kelishildi | Kelishildi | ma'lumot |
| Installation | SITE_VISIT_SCHEDULED | O'lchov belgilandi | O'lchov belgilandi | ma'lumot |
| Installation | INSTALLATION_SCHEDULED | Montaj sanasi belgilandi | Montaj rejada | ma'lumot |
| Installation | INSTALLED | Montaj bajarildi — tasdiqlang | Mijoz tasdig'i kutilmoqda | diqqat |
| Installation | CONFIRMED | Qabul qilindi | Qabul qilindi | muvaffaqiyat |
| Installation | DISPUTED | E'tiroz ko'rib chiqilmoqda | E'tiroz bildirildi | xato |
| Installation | CANCELLED | Bekor qilindi | Bekor qilindi | neytral |
| Shop.status | PENDING_REVIEW | — | Tekshiruvda | diqqat |
| Shop.status | ACTIVE / SUSPENDED | — | Faol / To'xtatilgan | muvaffaqiyat / xato |
| ShopCertification | APPROVED / EXPIRED | Belgi ko'rinadi / ko'rinmaydi | Tasdiqlangan / Muddati o'tgan | muvaffaqiyat / neytral |

"Taklifni qabul qilish" UI'da hech qachon "shartnoma" yoki "to'lov" deb atalmaydi; matn — "Siz bu do'kon bilan ishlashni tanladingiz" (TZ 13.3).

## U5.4. Forma va kiritish qoidalari

- Har inputda doimiy label; placeholder label o'rnini bosmaydi; zarur bo'lsa hint label ostida.
- Validatsiya maydonni tark etganda va yuborishda; yozish paytida faqat format (masalan raqam emasligi). Xato matni input ostida, error-700, ikonka bilan; `aria-describedby` bilan bog'langan.
- Yuborishda xato bo'lsa — fokus birinchi xatoli maydonga, sahifa yuqorisida xatolar soni bilan banner.
- Bog'liq qiymatlar ziddiyati (masalan kWh va so'm ikkalasi kiritilgan, tarif bo'yicha 20 % dan ko'p farq): ikkala maydon ostida izoh va "Qaysi biriga tayanamiz?" segmenti (default — kWh, TZ 11.7). Foydalanuvchi bloklanmaydi.
- Avtomatik to'ldirilgan qiymat (katalog medianasi, default qiyalik) "Taxminiy" belgisi bilan; foydalanuvchi o'zgartirsa — "Siz kiritgan" belgisi va "Taxminiyga qaytarish" havolasi.
- Majburiy maydon — label yonida "majburiy emas" deb ixtiyoriylar belgilanadi (formalarning ko'pi majburiy maydondan iborat).
- Server `fieldErrors` kodlari (TZ 9.1) i18n orqali tarjima qilinadi; tarjimasi yo'q kod uchun umumiy matn.

## U5.5. Panel qobig'i va navigatsiya (GetMaster bo'yicha)

Uchala panel bitta qobiqdan foydalanadi (`MainLayout`): chapda **Sidebar** (288 px), tepada **PanelHeader** (64 px), mobilda pastki **MobileNavigation**. Panel rangi `data-panel` dan olinadi.

- **Sidebar**: logo, panel belgisi (chip: "Mijoz paneli" / "Do'kon paneli" / "Admin paneli"), guruhlangan menyu (guruh nomi JetBrains Mono, katta harf). Faol element — primary-soft fon + primary matn; hisoblagich (badge) o'ngda. 1024–1279 px da 72 px ixcham rejim (faqat ikonka + tooltip).
- **PanelHeader**: qidiruv (⌘K), tema almashtirgich, til, bildirishnomalar (o'qilmaganlar soni 99+ gacha), avatar menyusi (profil, sozlamalar, chiqish). Do'kon panelida — do'kon almashtirgich.
- **MobileNavigation**: `primary: true` belgilangan 4 element + "Ko'proq" (bottom sheet). Teginish maydoni ≥ 44 px.
- **Menyu manbai** — `components/layout/nav-items.ts` (GetMaster naqshi): har element `to, label, short, icon, group, primary, permission`.

| Panel | Guruh | Elementlar (`primary` — qalin) |
|---|---|---|
| Mijoz | Asosiy | **Kalkulyator**, **Hisoblarim**, Obyektlarim, **So'rov va takliflar**, Do'konlar xaritasi, Mahsulotlar |
| | Muloqot | Chat, O'rnatilgan tizim, Murojaatlar |
| | Hisob | **Profil**, Bildirishnomalar, Sozlamalar |
| Do'kon | Ish | **Bosh panel**, **So'rovlar**, **Takliflar**, Montajlar |
| | Katalog | Mahsulotlar, Import, Filiallar va hudud, Xizmatlar, Portfolio |
| | Muloqot | **Chat**, Sharhlar |
| | Hisob | Analitika, Xodimlar, Vidjet, Sozlamalar |
| Admin | Umumiy | Boshqaruv paneli, Hisobotlar, DevOps (`DEVOPS`) |
| | Boshqaruv | Foydalanuvchilar, Adminlar (superadmin), Do'konlar, Shikoyat va e'tirozlar, Montajlar, Yordam navbati |
| | Kalkulyator | Tariflar, Eksport qoidalari, Moliyalashtirish, Kalkulyator sozlamalari, Ma'lumotnomalar |
| | Kontent | Katalog moderatsiyasi, Bilimlar markazi, Bosh sahifa bloklari, Siyosatlar, Audit, Errorlar (superadmin) |
| | Hisob | Profil, Bildirishnomalar, Sozlamalar |

Admin menyusida har element `permission` bilan: oddiy admin faqat `adminPermissions[]` dagilarini ko'radi (GetMaster `PermissionsGuard`).

- **Breadcrumb** desktop'da; mobilda faqat "orqaga".
- **Guest** mijoz panelida: sidebar o'rniga ixcham header (logo, Kalkulyator, Xarita, Do'konlar, Mahsulotlar, Bilimlar, "Kirish"); kirgach to'liq qobiqqa o'tadi.

![Rasm 3. Do'kon paneli: sidebar (guruhlangan menyu), header, KPI kartalari, yangi so'rovlar va montaj holati (GetMaster qobig'i, do'kon rangi).](design/g-shop.png)

# U6. Motion dizayn va animatsiyalar

## U6.1. Tamoyillar

1. **Harakat ma'no beradi.** Har bir animatsiya holat o'zgarishini, sabab-oqibatni yoki joyni tushuntiradi. Faqat bezak uchun harakat yo'q — bundan bitta istisno: bosh sahifadagi "quyosh chiqishi" (A1), u ham haqiqiy vaqtni ko'rsatadi.
2. **Quyosh fizikasi.** Signature harakatlar quyosh harakatiga o'xshaydi: yoy bo'ylab silliq ko'tarilish, sekinlashib to'xtash (decelerate). Sakrash, "bounce", aylanish yo'q.
3. **Kontent kutmaydi.** Matn va asosiy amal animatsiya tugashini kutmaydi; LCP elementi darhol chiziladi, animatsiya uning atrofida.
4. **Bir marta.** Kirish animatsiyalari sessiyada bir marta. Qayta tashrif, orqaga qaytish yoki filtr o'zgarishida qisqa versiya (150–200 ms) yoki umuman yo'q.
5. **Reduced motion — teng huquqli.** `prefers-reduced-motion: reduce` da har bir animatsiyaning statik muqobili yoziladi (6.6); funksionallik kamaymaydi.

## U6.2. Motion tokenlari (GetMaster `lib/motion/tokens.ts`)

| Token | Qiymat | Qachon |
|---|---|---|
| `DURATION.instant` | 90 ms | Tugma bosilishi, checkbox |
| `DURATION.fast` | 160 ms | Hover, tooltip, dropdown, header almashishi |
| `DURATION.base` | 260 ms | Modal, drawer, tab, accordion, qadam almashishi |
| `DURATION.slow` | 480 ms | Panel kengayishi, natija bloklari |
| `DURATION.scene` | 900 ms | Signature: quyosh chiqishi, sahna almashishi |
| `EASE.out` | cubic-bezier(0.16, 1, 0.3, 1) | Kirish, sahna, quyosh ko'tarilishi |
| `EASE.standard` | cubic-bezier(0.2, 0.75, 0.2, 1) | Holat o'zgarishi |
| `EASE.in` | cubic-bezier(0.5, 0, 0.75, 0) | Chiqish, yopilish |
| `SCRUB_SMOOTHING` | 0,12 | Skroll bilan boshqariladigan sahnalar (har kadrda 12 % yaqinlashish) |
| stagger-sm / md | 30 ms / 60–80 ms | Ustunlar, panellar / kartalar, matn |

Chiqish animatsiyalari kirishdan ~30 % qisqa. Quyidagi jadvallardagi eski qiymatlar shu tokenlarga yaxlitlanadi: 80 → 90, 140 → 160, 220 → 260, 360 → 480, 600 → 900 ms.

## U6.3. Mikrointeraksiyalar

| Element | Trigger | Harakat | Davomiylik / easing |
|---|---|---|---|
| Button | hover | Fon sky-700 → sky-600; strelka ikonkasi 2 px o'ngga | 140 ms, standard |
| Button | press | scale 0.98 | 80 ms, standard |
| Button | loading | Matn joyida qoladi, chapda 16 px spinner; kenglik o'zgarmaydi | — |
| Sun CTA ("Taklif so'rash") | hover | Fon ichida yorug'lik chapdan o'ngga bir marta o'tadi | 600 ms, linear |
| Card (desktop) | hover | 2 px ko'tarilish + `elev-1`; mobilda yo'q | 160 ms, standard |
| Choice card | select | Chegara sky-700 ga, check ikonka 0.6 → 1 scale + fade | 180 ms, decelerate |
| Segmented control | o'zgarish | Oq "slayder" fon yangi variant ostiga siljiydi | 220 ms, standard |
| Toggle / Checkbox | o'zgarish | Belgi chiziladi (stroke-dashoffset) | 140 ms |
| Input | focus | Chegara rangi + focus halqasi | 120 ms |
| Input | xato | Xato matni 4 px yuqoridan fade-in; tebranish (shake) yo'q | 160 ms |
| Dropdown / Popover | ochilish | opacity 0 → 1, 6 px vertikal siljish | 140 ms ochilish / 100 ms yopilish |
| Tooltip | hover 400 ms dan keyin | fade | 120 ms |
| Modal | ochilish | Fon fade; oyna scale 0.98 → 1 + fade | 220 ms / 160 ms |
| Bottom sheet (mobil) | ochilish | Pastdan siljish; tortib yopish (velocity > 0,5) | 280 ms, decelerate |
| Accordion | ochilish | Balandlik (grid-rows 0fr → 1fr) + kontent fade | 220 ms |
| Toast | kirish/chiqish | Pastdan 12 px + fade | 180 / 140 ms |
| Tab | o'zgarish | Indikator chizig'i siljiydi; kontent cross-fade | 200 ms |
| Sevimlilar (yurak) | bosish | 0.8 → 1.15 → 1 scale, to'ldirish | 240 ms |
| Raqam (KPI, narx) | yangilanish | Raqamlar vertikal "aylanadi" (har xona alohida) | 450 ms, decelerate |
| Skeleton | yuklanish | Chapdan o'ngga yorug'lik (shimmer) | 1,4 s, linear, halqa |
| Pull-to-refresh (mobil kabinet) | tortish | Quyosh doirasi ufqdan ko'tariladi, qo'yib yuborilganda aylanmaydi — yoy bo'ylab yuradi | jest bilan bog'liq |

## U6.4. Signature animatsiyalar

Har biri Figma'da prototip va alohida motion spec (Lottie emas — kod uchun parametrlar) sifatida topshiriladi.

| ID | Nomi | Qayerda | Ketma-ketlik | Reduced motion |
|---|---|---|---|---|
| A1 | Quyosh chiqishi | Bosh sahifa hero, birinchi yuklanish | 0–600 ms: quyosh ufq ostidan yoy bo'ylab hozirgi vaqt nuqtasiga ko'tariladi, ortidan sariq iz chiziladi (decelerate). 200–620 ms: sarlavha 12 px pastdan fade-up. +80 ms paragraf, +160 ms CTA. Jami ≤ 900 ms. Tungi rejimda quyosh ko'tarilmaydi — o'ng uchdagi tong shu'lasi 0 → 1 opacity (600 ms) | Hamma narsa yakuniy holatda darhol |
| A2 | Jonli quyosh | Hero, sahifa ochiq turganda | Har 60 s quyosh yangi vaqt nuqtasiga 1,2 s davomida siljiydi. Sahifa ko'rinmasa (visibilitychange) to'xtaydi | Siljish yo'q, faqat sahifa yangilanganda pozitsiya |
| A3 | Qadamlar yoyi | Batafsil hisob | "Keyingi" bosilganda quyosh belgisi yoy bo'ylab keyingi nuqtaga siljiydi (360 ms, decelerate); o'tilgan qism sariqqa bo'yaladi; eski kontent 140 ms chiqadi, yangisi 8 px o'ngdan 220 ms kiradi | Belgi darhol yangi joyda; kontent almashadi |
| A4 | Natija ochilishi | Tez hisob natijasi, Batafsil natija sahifasi | 0 ms: so'rov — yoy ichida kichik quyosh skeleton halqasi (A8). Javob kelganda: 0–600 ms soatlik ustunlar tongdan kechgacha 30 ms qadam bilan o'sadi; 250–700 ms KPI raqamlari "aylanadi" va diapazon chiziqlari markazdan kengayadi; 700–1 100 ms cheklovchi omil chipi va CTA kartasi fade-up. Ekran o'quvchiga bitta e'lon: "Natija tayyor: 6,6 kVt tizim, oylik tejash 410–520 ming so'm" | Hamma qiymat darhol; e'lon saqlanadi |
| A5 | Energiya oqimi | Natija "Energiya" bo'limi | Chiziqlar 0 → to'liq uzunlik chiziladi (500 ms, stagger 80 ms); keyin uzuq chiziq naqshi oqim yo'nalishida harakatlanadi. Tezlik kWh ga mutanosib (eng katta oqim — 1 sikl 1,6 s, eng kichigi — 4 s). Viewport'dan chiqqanda to'xtaydi; 10 s dan keyin sekinlashib to'xtaydi | Statik strelkalar va raqamlar |
| A6 | Panel to'ri | Maydon qadami, poligon yopilganda | Panellar qatorma-qator, ufqdan uzoq tomondan boshlab "teriladi": har panel 0.85 → 1 scale + fade, stagger 12 ms, jami ≤ 600 ms. Panel soni o'zgarsa faqat farq qo'shiladi/olinadi. Pastdagi hisoblagich "12 / 14 panel" raqamlari aylanadi | Panellar darhol; hisoblagich darhol |
| A7 | Taklif yuborildi | Taklif so'rovi muvaffaqiyati | Markazdagi quyosh doirasidan 8 ta nur chiqadi (stroke, 400 ms) va so'nadi; ostida yuborilgan do'konlar kartalari 60 ms stagger bilan kiradi. Bir marta | Statik check ikonka |
| A8 | Quyosh kutish indikatori | Hisob (estimate), PDF tayyorlanishi, import | Kichik yoy bo'ylab quyosh chapdan o'ngga yuradi va ufq ostidan qaytadi; sikl 1,6 s, linear. 10 s dan keyin ostida matn: "Quyosh ma'lumoti yuklanmoqda — bu birinchi marta 8 soniyagacha olishi mumkin" | Statik quyosh + matn "Hisoblanmoqda…" |
| A9 | Mobil jonli natija paneli | Batafsil hisob (mobil) | Hisob yangilanganda panel yuqori chegarasida sariq yorug'lik chapdan o'ngga bir marta o'tadi (600 ms) va raqamlar aylanadi | Faqat raqamlar yangilanadi |
| A10 | Montaj qabul qilindi | Chek-list tasdiqlangandan keyin | Timeline'dagi oxirgi nuqta leaf-700 ga to'ladi, "O'rnatilgan tizim" kartasi pastdan kiradi, ustida quyosh yoyi bir marta to'liq chiziladi (900 ms) | Statik |
| A11 | Kun progressi | Bosh sahifa, butun skroll | Sahifa yuqorisida 3 px ingichka yoy/chiziq: skroll foiziga qarab quyosh belgisi tongdan kechgacha siljiydi; bo'lim chegarasida fon tusi 600 ms davomida keyingi "soatga" o'tadi | Faqat statik chiziq, rang almashmaydi |
| A12 | Raqamlar sanalishi | Ishonch raqamlari lentasi | Birinchi ko'ringanda 0 → qiymat 800 ms (decelerate), tabular raqamlar, kenglik sakramaydi; bir marta | Qiymat darhol |
| A13 | Scroll-story sahnasi | "Qanday ishlaydi" | Sticky sahna: bob almashganda eski qatlam 220 ms fade, yangisi kiradi — 02 bobda A6 panel to'ri, 03 bobda soatlik ustunlar o'sadi (A4 qismi), 04 bobda tejash KPI aylanadi; progress bo'lagi sun-400 ga to'ladi | Har bob statik rasm bilan, sahna almashmaydi |
| A14 | Markerlar tushishi | Bosh sahifa xarita bloki | Markerlar 12 px yuqoridan tushadi va bitta "sakraydi" (360 ms, 40 ms stagger); tanlangan marker atrofida sun-400 halo 2 s sikl bilan pulsatsiya (3 marta) | Markerlar darhol, pulsatsiya yo'q |
| A15 | Header qotishi | Bosh sahifa | 80 px skrolldan keyin header shaffofdan sand-50 ga 220 ms o'tadi, balandligi 72 → 60 px | Darhol almashadi |
| A16 | Oldin/keyin ishorasi | Before/after slayder | Birinchi ko'ringanda tutqich 50 → 35 → 50 % (900 ms, bir marta), foydalanuvchi tegsa to'xtaydi | Ishora yo'q |

![Rasm 4. Animatsiya kadrlari: A1 «Quyosh chiqishi» (yuqori qator) va A4 «Natija ochilishi» (pastki qator).](design/g-story.png)

## U6.5. Sahifa va marshrut o'tishlari

- React Router marshrut almashishida (GetMaster `RootShell`): kontent 120 ms fade-out, yangisi 260 ms fade-in + 8 px yuqoriga. Sidebar va header harakatlanmaydi.
- Ro'yxatdan tafsilotga va orqaga qaytishda skroll pozitsiyasi tiklanadi.
- Panellar ichida sahifa almashishi tez: faqat kontent fade 120 ms.
- Bosh sayt ichida — Lenis silliq skroll (GetMaster `useSmoothScroll`), anchor havolalar sahnaga silliq o'tadi.

## U6.6. Reduced motion

- `prefers-reduced-motion: reduce` yoki profil sozlamasidagi "Animatsiyalarni kamaytirish" (foydalanuvchi o'zi yoqishi mumkin) — ikkalasidan biri yetarli.
- O'chiriladi: A1, A2, A5 oqimi, A6 terilishi, A7 nurlari, parallax, shimmer, raqam aylanishi, kartaning hover ko'tarilishi.
- Qoladi (80–120 ms opacity bilan): modal/drawer ochilishi, tab almashishi, focus halqasi, toast.
- Har bir signature animatsiyaning reduced holati Figma'da alohida kadr sifatida.

## U6.7. Unumdorlik va amalga oshirish

- Texnologiyalar (GetMaster bilan bir xil): **Three.js** (faqat bosh sayt, alohida lazy chunk), **GSAP + ScrollTrigger** (`lib/motion/gsap.ts`), **Lenis** (silliq skroll), qolgani CSS transition va Web Animations API. Yangi og'ir animatsiya kutubxonasi qo'shilmaydi.
- Faqat `transform` va `opacity` animatsiya qilinadi; balandlik — `grid-template-rows` texnikasi.
- SVG signature animatsiyalar (yoy, oqim) `stroke-dashoffset` bilan; 60 tadan ko'p panelli to'r — canvas.
- 3D sahna ekrandan chiqqanda va tab yashirilganda render to'xtaydi; telefonda DPR ≤ 1,25 va zarrachalar 40 % kam (`lowPower`); WebGL yo'q bo'lsa — statik SVG kadr.
- Birinchi yuklanishda (sessiyada bir marta) preloader — foiz hisoblagich, ≤ 1,2 s (GetMaster).
- Viewport'dan tashqaridagi animatsiyalar IntersectionObserver bilan to'xtaydi; bir vaqtda bitta signature animatsiya.
- Maqsad: o'rta Android'da 60 fps, INP ≤ 200 ms; bosh sayt Lighthouse (mobil) Performance ≥ 85.
- Hero sarlavhasi birinchi kadrda o'qiladi — 3D sahna LCP elementi emas.

## U6.8. Taqiqlar

- O'qishga xalaqit beradigan halqali animatsiyalar (A5 oqimi istisno — 10 s dan keyin to'xtaydi), doimiy puls, chaqnash, sekundiga 3 martadan ko'p yaltirash.
- Parallax mobilda; desktopda amplitudasi 8 px dan katta parallax.
- Foydalanuvchi harakatini bekor qiladigan avtomatik harakat (xaritaning o'zicha zoom qilishi, karuselning o'zicha aylanishi).
- 200 ms dan ortiq sun'iy kutish (masalan CTA bosilganda "chiroyli" o'tish uchun).
- Xato holatida silkitish (shake) — vestibulyar noqulaylik; o'rniga rang + matn.
## U6.9. Bosh sayt "Quyosh filmi" — 3D sahnalar

GetMaster `film/FilmStage.ts` + `film/ScrollFilm.tsx` dvigateli: skroll `progress (0..1)` → bitta Three.js sahna + DOM sarlavhalar. React har kadrda qayta chizmaydi. Pastda 01–08 bob progress chizig'i (accent rangda to'ladi).

| Oraliq | Bob | 3D sahna | Sarlavha (namuna) |
|---|---|---|---|
| 0,00–0,12 | 01 Tong | Qorong'i osmon, ufqdan quyosh ko'tariladi (haqiqiy vaqt bo'yicha), zarrachalar | "Tomingiz quyoshdan pul ishlab chiqaradi" (hero) |
| 0,12–0,25 | 02 Panel to'ri | Izometrik tom, panellar qatorma-qator "teriladi", yaltirash chizig'i | "Panellar o'z joyiga tushadi." |
| 0,25–0,38 | 03 Energiya | Quyoshdan panelga nur, panel → invertor → uy oqim chiziqlari | "Har soatda — haqiqiy kVt·soat." |
| 0,38–0,50 | 04 Tejash | Uy ustida oylik tejash raqami aylanadi, diapazon chizig'i kengayadi | "Oyiga 410–520 ming so'm." |
| 0,50–0,63 | 05 Xarita | Kamera yuqoriga ko'tariladi, shahar xaritasi, do'kon nuqtalari yonadi | "Yaqin atrofda 14 ta tasdiqlangan do'kon." |
| 0,63–0,76 | 06 Takliflar | Uchta taklif kartasi 3D'da yonma-yon chiqadi, biri tanlanadi | "Narxlarni solishtiring." |
| 0,76–0,88 | 07 Montaj | Montaj bosqichlari chizig'i, oxirida yashil halqa | "O'rnatildi va tekshirildi." |
| 0,88–1,00 | 08 Quyosh.uz | Katta so'z belgisi, quyosh to'liq aylana chizadi + CTA | "Hisoblab ko'ring — 3 daqiqa." |

Reduced motion: film o'rniga 8 ta statik kadr (SVG) ro'yxati; video yo'q.

# U7. Bosh sayt va mijoz panelining ochiq sahifalari

## U7.1. Bosh sayt (GetMaster `PortalPage` bo'yicha)

**Maqsad (v3.1):** platformani **faqat mijozga** tushuntirish va uni mijoz paneliga yo'naltirish. Bosh saytda funksional qism yo'q: kalkulyator, xarita, katalog, takliflar — mijoz panelida (guest ham ochadi). Do'kon va admin paneli manzillari bosh saytda hech qayerda ko'rsatilmaydi; do'konga oid matn, bo'lim va tugma yo'q. TZ 5.6 texnik talablari amal qiladi.

![Rasm 5. Bosh sayt hero: qorong'i kinematografik fon, Three.js sahna (quyosh, izometrik tom va panellar), JetBrains Mono eyebrow, ikki qatorli sarlavha (2-qator quyosh gradientida), chiplar, ikki CTA, bob sarlavhasi va 01–08 progress chizig'i.](design/g-hero.png)

### U7.1.1. Bo'limlar tartibi

| # | Bo'lim | Tarkib | Harakat | Ma'lumot |
|---|---|---|---|---|
| 1 | Header | Logo, anchor havolalar (Qanday ishlaydi · Mijozlar uchun · Ishonch), tema, til, "Kirish" va "Ro'yxatdan o'tish" (ikkalasi mijoz paneliga), "Hisoblab ko'rish" | Hero ustida shaffof; film tugagach qattiq fon + soya (A15) | — |
| 2 | Hero + "Quyosh filmi" | Eyebrow "QUYOSH ENERGIYASI · O'ZBEKISTON", sarlavha "Tomingiz quyoshdan / pul ishlab chiqaradi", 1 jumla, 4 chip (Kalkulyator, Do'konlar xaritasi, Narx takliflari, Montaj kafolati), CTA: "Hisoblab ko'rish →" (mijoz paneli kalkulyatori) — ikkinchi CTA yo'q; pastda bob sarlavhasi va 01–08 progress | 6.9 jadvali bo'yicha 8 bob, skrollga bog'langan; birinchi kirishda sarlavha so'zma-so'z (A1) | Quyosh vaqtlari klientda |
| 3 | Raqamlar | Tasdiqlangan do'konlar, bajarilgan hisoblar, tasdiqlangan montajlar, CO₂ prognozi | 0 dan sanaladi (A12); ma'lumot kelmasa blok yashiriladi | `GET /public/stats` |
| 4 | Xizmatlar lentasi | Cheksiz aylanuvchi lenta (GetMaster `ServiceBelt`/`Marquee`): Tarmoqqa ulangan · Gibrid · Avtonom · Akkumulyator · Suv isitgich · Ko'cha chirog'i | Doimiy sekin harakat, hover'da to'xtaydi | Statik |
| 5 | Statement | Bitta katta jumla, skroll bilan so'zma-so'z yonadi (GetMaster `Statement`): "Quyosh har kuni tomingizga tushadi. Biz faqat uni hisoblaymiz." | Skroll-scrub | — |
| 6 | Mijoz uchun | Faqat "Men mijozman" kartasi: 3 foyda va "Hisoblab ko'rish" tugmasi (do'kon kartasi yo'q) | Kartada spotlight (sichqoncha nuri) va kichik 3D obyekt (quyosh / do'kon belgisi), hover'da aylanadi | — |
| 7 | Qanday ishlaydi — mijoz | Journey: Manzil → Maydon → Sarf → Natija → Takliflar → Montaj (GetMaster `Journey`) | Har qadam skroll bilan, mini SVG sahna | — |
| 8 | Ishonch | 4 karta: tasdiqlangan do'konlar, faqat montajdan keyingi sharhlar, ma'lumot manbalari (PVGIS, tariflar), ma'lumotlar O'zbekistonda | Ikonkalar chiziq bo'lib chiziladi; tilt | — |
| 9 | FAQ | 6–8 savol, accordion, schema.org FAQPage | Accordion 260 ms | SiteBlock |
| 10 | Yakuniy CTA | Shader fon (GetMaster `ShaderBackground`, quyosh ranglari), dinamik sarlavha "Bugun quyosh 11 soat 21 daqiqa porlaydi. Uning qancha qismi sizniki?", 1 CTA ("Hisoblab ko'rish") | Shader sekin oqadi | Klient hisobi |
| 11 | Footer | Bo'limlar, yordam, shartlar va maxfiylik, kichik "Hamkorlik uchun aloqa" (faqat telefon/email, forma yo'q), "Powered by Esri" | — | — |

### U7.1.2. Media qoidasi

- Bosh saytda fotosurat va video ishlatilmaydi — hamma vizual kodda (Three.js, shader, SVG, CSS). Haqiqiy montaj videolari tayyor bo'lsa, GetMaster `RealStory` naqshida (skroll-video) 2-bob o'rniga qo'yilishi mumkin; bo'lmasa 3D film ishlaydi.
- Ishonch raqamlari faqat API'dan; to'qima iqtibos yo'q.

### U7.1.3. Matn va ohang

- Sarlavha foyda haqida: "Tomingiz quyoshdan pul ishlab chiqaradi". Aniq summa faqat diapazon bilan va 4-bobda.
- Uch tilda sarlavha 2 qatordan oshmaydi (1440 px).

### U7.1.4. Mobil

Hero: sarlavha 42 px, CTA'lar to'liq kenglikda, 3D sahna yengillashtirilgan (kamroq zarracha, panel to'ri kichik); film boblari vertikal kartalar bo'lib skrollga bog'langan; mijoz kartasi to'liq kenglikda. Hero CTA ko'rinmay qolganda pastda sticky "Hisoblab ko'rish" (fade 160 ms).

### U7.1.5. Admin boshqaruvi

Hero matni, chiplar, FAQ, bo'limlarni yoqish/o'chirish va tartibi — admin panelda (`/admin/bosh-sahifa`, SiteBlock), uch tilda, preview (desktop/mobil) va nashr bilan.

## U7.2. Kirish va ro'yxatdan o'tish (GetMaster `AuthLayout`)

**Split-screen:** chapda (662 px) panel rangidagi qorong'i animatsion shader fon — logo, panel belgisi, panelga mos sarlavha (2-qism accent rangda), 3 foyda ikonkalar bilan, pastda "Ma'lumotlaringiz O'zbekistonda saqlanadi". O'ngda — 376 px oq karta (radius 26, `shadow-lg`): panel chipi, sarlavha, maydonlar, asosiy tugma, havolalar. Tepada o'ngda til va tema. Mobilda chap qism 160 px bannerga qisqaradi.

![Rasm 6. Do'kon paneli kirishi: OTP qadami va "Test rejimi" kartasi (SMS ulanmaguncha kod ekranda).](design/g-login.png)

- **Mijoz kirishi:** telefon (+998 maska) + parol → (2FA yoki ishonchsiz qurilma bo'lsa) OTP. "Parolni unutdim" — OTP orqali tiklash.
- **Do'kon kirishi (v3.1):** faqat telefon + parol, OTP qadami yo'q. Ro'yxatdan o'tish havolasi, Google tugmasi va "Parolni unutdim" yo'q; o'rnida: "Parolni tiklash uchun administratorga murojaat qiling" va aloqa ma'lumotlari. Birinchi kirishda vaqtincha parol bo'lsa, "Yangi parol o'rnating" ekrani ochiladi (U11.1).
- **Ro'yxatdan o'tish (faqat mijoz):** ism, telefon, parol, shartlarga rozilik (oldindan belgilanmagan) → OTP → mijoz paneli. Do'kon va admin panelida ro'yxatdan o'tish yo'q. Bosh saytdagi "Kirish" va "Ro'yxatdan o'tish" mijoz paneliga olib boradi.
- **OTP ekrani:** 6 katak, avto-o'tish, `autocomplete="one-time-code"`, qayta yuborish taymeri 120 s, qolgan urinishlar soni.
- **Test rejimi (TZ 6.4):** `OTP_DEV_ECHO` yoqilgan bo'lsa, katakchalar ostida sariq karta: "Test rejimi: SMS yuborilmadi. Sizning kodingiz: 481 207" va "Kodni qo'yish" tugmasi. Production'da bu karta hech qachon chiqmaydi.
- **Holatlar:** noto'g'ri kod, eskirgan kod, urinishlar tugagan, so'rovlar limiti, login bloki (qolgan vaqt bilan), server xatosi. Javob raqam mavjudligini oshkor qilmaydi.
- **Guest amal o'rtasida** (saqlash, PDF, taklif so'rash): login modal sahifani tark ettirmaydi; kirgach amal avtomatik davom etadi, kalkulyator qoralamasi saqlanadi.
- **Sessiya tugashi:** 401 → bitta refresh urinishi → o'xshamasa modal "Sessiya tugadi", forma ma'lumoti saqlanadi.
- **Admin kirishi:** parol + 2FA OTP; chap qism admin rangida; ro'yxatdan o'tish havolasi yo'q.

## U7.3. Xarita va do'kon qidirish

- **Desktop**: chapda ro'yxat 400 px, o'ngda xarita. Ro'yxat va xarita sinxron: ro'yxatda hover — marker kattalashadi; markerga bosish — ro'yxat shu kartaga skroll qiladi.
- **Mobil**: "Xarita / Ro'yxat" segmenti; xaritada pastda 1 ta karta ko'rinadi (gorizontal surish bilan boshqalari); filtrlar bottom sheet'da.
- **Qidiruv**: manzil, do'kon nomi, hudud — bitta maydon, natijalar guruhlangan (Manzillar / Do'konlar).
- **Filtrlar**: xizmat turi (montaj, o'lchov, servis, yetkazish), mahsulot kategoriyasi, tasdiqlangan, rasmiy diler, sertifikatli montajchi, hozir ochiq, reyting (4+ va h.k.). Narx bo'yicha filtr do'konlar uchun emas — mahsulot katalogida. Faol filtrlar chip sifatida; "Hammasini tozalash". (Xarita API'siga kerakli parametrlar — Ilova B.)
- **Marker**: do'kon — 32 px doira, logo yoki bosh harf, tasdiqlangan bo'lsa leaf-700 burchak belgisi; tanlangan — 40 px + sun-400 halo (140 ms). Klaster — son bilan doira, o'lchami songa qarab 3 bosqich; bosilganda xarita silliq yaqinlashadi (400 ms).
- **Marker kartasi**: nom, belgilar (tasdiqlangan, rasmiy diler), reyting va sharhlar soni ("N ta tasdiqlangan montaj asosida"), javob tezligi ("Odatda 2 soat ichida javob beradi" — kamida 5 so'rov bo'lsa), masofa, hozir ochiq/yopiq, "Profilni ko'rish" va "Taklif so'rash".
- **Sun'iy yo'ldosh qatlami** — o'ng pastda almashtirgich (Xarita / Sun'iy yo'ldosh); poligon chizishda default sun'iy yo'ldosh.
- **Xarita yuklanmasa**: "Xarita hozir ochilmadi" banneri, ro'yxat ishlashda davom etadi; kalkulyatorda manzil/koordinata va maydonni qo'lda kiritish formasi.
- Xarita va geolokatsiya ruxsati so'ralishidan oldin nima uchun kerakligi bir jumlada.
- **Xarita provayderi — Esri (bepul tarif, TZ 12.1)**: asosiy uslub `arcgis/streets`, sun'iy yo'ldosh — `arcgis/imagery`. O'ng pastda doim "Powered by Esri" va manbalar matni (`copyrightText`) ko'rinadi; ular yashirilmaydi, ustiga karta yoki tugma tushmaydi (mobil bottom sheet ochilganda atribusiya sheet ustiga ko'chadi).
- **Manzil qidiruvi (geocoding)**: natijalar faqat ko'rsatish uchun, saqlanmaydi; saqlanadigan qiymat — foydalanuvchi tasdiqlagan pin koordinatasi. Natija tanlangach pin "Pinni aniq joyga suring" yozuvi bilan sakraydi (220 ms).
- **Limit tugaganda**: sun'iy yo'ldosh almashtirgichi o'chadi, tooltip "Sun'iy yo'ldosh qatlami vaqtincha mavjud emas"; xarita OSM asosidagi zaxira uslubga o'tadi, qidiruv o'rniga "Pinni xaritada qo'ying" ko'rsatmasi. Foydalanuvchiga xato emas, neytral info-banner.

## U7.4. Do'konlar ro'yxati va do'kon profili

**Ro'yxat**: karta — logo, nom, belgilar, reyting, javob tezligi, xizmat hududi ("Toshkent shahri va viloyati"), asosiy xizmatlar, 3 ta portfolio rasmi. Saralash: tavsiya etilgan (default), reyting, masofa, javob tezligi. Reklama joylashuvi bo'lsa — "Reklama" badge'i bilan va organik ro'yxatdan alohida (TZ 15).

**Profil**:

- Cover (21:6) va logo; nom; belgilar; reyting; javob tezligi; ish vaqti (hozir ochiq/yopiq); xizmat hududi xaritasi; filiallar.
- **Belgilar (sertifikatlar)**: "Tasdiqlangan do'kon", "Rasmiy diler: [brend]", "Sertifikatli montajchi", "Litsenziya". Belgi bosilganda popover: hujjat turi, kim bergan, raqami (bo'lsa), amal qilish muddati, "Platforma tomonidan tekshirilgan: sana". Muddati o'tgan sertifikat ko'rsatilmaydi (TZ 14.1).
- Tablar: Umumiy · Xizmatlar va narxlar · Mahsulotlar · Portfolio · Sharhlar.
- Portfolio — loyiha kartasi: shahar, quvvat, tizim turi, sana, rasmlar galereyasi (lightbox, klaviatura bilan).
- Sharhlar — reyting taqsimoti (5 qator), har sharh: ism (qisqartirilgan), sana, "Tasdiqlangan montaj" belgisi, matn, do'kon javobi alohida blokda.
- Telefon: guest uchun "+998 90 *** ** 67" va "Raqamni ko'rish uchun kiring" (ruxsat siyosatiga muvofiq).
- CTA: asosiy "Taklif so'rash"; ikkilamchi "Yozish" va "Sevimlilarga qo'shish". Mobilda pastda sticky.

## U7.5. Mahsulot katalogi, mahsulot sahifasi, solishtirish

- **Katalog**: desktop chap filtr paneli 280 px; mobil filtr bottom sheet. Grid: ≥ 1280 — 4 ustun, 1024 — 3, 768 — 2, 360 — 1 (karta gorizontal: rasm chapda). Filtrlar kategoriyaga qarab (TZ attributeSchemaJson): panel — quvvat, samaradorlik, o'lcham; invertor — AC quvvat, tur, MPPT; akkumulyator — sig'im, kimyo, kuchlanish. Narx oralig'i, mavjudlik, brend.
- **Mahsulot kartasi**: rasm, brend va model, 2–3 asosiy xususiyat, narx ("dan 1 250 000 so'm", takliflar soni) yoki "Narx so'rov orqali", mavjudlik, "Solishtirish" checkbox'i.
- **Solishtirish paneli**: 2–4 mahsulot tanlanganda pastda sticky panel (kichik rasmlar + "Solishtirish" tugmasi).
- **Mahsulot sahifasi**: galereya; xususiyatlar jadvali; datasheet PDF; "Bu modelni sotayotgan do'konlar" — narx, do'kon, filial, masofa, mavjudlik, yangilangan sana; saralash narx/masofa bo'yicha. USD narxda yonida so'mdagi qiymat va kurs sanasi. Eslatma: "Yakuniy narx do'kon taklifida tasdiqlanadi".
- **Solishtirish sahifasi**: ustunlar — mahsulotlar; qatorlar — xususiyatlar. "Faqat farqlarni ko'rsatish" toggle; farqli qiymatlar sun-100 fon bilan. Eng yaxshi qiymat (masalan eng yuqori samaradorlik) — kichik belgi. Uskunalar mosligi tekshiruvi (TZ 11.13) natijasi bo'lsa — OK / WARNING / ERROR badge va izoh, ostida "Bu dastlabki texnik tekshiruv; yakuniy loyihani montajchi tasdiqlaydi". Mobilda 2 ta mahsulot yonma-yon, qolganlari surish bilan.

## U7.6. Bilimlar markazi, maqola, FAQ

- **Bosh sahifasi**: qidiruv; kategoriyalar (6–8 karta, ikonka bilan); "Boshlovchilar uchun" yo'li — 5 ta maqola ketma-ketligi; video qo'llanmalar qatori.
- **Ro'yxat**: karta — muqova, kategoriya, sarlavha, qisqa tavsif, o'qish vaqti, tur (Qo'llanma / Maqola / Video / FAQ / Atama).
- **Maqola**: kenglik 680 px; chapda (desktop) mundarija, sticky; sarlavhalar ierarxiyasi; jadval va rasmlar; "Manbalar" bloki va "Tekshirilgan sana"; maqola oxirida CTA (ctaType bo'yicha: kalkulyator / uzilish / kredit / do'konlar); tegishli maqolalar. O'qish progressi — sahifa tepasida 2 px sun-400 chiziq.
- **Atamalar lug'ati (GLOSSARY)** — 3-bo'limdagi atamalar alifbo bo'yicha; kalkulyator tooltiplari shu sahifaga havola beradi.
- SEO: har sahifa 3 tilda, hreflang, Article/FAQPage/VideoObject structured data (TZ 5.4).

## U7.7. Yordam markazi

- **Bosh sahifa**: "Qanday yordam bera olamiz?" qidiruvi; kategoriyalar; ommabop maqolalar.
- **Murojaat yaratish**: kategoriya → mavzu yozilayotganda mos FAQ tavsiyalari (`GET /support/suggestions`, 300 ms debounce) — "Bu javob yordam berdimi?" → baribir yuborish; tavsif, bog'liq obyekt (hisob, so'rov, montaj — ro'yxatdan tanlash), fayllar (5 tagacha). Guest — telefon OTP bilan.
- Muvaffaqiyat: murojaat raqami (SUP-000123), kutilgan birinchi javob vaqti ("odatda 4 ish soati ichida").
- **Murojaatlar ro'yxati**: raqam, mavzu, status badge, oxirgi javob vaqti. **Murojaat sahifasi**: chat ko'rinishida yozishma, status, "Hal bo'ldi deb belgilash", baho (1–5) RESOLVED dan keyin, "Qayta ochish".

## U7.8. Tizim sahifalari va umumiy elementlar

- **404** — "Bu sahifa quyoshdek botib ketdi" uslubidagi yengil matn, SunArc (quyosh ufq ostida), qidiruv va bosh sahifaga havola.
- **500 / texnik xato** — kechirim, nima qilish kerakligi, `requestId` nusxalash tugmasi va "Yordamga yozish".
- **Texnik ishlar** — rejalashtirilgan bo'lsa header ostida banner (oldindan 24 soat).
- **Cookie va maxfiylik banneri** — pastda, ikki tugma bir xil ahamiyatda ("Qabul qilish" / "Faqat zarurlari"), "Sozlash" havolasi. Analitika cookie'lari rozilikdan keyin.
- **Offline** — header ostida banner "Internet aloqasi yo'q — kiritgan ma'lumotlaringiz saqlanadi"; aloqa tiklanganda 3 s "Aloqa tiklandi" va kutayotgan so'rovlar qayta yuboriladi.
- **Til almashtirish** — joriy sahifada qoladi, URL `/uz` `/oz` `/ru` prefiksi o'zgaradi, forma ma'lumoti yo'qolmaydi.

# U8. Kalkulyator — eng muhim oqim

## U8.1. Tez hisob

Maqsad: foydalanuvchi 3 daqiqadan kam vaqtda dastlabki taxminni oladi (TZ 22, 7-band). Bitta ekran, uchta blok, natija shu sahifada.

| Blok | UI | Interaksiya |
|---|---|---|
| 1. Joylashuv | Manzil qidiruvi, "Mening joylashuvim", kichik xarita pin bilan | Geolokatsiya rad etilsa — qidiruv bilan davom; O'zbekistondan tashqarida — ogohlantirish |
| 2. Elektr sarfi | Segment: "Oylik to'lov, so'm" / "Oylik sarf, kWh"; "Bilmayman" havolasi maishiy texnika oynasini ochadi | Format avtomatik; tarif topilmasa so'm varianti o'chiriladi va "Bu hudud uchun tarif ma'lumoti yo'q — kWh kiriting" |
| 3. O'rnatish joyi | Choice card: "Tom" / "Hovli yoki yer"; hajm: "Kichik ≈20 m²", "O'rtacha ≈40 m²", "Katta ≈80 m²", "Xaritada chizaman" | Tanlangan karta — chegara + check; "Xaritada chizaman" Batafsil hisobning maydon qadamiga o'tkazadi (kiritilganlar saqlanadi) |

- Hisob — uchala blok to'ldirilgach avtomatik (8.9 qoidasi bilan); qo'shimcha "Hisoblash" tugmasi yo'q.
- **Natija** (A4 animatsiyasi bilan): bir jumlalik xulosa ("Tomingizga 6,6 kVt tizim sig'adi — u yillik elektringizning taxminan 78 % ini qoplaydi"); 4 KPI — tavsiya etilgan quvvat, oylik tejash, taxminiy narx, o'zini oqlash muddati — RangeBar bilan; chiplar: "Taxminiy · Standart ssenariy", cheklovchi omil, manba.
- CTA'lar: asosiy (sun) "Do'konlardan taklif olish"; ikkilamchi "Batafsil hisob"; uchinchi darajali "Saqlash", "PDF".
- Taklif uchun ma'lumot yetarli bo'lmasa (masalan obyekt saqlanmagan) — CTA bosilganda nima yetishmasligi va bir bosishda to'ldirish yo'li.

## U8.2. Batafsil hisob — tuzilma

6 qadam: Joylashuv → Maydon → Elektr sarfi → Tizim → Xarajatlar → Moliyalashtirish (ixtiyoriy). Keyin natija sahifasi.

- **Desktop (≥ 1024)**: yuqorida StepArc; chapda (7 ustun) joriy qadam formasi; o'ngda (5 ustun) sticky natija paneli — quvvat, oylik tejash, narx, o'zini oqlash (har biri RangeBar bilan) va "Natijani to'liq ko'rish". Panel har yangilanishda A9 yorug'ligi.
- **Mobil**: tepada ixcham StepArc (Rasm 10); qadamlar vertikal accordion — tugallanganlari bir qatorli xulosaga yig'iladi ("Tom · 52 m² · janub"), bosilsa ochiladi; joriy qadam ochiq; kelgusilari xira. Pastda 78 px sticky panel: "6,6 kVt · 410–520 ming so'm/oy" va "Natija ↑" — bosilganda natija bottom sheet'da.
- Har qadam pastida "Orqaga" va "Keyingi"; 6-qadamda "O'tkazib yuborish" doim ko'rinadi.
- Progress faqat tugallangan majburiy qadamlarni hisoblaydi; ixtiyoriy qadamni o'tkazib yuborish jazolamaydi.
- Qadam URL'da (`?step=3`); brauzerning "orqaga" tugmasi oldingi qadamga qaytaradi.
- Draft avtomatik saqlanadi (har qadam o'tishida va maydon tark etilganda); refresh, til almashishi yoki login'dan keyin tiklanadi. Draft tiklanganda toast: "Oldingi hisobingiz tiklandi · Yangidan boshlash".

![Rasm 7. Mobil Batafsil hisob konsepti (360 px): qadamlar yoyi, yig'ilgan tugallangan qadamlar, joriy qadam va pastki jonli natija paneli.](design/g-mobile.png)

## U8.3. 1-qadam: Joylashuv

- Manzil qidiruvi (geocoding, 300 ms debounce, kamida 3 belgi), natijalar ro'yxati; "Mening joylashuvim"; xaritada pinni sudrash; "Koordinatani kiritish" (kengaytirilgan).
- Geocoding topmasa — pin bilan davom etish; pin qo'yilganda teskari geocoding bilan manzil (tahrirlash mumkin).
- Logged-in foydalanuvchi uchun tepada saqlangan obyektlar ro'yxati — bittasini tanlash yoki "Yangi obyekt".
- Hududda tarif topilmasa — shu qadamdayoq ogohlantirish (moliyaviy natijalar kWh asosida chiqishi haqida).

## U8.4. 2-qadam: O'rnatish maydoni

- **Xarita** (sun'iy yo'ldosh, default zoom 19). Asboblar paneli: "Maydon chizish", "Tahrirlash", "O'chirish", "Bekor qilish/Qaytarish". Bir nechta poligon: "Asosiy tom", "Garaj", "Qo'shimcha bino" — har biri ro'yxatda nomi va maydoni bilan.
- **Desktop chizish**: bosish bilan nuqta; birinchi nuqtaga bosish yoki Enter — yopish; nuqtalarni sudrash; tomon o'rtasidagi "+" — yangi nuqta. Chizilayotgan chiziq kursorga ergashadi; yangi nuqta 120 ms scale-in.
- **Mobil chizish (TZ 4.10)**: ekran markazida krest; foydalanuvchi xaritani suradi va "Nuqta qo'shish" tugmasini bosadi (barmoq nuqtani yopmaydi). Pastda "Bekor qilish" va "Yopish" (≥ 3 nuqtada faol). Pinch-zoom ishlaydi. Har nuqtada 10 ms haptik (qo'llansa).
- Poligon yopilganda: server validatsiyasi (o'z-o'zini kesish, 3–500 nuqta, max 50 000 m²); xato bo'lsa xatoli tomon error-700 bilan va izoh. To'g'ri bo'lsa — maydon (server qiymati), keyin PanelLayer va A6 animatsiyasi.
- **Parametrlar** (har poligon uchun): tom turi (tekis / qiya — rasmli choice card); qiyalik — vizual tanlagich (3 ta siluet: 15°, 30°, 45°) + aniq son "Kengaytirilgan"da; yo'nalish — kompas tanlagichi (8 yo'nalish, poligondan avtomatik taklif); soya — "Yo'q / Oz / Ko'p" (rasmli). Noma'lum bo'lsa "Bilmayman" — default va "noaniqlik" belgisi.
- Natija qatori: proyeksiya maydoni, tom yuzasi (qiyalik bilan), foydali maydon, taxminiy panel soni.
- Tez hisobdan kelgan foydalanuvchi uchun chizish ixtiyoriy: "Taxminiy hajm bilan davom etish" havolasi.

![Rasm 8. Energiya oqimi (chapda) va panel to'ri (o'ngda) konseptlari. Panel to'ri A6 animatsiyasining o'rta holatida.](design/g-flow.png)

## U8.5. 3-qadam: Elektr sarfi va maishiy texnika

- Kiritish turlari (tablar): "Oylik kWh", "Oylik to'lov", "12 oy", "Texnika ro'yxati". Ikkalasi (kWh va so'm) kiritilsa — 5.4 dagi ziddiyat qoidasi.
- **12 oy**: 12 ta kichik input 3×4 grid (mobil 2×6); "Bitta qiymatni hammasiga" tugmasi; ustida kichik ustunli grafik jonli yangilanadi.
- **Texnika ro'yxati (TZ 4.6.3)**: tepada tayyor shablonlar chip sifatida — "1–2 xonali kvartira", "3–4 xonali kvartira", "Hovli uy (konditsionersiz)", "Hovli uy (konditsioner bilan)", "Kichik ofis", "Do'kon". Shablon tanlansa ro'yxat to'ldiriladi va tahrirlanadi.
- Har texnika qatori: ikonka, nom, soni (stepper), quvvati (Vt, default bilan), kunlik soati, ishlaydigan oylar (12 ta chip), "Uzilishda ham ishlashi kerak" toggle. Desktop — jadval; mobil — ixcham karta, tafsilotlar ochiladi.
- "Texnika qo'shish" — qidiruv + kategoriyalar (Oshxona, Iqlim, Yorug'lik, Elektronika, Suv, Boshqa).
- Pastda jonli xulosa: oylik va yillik kWh, kritik yuklama (kVt), "+10 % hisobga olinmagan mayda iste'mol" izohi (TZ 11.7).
- "Uzilishda ham ishlashi kerak" belgilansa: banner "Uzilishda ishlashi uchun gibrid tizim kerak — 4-qadamda gibrid tanlanadi" (TZ 11.1).

## U8.6. 4-qadam: Tizim

- Tizim turi — 3 choice card (rasm, 1 jumla, "kimga mos"); default 11.1 bo'yicha.
- Hajm variantlari — 3 karta: Tejamkor · Muvozanatli (tavsiya badge'i) · Maksimal. Har kartada: quvvat, panel soni, invertor, akkumulyator (bo'lsa), taxminiy narx, oylik tejash (diapazon). Maksimal Muvozanatlidan ≤ 5 % farq qilsa ko'rsatilmaydi (TZ 11.4) — o'rniga izoh.
- Cheklovchi omil chipi: "Tom maydoni cheklaydi", "Ulanish limiti cheklaydi", "Byudjet cheklaydi".
- "Aniq uskunani tanlash" (kengaytirilgan): panel, invertor, akkumulyator — katalogdan qidiruv; tanlanganda moslik tekshiruvi (TZ 11.13) natijasi darhol badge bilan.

## U8.7. 5-qadam: Xarajatlar

- Qatorlar: uskuna, montaj, yetkazish, qo'shimcha, yillik servis. Avtomatik qiymatlar "Taxminiy · katalog medianasi (oxirgi 90 kun)"; o'zgartirilsa "Siz kiritgan".
- Jami summa jonli; USD qiymatlar bo'lsa kurs va sanasi.
- "Do'kon taklifi bilan almashtirish" — saqlangan taklif bo'lsa, uning qiymatlarini qo'yadi.

## U8.8. 6-qadam: Moliyalashtirish (ixtiyoriy)

- Segment: Naqd / Kredit / Bo'lib to'lash / Lizing. Kreditda — moliyalashtirish mahsuloti (provayder, stavka, muddatlar; manba va sana bilan) yoki "Qo'lda kiritish".
- Maydonlar: boshlang'ich to'lov (slider + input, minimal foiz bilan), muddat (faqat ruxsat etilgan oylar — chip), to'lov turi (annuitet / differensial).
- Jonli natija: oylik to'lov (differensialda birinchi va oxirgi), jami to'lov, ortiqcha to'lov, oylik "cho'ntakdan" summa (to'lov − tejash), tejash to'lovni qoplaydigan eng qisqa muddat.
- Doimiy ogohlantirish: "Bu taxminiy hisob. Yakuniy shartlarni bank yoki sotuvchi belgilaydi; platforma kredit bermaydi va tasdiqlamaydi."

## U8.9. Qayta hisoblash qoidasi

Hisob serverda (TZ 5.1) va guest uchun rate limit 10/daqiqa (TZ 10.3). Shu sababli:

1. So'rov faqat **qiymat yakunlanganda** yuboriladi: input tark etilganda (blur), Enter, tanlov o'zgarganda (select, choice card, segment). Yozish paytida so'rov yo'q.
2. Ketma-ket o'zgarishlar 800 ms davomida birlashtiriladi (debounce); bir vaqtda faqat bitta so'rov — yangi o'zgarish kelsa eski so'rov bekor qilinadi (AbortController).
3. Klient tomonda minimal oraliq 6 s (guest) / 2 s (logged-in); oraliq ichidagi o'zgarish navbatga qo'yiladi va oraliq tugagach bitta so'rov ketadi.
4. Batafsil hisobning qadamlari ichida (masalan 12 oy kiritish) sticky panel qadam yakunlanganda yangilanadi.
5. 429 kelsa: sticky panelda "Juda tez o'zgartiryapsiz — N soniyadan keyin yangilanadi" (Retry-After bo'yicha), ma'lumot yo'qolmaydi.
6. Yangilanish paytida avvalgi qiymat 60 % opacity bilan ko'rinib turadi va kichik A8 indikatori; natija kelgach raqamlar aylanadi.

Shunda ham tipik Tez hisob ≤ 4 so'rov, Batafsil ≤ 12 so'rov bilan tugaydi. Rate limit qiymatini qayta ko'rib chiqish taklifi — Ilova B.

## U8.10. Natijalar sahifasi

Struktura (yuqoridan pastga):

1. **Xulosa**: H1 bir jumla; chiplar (ssenariy, cheklovchi omil, manba va model versiyasi); amallar: Saqlash, PDF, Ulashish, Parametrlarni o'zgartirish.
2. **4 KPI** RangeBar bilan va **CTA kartasi** (ink-900 fon): "N ta yaqin do'kondan narx taklifi oling" + sun tugma.
3. **Quyosh kuni grafigi** (ChartFrame): SunArc fonida soatlik ishlab chiqarish ustunlari va iste'mol chizig'i; tablar — 4 mavsum oyi; ortiqcha qism dawn-500. Hover/fokus — soat tooltipi. (Rasm 4)
4. **Insight kartalari** (8.11).
5. **Batafsil bo'limlar** (accordion, birinchisi ochiq):
    - *Energiya*: kun / hafta / oy / yil ishlab chiqarish; oylik ustunli grafik (ishlab chiqarish va iste'mol); EnergyFlow (A5); o'zida iste'mol, tarmoqdan olish/berish; clipping va curtailment (bo'lsa).
    - *Pul*: elektr to'lovi quyoshsiz va quyosh bilan (oylik grafik), tejash, eksport daromadi — holati bilan (Tasdiqlangan / Tasdiqlanmagan — hisoblanmadi / Qo'llanmaydi), yillik servis, o'zini oqlash.
    - *25 yil*: jamg'arilgan pul oqimi grafigi (manfiydan musbatga o'tish nuqtasi belgilangan), inverter/akkumulyator almashtirish yillari belgisi, CO₂ tejalishi ("N ta daraxt" kabi o'xshatishlarsiz — faqat tonna). NPV, IRR, LCOE — "Kengaytirilgan ko'rsatkichlar" ichida, lug'at tooltiplari bilan.
    - *Kredit va bo'lib to'lash*: naqd va tanlangan variant yonma-yon; oylik to'lov jadvali (yig'iladigan).
    - *Elektr o'chganda*: kritik yuklama, zaxira vaqti (kunduz/tun, qish/yoz), invertor yetarliligi. ON_GRID da raqam o'rniga ogohlantirish va "Gibrid variantni hisoblash" tugmasi.
    - *Qanday hisoblandi?*: ma'lumot manbasi va usuli (A/B/DEFAULT), model versiyasi, tarif va eksport qoidasi (manba havolasi, kuchga kirgan sana), valyuta kursi, barcha taxminlar va ogohlantirishlar ro'yxati, ssenariy farqlari.
6. **Ogohlantirish qatori** (sahifa oxirida va PDF'da): "Natijalar prognoz. Haqiqiy ishlab chiqarish ob-havo, soya, uskuna va montaj sifatiga bog'liq."

`paybackUnavailableReason` bo'lsa KPI o'rnida: "O'zini oqlamaydi — yillik sof foyda musbat emas" va sabablarni ko'rish havolasi. TARIFF_NOT_FOUND bo'lsa moliyaviy KPI'lar "Hisoblab bo'lmaydi" holatida, energiya KPI'lari ishlaydi.

## U8.11. Insight kartalari

TZ 11.14 dagi qoidalar natijasi; 2–4 ta karta; desktop'da 4 ustun, mobilda gorizontal karusel (indikator nuqtalari, strelkalar, klaviatura). Har karta: ikonka, bir jumla, raqam, oy nomi.

| Turi | Namuna matn |
|---|---|
| BEST_SAVING_MONTH | "Iyulda eng ko'p tejaysiz — taxminan 610 ming so'm" |
| LOWEST_GENERATION_MONTH | "Dekabrda ishlab chiqarish iyuldagidan 3,1 marta kam" |
| PEAK_IMPORT_MONTH | "Yanvarda tarmoqdan eng ko'p olasiz — 380 kWh" |
| BATTERY_CRITICAL_MONTH | "Dekabr tunlari akkumulyator uchun eng og'ir" |
| SUMMER_SURPLUS | "Yozgi ortiqcha energiyaning 46 % i iyun–avgustga to'g'ri keladi" |

Shart bajarilmasa karta chiqmaydi; kartalar soni nol bo'lsa blok ham yo'q.

## U8.12. Kredit kalkulyatori sahifasi (/financing)

Mustaqil sahifa: tizim narxi (qo'lda yoki saqlangan hisobdan), oylik tejash (ixtiyoriy). Moliyalashtirish mahsulotlari kartalari (provayder, stavka, muddat, minimal to'lov, manba sanasi) — 2–3 tasini tanlab solishtirish. Natija kartalari 8.8 dagidek; mobilda vertikal. Ogohlantirish matni majburiy.

## U8.13. Elektr uzilishi kalkulyatori (/outage)

- Tizim turi default HYBRID (TZ 11.1).
- Muhim texnika ro'yxati (8.5 komponenti, "kritik" belgisi bilan), uzilish davomiyligi (soat), kunduz/tun segmenti, mavsum.
- Natija: kritik yuklama (kVt), ishga tushish pik quvvati, zaxira vaqti (tun / kunduz — "quyosh bor paytda cheklanmagan" holati), invertor yetarliligi (OK / yetarli emas va qancha kerak), qish va yoz bo'yicha.
- Vizual: akkumulyator darajasi vaqt o'qida kamayib boradi (zaxira soatlari), quyosh chiqishi bilan to'ladi.
- ON_GRID tanlansa: zaxira raqam sifatida ko'rsatilmaydi; "Tarmoqqa ulangan tizim elektr o'chganda xavfsizlik uchun o'chadi" va "Gibrid variantni hisoblash".

## U8.14. Saqlash, ulashish, solishtirish, PDF

- **Saqlash**: obyekt tanlash yoki yangi obyekt nomi; saqlangach toast va "Kabinetda ko'rish".
- **Ulashish**: read-only havola, muddat (7 kun / 30 kun / muddatsiz), "Havolani bekor qilish". Oynada aniq yozuv: "Havolada aniq manzil va tom chizmasi ko'rinmaydi" (TZ 9.9).
- **Ulashilgan sahifa** (/share/[token]): natija sahifasining yengil versiyasi — manzil o'rniga tuman, poligon o'rniga faqat maydon raqami; tepada "Bu ulashilgan hisob" banneri va "O'z hisobingizni qiling" CTA; ko'rishlar soni egasiga ko'rinadi.
- **Solishtirish** (2–3 hisob): ustunlar — hisoblar; qatorlar — KPI va asosiy parametrlar; farqli qiymatlar ajratiladi; mobilda 2 ta yonma-yon.
- **PDF**: tugma → oynada til, "QR-kod: ulashish havolasi / kabinetga havola / QR yo'q" (TZ 4.18, 9.9) → "Tayyorlash"; A8 indikatori; tayyor bo'lgach yuklab olish va bildirishnoma (fon tab'da bo'lsa).

## U8.15. Guest va draft

- Guest barcha hisoblarni bajara oladi; saqlash, PDF, taklif, sevimlilar — login modal (7.2).
- Draft guest uchun 7 kun saqlanadi; kalkulyator ochilganda draft bo'lsa: "Tugallanmagan hisobingiz bor (3-qadam) · Davom etish / Yangidan boshlash".
- Login'dan keyin draft hisobga biriktiriladi va bosilgan amal davom etadi; foydalanuvchi qayta kiritmaydi.

# U9. Takliflar va xaridga olib boruvchi oqim

## U9.1. Taklif so'rovi yaratish

Wizard (modal desktop'da 720 px, mobilda to'liq ekran), 4 qadam:

1. **Asos**: saqlangan hisob yoki obyektni tanlash (kartalar: sana, quvvat, tizim turi). Hisob yo'q bo'lsa — "Avval tez hisob qiling".
2. **Ehtiyojlar**: tizim turi, kerakli quvvat (hisobdan), akkumulyator kerakmi, montaj kerakmi, moliyalashtirishga qiziqish, izoh (2 000 belgi).
3. **Do'konlar**: xizmat hududingizga mos do'konlar birinchi (TZ 3.4), xarita/ro'yxat; 1–5 ta tanlash (tanlanganlar soni "3 / 5" ko'rinib turadi). Limitga yetganda qolgan kartalar "Tanlash" tugmasi o'chadi va izoh.
4. **Tekshirish**: so'rov xulosasi; "Do'konlar nimani ko'radi" bloki — kontakt ochilmaguncha faqat tuman, tizim parametrlari, hisob xulosasi va ismingiz; telefon, aniq manzil va tom chizmasi ko'rinmaydi (TZ 13.2). "Yuborish".

Muvaffaqiyat ekrani (A7): so'rov raqami, yuborilgan do'konlar, keyingi qadam ("Do'konlar odatda 24 soat ichida javob beradi; javob kelsa Telegram va SMS orqali xabar beramiz"). Cheklovlar (max 3 ochiq so'rov, kuniga 5) oldindan ko'rsatiladi; oshsa — sabab va qachon mumkinligi.

## U9.2. Kontaktni ochish

- So'rov sahifasida har do'kon qatorida "Kontaktni ochish" tugmasi va izoh "Do'kon sizga qo'ng'iroq qila oladi va aniq manzilni ko'radi".
- Tasdiq oynasi; ochilgandan keyin badge "Kontakt ochilgan · sana".
- O'lchov uchrashuvini tasdiqlash yoki taklifni qabul qilish kontaktni avtomatik ochadi — tugma oynasida oldindan aytiladi.
- **Do'kon tomonida** kontakt ochilmagan so'rov: ism (familiyasiz), tuman, parametrlar; telefon o'rnida qulf ikonka va "Mijoz kontaktni hali ochmagan — yozishma orqali bog'laning".

## U9.3. Yozishma

- Ikki ustunli (desktop): chapda suhbatlar ro'yxati (do'kon, oxirgi xabar, o'qilmaganlar), o'ngda chat. Mobil — alohida ekranlar.
- Chat tepasida so'rov konteksti (quvvat, status badge, "Taklifni ko'rish").
- Xabar: matn (4 000 belgi), ilovalar (5 × 10 MB, rasm/PDF; yuklash progressi va "tekshirilmoqda" holati), vaqt, holat (yuborilmoqda / yuborildi / o'qildi).
- Tizim xabarlari (status o'zgarishi, revision, o'lchov) — markazda, kulrang, ikonka bilan.
- Yuborish xatosi: xabar qizil chegara bilan joyida qoladi, "Qayta yuborish"; matn yo'qolmaydi.
- Yangi xabar kelganda pastga skroll faqat foydalanuvchi pastda bo'lsa; aks holda "N ta yangi xabar ↓" chipi.

## U9.4. O'lchov uchrashuvi

- Do'kon 1–3 ta vaqt oralig'ini taklif qiladi (sana + soat oralig'i); chatda karta ko'rinishida.
- Mijoz bittasini tanlaydi yoki "Boshqa vaqt taklif qilish"; tasdiqdan oldin "Kontaktingiz do'konga ochiladi" eslatmasi.
- Tasdiqlangan uchrashuv: sana, vaqt, manzil, do'kon xodimi, "Kalendarga qo'shish" (.ics), "Bekor qilish" (sabab bilan).

## U9.5. Taklif kartasi va revisionlar

- **Karta**: do'kon (logo, reyting, belgilar), jami narx, 1 kVt narxi, tizim quvvati, kafolat (uskuna / montaj alohida), montaj muddati, amal qilish muddati, moliyalashtirish varianti (bo'lsa). Amallar: "Batafsil", "Yozish", "Tanlash".
- **Batafsil**: qatorlar jadvali (mahsulot, miqdor, birlik narxi, jami), montaj, yetkazish, qo'shimcha, chegirma, QQS, nimalar kiradi / kirmaydi, kafolat matni, PDF.
- **Revisionlar**: "Tahrir 3 · 2 kun oldin" tanlagichi; oldingi tahrir bilan farqlar ajratilgan (o'zgargan qiymat sun-100 fon, eski qiymat chizilgan). Yangi tahrir kelganda karta ustida "Yangilandi" badge'i.
- **Muddat**: 48 soat qolganda badge "Muddati tugayapti · 2 kun" (diqqat toni); bu TZ 14.2 dagi QUOTE_EXPIRING bildirishnomasi bilan bir xil chegara. Muddati o'tgan — xira, "Muddati o'tgan" badge, "Do'kondan yangilashni so'rash".

## U9.6. Takliflarni solishtirish (TZ 4.12)

- **Desktop**: jadval, har ustun — bitta do'kon; yuqorida sticky qator — do'kon nomi, jami narx, "Tanlash". Qator guruhlari: Narx · Uskuna · Montaj va muddat · Kafolat · Moliyalashtirish · Do'kon.
- **Mobil**: vertikal taklif kartalari; tepasida jami narx, 1 kVt narxi, kafolat va montaj muddati; "Faqat farqlarni ko'rsatish" default yoqilgan.
- Belgilar faqat haqiqiy taqqoslashdan: "Eng arzon (1 kVt uchun)", "Eng uzoq kafolat", "Eng tez montaj"; teng bo'lsa ikkalasiga ham.
- Har taklifni joriy hisob bilan qayta hisoblash: "Bu taklif bilan o'zini oqlash: 6,3–7,1 yil" (calc-engine; taklif narxi bilan).
- Moliyalashtirish varianti bo'lsa — oylik to'lov ham shu shart bilan.

## U9.7. Taklifni tanlash

Tasdiq oynasi: "Siz Quyosh Tech bilan ishlashni tanladingiz. Bu shartnoma yoki to'lov emas — keyingi qadamlarni do'kon bilan kelishasiz." Boshqa do'konlarga avtomatik xabar ketishi aytiladi. Tasdiqdan keyin montaj sahifasiga o'tish.

## U9.8. Montaj kuzatuvi

Vertikal Timeline: Kelishildi → O'lchov → Montaj sanasi → Montaj bajarildi → Qabul qilindi. Har bosqichda sana, kim belgiladi, izoh. Joriy bosqich sun-400 nuqta bilan. INSTALLED holatida sahifa tepasida diqqat banneri "Do'kon montaj bajarilganini bildirdi — tekshirib, qabul qiling" va chek-list tugmasi.

## U9.9. Montajni qabul qilish chek-listi va e'tiroz

- Bandlar ro'yxati (TZ 13.7), har bandda: sarlavha, hint ("Invertor ekranida ishlab chiqarish ko'rinishi kerak"), uchta tugma — OK / Muammo bor / Tegishli emas.
- "Muammo bor" — izoh majburiy (textarea darhol ochiladi), rasm ixtiyoriy; rasm majburiy bandlarda (masalan invertor ekrani) kamera tugmasi ("Rasmga olish" mobilda kamerani ochadi).
- Pastda progress "7 / 9 band"; majburiylar to'ldirilmaguncha "Tasdiqlash" o'chiq va nima qolgani yozilgan.
- Kamida bitta "Muammo bor" bo'lsa — uch yo'l: "Baribir qabul qilish", "Do'kondan tuzatishni so'rash" (chatga avtomatik xabar, status o'zgarmaydi), "E'tiroz bildirish" (sabab, rasm; admin ko'rib chiqadi — DISPUTED).
- Qabul qilingach — A10 animatsiyasi, "O'rnatilgan tizim" kartasi va "Sharh qoldirish" taklifi.

## U9.10. Sharh

- Faqat qabul qilingan montajdan keyin. Yulduzlar (1–5, klaviatura bilan strelkalar), izoh (ixtiyoriy, 2 000), yuborishdan oldin ko'rinish.
- Yuborilgach: darhol chiqsa "Sharhingiz e'lon qilindi"; moderatsiyaga tushsa "Sharhingiz tekshiruvdan keyin chiqadi" — sabab ko'rsatilmaydi (TZ 13.4).
- Do'kon javobi sharh ostida, chap chiziq bilan ajratilgan blokda.
# U10. Mijoz paneli

Navigatsiya: Bosh panel · Obyektlar · Hisoblar · So'rovlar va takliflar · Montajlar · O'rnatilgan tizimlar · Sevimlilar · Yordam · Profil. Mobil pastki navigatsiya: Bosh panel, Hisoblar, So'rovlar, Tizimlarim, Ko'proq.

## U10.1. Bosh panel

- Salomlashuv + kichik SunArc (bugungi chiqish/botish, foydalanuvchi obyekti joylashuvi bo'yicha).
- "Sizdan kutilayotgan amallar" bloki birinchi: taklifga javob, montajni qabul qilish, o'lchov vaqtini tanlash, ishlab chiqarish ko'rsatkichini kiritish (oy boshida). Har biri bitta tugma bilan.
- Keyin: yangi takliflar, ochiq so'rovlar, oxirgi hisoblar (3 ta), o'rnatilgan tizim kartasi (bu oy prognoz vs kiritilgan), yaqin eslatmalar.
- Birinchi kirish (bo'sh holat): illyustratsiya va bitta CTA "Birinchi hisobingizni qiling".

## U10.2. Obyektlar

- Karta: nom, tur ikonkasi (uy, ofis, ombor, garaj), manzil, maydonlar soni va jami maydon, oxirgi hisob sanasi, kichik xarita.
- Obyekt sahifasi: xarita va poligonlar, maydonlar ro'yxati (tahrirlash), shu obyektdagi hisoblar va so'rovlar.
- Arxivlash — tasdiq oynasi, bog'liq hisoblar saqlanishi aytiladi; "Arxiv" filtri.

## U10.3. Hisoblar

- Jadval/karta: sana, obyekt, rejim (Tez/Batafsil), tizim turi, quvvat, oylik tejash, model versiyasi. Amallar: ochish, qayta hisoblash (joriy tarif bilan — yangi hisob yaratiladi, eskisi o'zgarmaydi; oynada shu aytiladi), ulashish, PDF, arxivlash.
- 2–3 tasini belgilab "Solishtirish" (8.14).
- Eski model versiyasidagi hisobda badge "Eski tarif/model bilan · Qayta hisoblash".

## U10.4. So'rovlar va takliflar

- So'rov kartasi: sarlavha, sana, status, do'konlar holati (kichik avatarlar va har birining badge'i), yangi takliflar soni.
- So'rov sahifasi: tablar — Takliflar (solishtirishga havola) · Do'konlar (har biri: status, kontakt ochilganmi, chatga havola) · Yozishma · Tafsilotlar. Amallar: do'kon qo'shish (jami 5 gacha), so'rovni yopish.

## U10.5. O'rnatilgan tizim

- Sarlavha: quvvat, tizim turi, montaj sanasi, do'kon.
- **Ishlab chiqarish**: oylik grafik — prognoz (RangeBar ko'rinishidagi soya band) va haqiqiy (ink-900 nuqtalar); "Bu oy ko'rsatkichini kiritish" (kWh yoki hisoblagich ko'rsatkichi). 20 % dan ko'p farq bo'lsa — diqqat kartasi: "Mayda kWh prognozdan 24 % kam. Sabablari: chang, soya, invertor xatosi. Do'konga yozish / Tozalash eslatmasi".
- **Komponentlar va kafolatlar**: har komponent — model, soni, kafolat tugash sanasi va qolgan muddat chizig'i; 60 kun qolganda diqqat toni.
- **Eslatmalar**: tozalash (har 90 kun), yillik ko'rik, kafolat tugashi; har biri — "Bajarildi", "Keyinga surish (7 kun)", "O'chirish".
- **Hujjatlar**: chek-list natijasi, taklif PDF, kafolat fayllari.

## U10.6. Bildirishnomalar markazi

- Header'dagi qo'ng'iroq → panel (desktop 400 px popover, mobil to'liq ekran). Tablar: Hammasi · O'qilmagan.
- Element: ikonka (tur bo'yicha), qisqa matn, vaqt, o'qilmagan nuqta; bosilganda tegishli sahifa va o'qilgan bo'ladi. "Hammasini o'qildi deb belgilash".
- Guruhlash: bir so'rov bo'yicha bir nechta xabar — "Quyosh Tech: 3 ta yangi xabar".
- Bo'sh holat: "Hozircha yangilik yo'q".

## U10.7. Profil va sozlamalar

- Shaxsiy ma'lumot; hisob turi (jismoniy / yuridik — STIR va tashkilot nomi); til.
- Kontaktlar — telefon/email o'zgartirish OTP bilan.
- **Bildirishnomalar**: jadval — tur × kanal (In-app, Telegram, SMS, Email) toggle'lari; xavfsizlik ogohlantirishlari o'chirib bo'lmaydi (qulf ikonka bilan). SMS tungi cheklovi haqida izoh.
- **Telegram ulash**: "Ulash" → bot havolasi (10 daqiqa amal qiladi) va QR-kod; ulangach — "@username ulangan · Uzish".
- **Xavfsizlik**: parol, faol sessiyalar (qurilma, joy, oxirgi faollik, "Chiqarish"), "Boshqa barcha qurilmalardan chiqish".
- **Animatsiyalarni kamaytirish** toggle (6.6).
- **Hisobni o'chirish**: alohida xavfli bo'lim; qayta kirish (re-auth); oqibatlar ro'yxati (nima o'chadi, nima anonim qoladi — TZ 16); "14 kun ichida bekor qilish mumkin" — so'ng shu 14 kun davomida kabinet tepasida banner "Hisobingiz 12 kundan keyin o'chiriladi · Bekor qilish".

# U11. Do'kon paneli

Navigatsiya: Bosh panel · So'rovlar · Takliflar · Montajlar · Katalog · Filiallar va hudud · Xizmatlar · Portfolio · Sharhlar · Sertifikatlar · Analitika · Vidjet · Xodimlar · Obuna · Sozlamalar. Element foydalanuvchi ruxsati (TZ 2.2) bo'lmasa ko'rinmaydi.

## U11.1. Birinchi kirish: yangi parol o'rnatish (TZ 3.5)
- Onboarding wizard va "Do'kon ochish" sahifasi olib tashlangan (v3.1): do'konni admin yaratadi, u `ACTIVE`.
- **SHP-01 "Yangi parol o'rnating"** (`mustPasswordChange = true` bo'lganda): to'liq ekranli karta — yangi parol va takrori, parol talablari (≥ 8 belgi), "Saqlash". Parol almashtirilmaguncha sidebar va boshqa sahifalar ochilmaydi (har qanday yo'l shu ekranga qaytaradi); "Chiqish" ishlaydi.
- Saqlangach bosh panelga o'tadi. Bosh panelda "Profil to'liqligi: N %" halqasi va yetishmaganlar ro'yxati (profil, filial, xizmat hududi, mahsulotlar) — bo'limlarga havolalar.
- Holat banneri: SUSPENDED — qizil banner va faqat o'qish rejimi.

## U11.2. Bosh panel

- KPI: ko'rishlar, yangi so'rovlar, javob kutayotganlar, yuborilgan takliflar, tanlanish foizi, o'rtacha javob vaqti (median), "muammosiz qabul qilingan" montajlar ulushi. Har KPI bosilsa filtrlangan ro'yxat.
- "Bugun javob bering" ro'yxati — SLA bo'yicha eng eskilari birinchi.
- Obuna limitlari (masalan "Mahsulotlar 180 / 200").

## U11.3. So'rovlar (inbox) va lead pipeline

- Ikki ko'rinish: **Ro'yxat** (tablar statuslar bo'yicha) va **Pipeline** (kanban: Yangi · Bog'lanildi · O'lchov · Taklif · Yutildi · Yutqazildi). Kartani sudrash bosqichni o'zgartiradi (klaviatura muqobili — karta menyusi).
- Karta: mijoz ismi (familiyasiz), tuman, quvvat, tizim turi, kelgan vaqti, mas'ul xodim avatar, javob vaqti taymeri (24 soatdan oshsa diqqat toni).
- So'rov sahifasi: chapda mijoz hisobi xulosasi (kontakt ochilmaganda cheklangan, 9.2), o'rtada chat, o'ngda amallar — mas'ul tayinlash, bosqich, ichki izohlar (faqat do'kon xodimlariga ko'rinadi, sariq fon), "O'lchov taklif qilish", "Taklif tayyorlash", "Rad etish" (sabab majburiy — ro'yxat + izoh).

## U11.4. Taklif tayyorlash (quote builder)

- Ikki ustun: chapda forma, o'ngda sticky xulosa (jami, 1 kVt narxi, QQS, mijoz hisobi bilan solishtirish: "Mijoz kutgan narx diapazoni 38–44 mln").
- Shablondan boshlash; qatorlar: mahsulot (katalogdan qidiruv, narxi avtomatik), miqdor, birlik narxi, jami (serverda hisoblanadi, UI'da preview); montaj, yetkazish, qo'shimcha, chegirma, QQS (stavka, kiritilgan/qo'shiladi), kafolat (uskuna va montaj alohida, oy), montaj muddati, nimalar kiradi/kirmaydi, amal qilish muddati, moliyalashtirish varianti (ixtiyoriy).
- USD katalog narxi — so'mga MB kursi bo'yicha, kurs va sana ko'rinadi.
- Moslik tekshiruvi (TZ 11.13) — panel/invertor/akkumulyator kombinatsiyasi bo'yicha jonli badge.
- Yetishmagan majburiy maydonlar ro'yxati "Yuborish" ustida.
- "Qoralamani saqlash" va "Yuborish" (ruxsat `quote.send` bo'lmasa — "Menejerga yuborish uchun saqlash"). Yuborilgan taklifni yangilash — yangi tahrir sifatida, oynada "Mijoz yangi tahrir haqida xabar oladi".
- Qaytarib olish — sabab bilan.

## U11.5. Montajlar

Ro'yxat statuslar bo'yicha; montaj sahifasi — timeline, sana belgilash, "Montaj bajarildi" (tasdiq oynasi: mijozga chek-list yuboriladi), chek-list natijasi (muammo bo'lgan bandlar ajratilgan), e'tiroz holati.

## U11.6. Katalog va mahsulotlar

- Ro'yxat: model, kategoriya, narx(lar) filiallar bo'yicha, zaxira holati, status, yangilangan sana. Ommaviy amallar: narxni foizga o'zgartirish, zaxira holati, arxivlash.
- **Mahsulot qo'shish**: yagona katalogdan model qidiruvi (brend + model, avto-taklif); topilmasa "Yangi model taklif qilish" (asosiy xususiyatlar, datasheet; admin tekshiruvidan keyin chiqadi — PENDING badge). Keyin: tavsif, narx (UZS/USD, QQS bilan/siz), filial bo'yicha zaxira, amal qilish sanalari.
- Narx jadvali inline tahrir (optimistic lock — boshqa xodim o'zgartirgan bo'lsa "Bu narx boshqa xodim tomonidan o'zgartirilgan · Yangisini ko'rish").

## U11.7. Ommaviy import (CSV/XLSX)

Uch qadam: (1) shablonni yuklab olish va fayl yuklash (5 MB, 5 000 qator); (2) tekshirish — progress, keyin natija: "4 812 qator to'g'ri, 188 xato" va xatolar jadvali (qator, ustun, sabab), xatolar faylini yuklab olish; (3) qo'llash — faqat to'g'ri qatorlar yoki "Xatolarni tuzatib qayta yuklash". Qo'llash bitta tranzaksiya; natija va bildirishnoma.

## U11.8. Filiallar va xizmat hududi

- Filial: nom, manzil (xaritada pin), telefon, ish vaqti (hafta kunlari jadvali, "Tanaffus"), bayram istisnolari.
- Xizmat hududi: xaritada poligon(lar) chizish (8.4 asboblari) yoki tayyor viloyat/tuman chegaralarini tanlash; xizmat turlari belgilanadi. Cheklovlar (500 nuqta, 20 000 km²) oshsa — aniq xato.

## U11.9. Xizmatlar

Har xizmat: tur, narxlash modeli (qat'iy / -dan / kVt uchun / birlik uchun / so'rov orqali), narx, kafolat, tavsif (3 tilda — tablar bilan, tarjima to'liqligi indikatori).

## U11.10. Portfolio

Loyiha: sarlavha, shahar, quvvat, tizim turi, sana, rasmlar (drag-and-drop tartiblash), platformadagi montajga bog'lash ("Tasdiqlangan montaj" belgisi uchun).

## U11.11. Sharhlar

Ro'yxat (yangi, javobsiz filtrlari), reyting taqsimoti; har sharhga bitta ommaviy javob (yozish, tahrirlash). Moderatsiyadagi sharhlar do'konga ko'rinmaydi.

## U11.12. Sertifikatlar (olib tashlangan, v3.1)
Do'kon panelida "Sertifikatlar" bo'limi, hujjat/sertifikat yuklash formalari va ularga tegishli API yo'q (TZ 4.11). Belgilar (rasmiy diler, sertifikatli montajchi, litsenziya) do'kon profilida ko'rinadi, lekin ularni faqat admin do'kon sahifasidan qo'yadi (U12.11).

## U11.13. Vidjet konfiguratori

- Chapda sozlamalar: ruxsat etilgan domenlar (ro'yxat, validatsiya), asosiy rang (do'kon brend rangi — kontrast avtomatik tekshiriladi, 4,5:1 dan past bo'lsa ogohlantirish va eng yaqin mos rang taklifi), logo, til, sarlavha matni.
- O'ngda jonli preview (desktop / mobil almashtirgich).
- Pastda embed kodi (nusxalash tugmasi bilan) va o'rnatish yo'riqnomasi. Reja ruxsat bermasa — 402 holati (11.15).

## U11.14. Analitika

Davr tanlagichi (max 366 kun); grafiklar: ko'rishlar, so'rovlar, javob vaqti, takliflar → tanlanish voronkasi, mahsulotlar bo'yicha ko'rishlar, hudud bo'yicha so'rovlar xaritasi. CSV eksport (ReportJob). Har grafik — jadval muqobili.

## U11.15. Xodimlar va obuna

- **Xodimlar**: ro'yxat (ism, rol, ruxsatlar, oxirgi faollik); egasi «Yangi xodim qo'shish» (login + vaqtincha parol) va «Parolni tiklash» tugmalari bilan boshqaradi (taklif tugmasi yo'q); ruxsatlar — guruhlangan checkbox'lar (Katalog, So'rovlar, Takliflar, Montaj, Marketing, Analitika); OWNER faqat bitta va o'zgartirilmaydi (egalikni topshirish alohida oqim).
- **Obuna**: joriy reja, holat (Sinov · 30 kun · 12 kun qoldi), limitlar va ishlatilgani (progress), keyingi to'lov sanasi, to'lovlar tarixi va kvitansiyalar. Rejani o'zgartirish — taqqoslash jadvali; o'zgarish qachon kuchga kirishi, narx va limitlar oldindan.
- **Limit oshganda (402 PLAN_LIMIT_EXCEEDED)**: amal joyida modal — qaysi limit, hozirgi va reja qiymati, "Rejani yangilash" va "Keyinroq". Ma'lumot yo'qolmaydi (masalan mahsulot qoralama sifatida saqlanadi).
- **To'lov**: Click / Payme / Uzum tanlovi → provayder sahifasi → qaytish sahifasi holatlari: kutilmoqda (3 s da tekshirish, 60 s gacha), muvaffaqiyatli, muvaffaqiyatsiz (sabab ma'lum bo'lsa), bekor qilindi.

# U12. Admin panel

Zichroq interfeys: sidebar, sahifa sarlavhasi va kontekstual amallar; jadvallar 14 px, qator balandligi 44 px. 2FA (parol + OTP) majburiy; sessiya 30 daqiqa harakatsizlikdan keyin qayta tasdiq so'raydi.

## U12.1. Dashboard

Navbatlar soni bilan kartalar: do'kon verifikatsiyasi, sertifikatlar, ProductModel takliflari, moderatsiyadagi sharhlar, shikoyatlar, e'tirozli montajlar, yordam murojaatlari (SLA buzilayotganlari qizil), muddati yaqinlashgan tariflar/eksport qoidalari, valyuta kursi holati, provider ogohlantirishlari.

## U12.2. Umumiy jadval namunasi

Server-side pagination (offset yoki cursor — TZ 9.1), qidiruv, filtrlar paneli, faol filtr chiplari, saralash, ustunlarni yashirish, saqlangan filtr URL'da, ommaviy tanlash, CSV eksport (ruxsat bo'yicha). Bo'sh holat va "filtr natija bermadi" holati alohida.

## U12.3. Yuqori xavfli amallar

Tasdiq oynasi: amal nomi, ta'siri ("12 ta faol taklif yashiriladi"), sabab maydoni (majburiy), yozib tasdiqlash (do'kon nomini kiritish — o'chirish/to'xtatish uchun), "Bu amal audit jurnaliga yoziladi" eslatmasi.

## U12.4. Verifikatsiya va moderatsiya

- Do'kon verifikatsiyasi: chapda hujjatlar ko'ruvchisi (PDF/rasm, kattalashtirish), o'ngda do'kon ma'lumoti va STIR; "Tasdiqlash" / "Rad etish" (sabab shablonlari).
- ProductModel: taklif va mavjud o'xshash modellar yonma-yon; "Tasdiqlash", "Rad etish", "Mavjudiga birlashtirish" (merge oynasi — qaysi maydon qayerdan olinishi).
- Sharhlar: riskScore va riskFlags (TZ 13.4) — har belgi izohi bilan, sharh matni, foydalanuvchi va do'kon tarixi havolalari; "Chop etish" / "Yashirish".
- Shikoyatlar va e'tirozli montajlar: holat, ikki tomon yozishmasi, chek-list va rasmlar; qaror va sabab.

## U12.5. Tarif va eksport qoidalari

- Tarif muharriri: hudud, iste'molchi turi, davr, pog'onalar jadvali (min–max kWh, stavka, mavsum, kun/tun), qat'iy to'lov, manba URL, tekshirilgan sana.
- Validatsiya jonli: pog'onalar kesishishi yoki bo'shliq qizil bilan ko'rsatiladi.
- **Preview**: namuna iste'mollar (100, 300, 600, 1 000 kWh) uchun eski va yangi tarif bo'yicha to'lov taqqoslash jadvali va farq; saqlangan hisoblarga ta'siri ("1 240 ta hisob qayta hisoblashga taklif oladi").
- Nashr — tasdiq oynasi va kuchga kirish sanasi; holat badge: Qoralama / Nashr qilingan / Arxiv.
- Eksport qoidalari, ulanish limitlari, moliyalashtirish mahsulotlari — xuddi shu naqsh: manba, sana, holat, versiya.

## U12.6. Kalkulyator sozlamalari

Versiyalangan parametrlar (TZ 7.5): joriy va qoralama versiya yonma-yon farqi; "Golden test natijalari" bloki (5 nuqta × 3 konfiguratsiya, ruxsat etilgan farq ichida — yashil); nashr faqat testlar o'tganda.

## U12.7. Ma'lumotnomalar

Maishiy texnika turlari va shablonlari, yuklama profillari (12×24 issiqlik xaritasi ko'rinishida tahrir), kategoriyalar va atribut sxemasi, chek-list shablonlari, obuna rejalari.

## U12.8. Kontent (bilimlar markazi)

Maqola muharriri: 3 til tablari (tarjima to'liqligi), Markdown + preview, muqova, kategoriya, teglar, SEO sarlavha/tavsif (belgi hisoblagichi bilan), CTA turi, manbalar, tekshirilgan sana; "Foydalanuvchi sifatida ko'rish" preview; holat va nashr.

## U12.9. Yordam navbati

Ro'yxat — raqam, mavzu, kategoriya, ustuvorlik, holat, mas'ul, birinchi javob muddati (qolgan vaqt taymeri: yashil → sariq (25 % qolganda) → qizil). Murojaat sahifasi: yozishma, ichki izoh (sariq fon, foydalanuvchiga ko'rinmaydi), javob shablonlari, bog'liq obyekt havolasi, requestId bo'yicha log havolasi.

## U12.10. Analitika va audit

- Funnel: bosh sahifa → hisob boshlandi → natija → saqlandi → so'rov → taklif → tanlandi → montaj tasdiqlandi; davr va hudud filtrlari; har bosqichda konversiya foizi.
- Audit jurnali: cursor, filtrlar (aktyor, entity, amal, sana); yozuv sahifasi — before/after farqi (maskalangan PII bilan).

## U12.11. Do'kon yaratish va do'kon hayot sikli (TZ 3.7)
Do'konni faqat admin yaratadi; do'kon o'zi ro'yxatdan o'ta olmaydi. Admin yaratgan do'kon darhol faol va tasdiqlangan.
- **Kirish nuqtasi**: Do'konlar ro'yxati (ADM-25) yuqorisida "+ Do'kon yaratish" (primary). Filtrlar: Hammasi · Faol · To'xtatilgan; "Manba" ustuni.
- **Yaratish paneli (ADM-26)** — o'ngdan drawer, 2 qadam:
  1. *Do'kon ma'lumoti*: nom, STIR (9 raqam, maska), telefon, viloyat, manzil. Tarif maydoni yo'q.
  2. *Egasining hisobi*: ism, login (telefon raqami). STIR/telefon bo'yicha takroriy qidiruv natijasi shu yerda: STIR bo'yicha do'kon topilsa "Yaratish" bloklanadi; telefon bo'yicha do'kon topilsa sariq ogohlantirish va tasdiq; ega raqami band bo'lsa — xato.
- **Natija oynasi**: tizim yaratgan vaqtincha parol **bir marta** ko'rsatiladi, "Nusxa olish" tugmasi bilan; oyna yopilgach parolni qayta ko'rib bo'lmaydi (faqat tiklash).
- **Do'kon sahifasidagi amallar** (12.3 naqshi — tasdiq oynasi, sabab, ta'sir): *Parolni qayta tiklash* (a'zo tanlanadi, yangi vaqtincha parol bir marta), *Xodim qo'shish* (ism, telefon, rol, ruxsatlar, vaqtincha parol), *Egani almashtirish* (a'zolardan tanlanadi; eski ega MANAGER bo'lishi yoziladi), *To'xtatish / Qayta yoqish* (sabab majburiy), *Belgilar* (rasmiy diler va h.k. qo'yish/olib tashlash). Har amal auditga yoziladi.
- **Holat badge'lari**: Faol (leaf) · To'xtatilgan (error). Eski yozuvlar uchun Qoralama/Tekshiruvda ko'rsatilishi mumkin.
- AUTH-09 (taklifni qabul qilish sahifasi) va "Ega taklifi holati" kartasi olib tashlangan.

## U12.12. DevOps paneli (TZ 19.1)

Faqat SUPER_ADMIN, 2FA bilan; ichki tarmoqdan yoki VPN orqali. Maqsad — platforma sog'lig'ini bir ekranda ko'rish va muammoni 2 bosishda manbasigacha topish. Metodika: RED (so'rovlar, xatolar, davomiylik) xizmatlar uchun, USE (yuklama, to'yinganlik, xatolar) resurslar uchun, Google'ning "Four Golden Signals" — umumiy holat uchun.

![Rasm 10. DevOps paneli: xizmatlar holati, SLO, API latency (deploy belgisi bilan), navbatlar, DB, provayder limitlari, alertlar, deploylar va backup.](design/g-ops.png)

### U12.12.1. Joylashuv (12 ustunli to'r, 1280 px)

| Qator | Bloklar (ustun kengligi) | Ko'rinish |
|---|---|---|
| Header | Sarlavha, muhit badge (Production / Staging), vaqt oralig'i segmenti (1 s · 6 s · 24 s · 7 kun · 30 kun), "yangilandi HH:MM:SS · avto 30 s", pauza | Oraliq URL'da saqlanadi |
| 1 | Xizmatlar holati (9) · Mavjudlik va SLO (3) | 7 ta plitka: web, api, worker, PostgreSQL, Redis, Storage, ClamAV — status badge (ikon + matn); SLO — katta raqam + xato byudjeti meter |
| 2 | API latency p95 (6) · So'rovlar RPS (3) · 5xx xatolar (3) | Chiziqli grafiklar, bitta y-o'qi; deploy vertikal uzuq chiziq bilan |
| 3 | Navbatlar (4) · Ma'lumotlar bazasi (4) · Tashqi provayderlar (4) | Gorizontal ustunlar; KPI + sekin so'rovlar jadvali; limit meter'lari |
| 4 | Alertlar (5) · Deploylar (4) · Backup (3) | Jadvallar, status badge |
| 5 | Resurslar USE (12, yig'iladigan) · Biznes pulsi (12) | CPU/RAM/disk/tarmoq — har xizmat uchun kichik ko'p panel (small multiples); hisoblar/soat, so'rovlar, ro'yxatdan o'tish |

### U12.12.2. Grafik qoidalari

- **Seriya ranglari (kategorik, qat'iy tartib)**: 1 — #2E6FBF, 2 — #C77700, 3 — #8A4FBF, 4 — #23955E. Palitra rang ko'rlik simulyatsiyasi va kontrast bo'yicha tekshirilgan (adjacent CVD ΔE ≥ 18,9, sand-50 fonda ≥ 3:1). 4 dan ortiq seriya bo'lsa — "Boshqa" ga yig'iladi yoki small multiples. Rang seriyaga (marshrut guruhiga) bog'lanadi, tartibga emas: filtr o'zgarsa qolganlar rangini o'zgartirmaydi.
- **Status ranglari faqat holat uchun**: Sog'lom — leaf-700, Ogohlantirish — sun-700, Kritik — error-700; har doim ikon (✓ ▲ ✕) va matn bilan, hech qachon seriya rangi sifatida emas.
- **Chegara chiziqlari**: SLO/alert chegarasi error-700 uzuq chiziq va yorliq ("chegara 1 %"). Fon zonalari ishlatilmaydi.
- **Deploy belgisi**: ink-900 uzuq vertikal chiziq + versiya yorlig'i; hover'da commit, muallif, davomiylik.
- **Belgilar**: chiziq 2 px, area to'ldirish 12 % shaffoflik (faqat bitta seriyada), ustun uchi 4 px radius; grid va o'qlar ingichka va och (#EEE8DD); y-o'qi doim 0 dan (latency, RPS, foiz).
- **Ikki o'qli grafik taqiqlangan**: har o'lchov o'z grafigida (RPS va latency alohida).
- **Legenda**: 2+ seriyada doim; ≤ 4 seriyada oxirgi nuqtaga to'g'ridan-to'g'ri yorliq ham ("calculator 640"). Matnlar seriya rangida emas — ink ranglarida.
- **Hover**: chiziqlarda vertikal crosshair va barcha seriya qiymatlari tooltip'da (vaqt, qiymat, birlik); ustunlarda har ustun tooltip'i. Sichqoncha nishoni belgidan katta (≥ 24 px).
- **Jadval ko'rinishi**: har grafik kartasi menyusida "Jadval sifatida" (accessibility va eksport CSV).
- **Drill-down**: grafik nuqtasini bosish → shu vaqt oralig'ida log/trace havolasi (requestId), navbat qatorini bosish → muvaffaqiyatsiz job'lar ro'yxati.
- **Bo'sh/xato holatlar**: metrika manbasi javob bermasa karta "Ma'lumot yo'q · Prometheus javob bermadi (14:31)" — kulrang, grafik chizilmaydi (nol deb ko'rsatilmaydi).

### U12.12.3. Bloklar tafsiloti

| Blok | Metrikalar | Yangilanish | Ogohlantirish chegarasi |
|---|---|---|---|
| Umumiy holat va SLO | Xizmat up/down, 30 kunlik mavjudlik, xato byudjeti qoldig'i | 30 s | Mavjudlik < 99,5 % — kritik |
| API RED | RPS, 5xx %, p50/p95/p99 latency marshrut guruhlari bo'yicha | 30 s | 5xx > 1 % (5 daq), p95 > 800 ms |
| Kalkulyator | Estimate p95, PVGIS/NASA POWER kesh hit %, golden test holati | 1 daq | p95 > 3 s |
| Navbatlar (BullMQ) | Kutayotgan, faol, muvaffaqiyatsiz, eng eski job yoshi — har navbat | 30 s | Eng eski > 10 daq, failed > 0 |
| Ma'lumotlar bazasi | Ulanishlar / limit, tx/s, eng sekin 5 so'rov (pg_stat_statements, parametrlarsiz), replikatsiya kechikishi, disk | 1 daq | Ulanish > 80 %, disk > 85 % |
| Resurslar (USE) | CPU, RAM, disk, tarmoq — har konteyner | 1 daq | CPU > 85 % (10 daq) |
| Deploylar | Xizmat, versiya, commit, vaqt, natija (muvaffaqiyatli / rollback), davomiylik | Webhook | Rollback — ogohlantirish |
| Alertlar | Daraja, matn, boshlanish, davomiylik, kim qabul qildi; "Qabul qilish" tugmasi | Real vaqt | — |
| Backup | Oxirgi to'liq backup, WAL kechikishi, object storage, oxirgi tiklash testi | 15 daq | Backup > 26 soat, tiklash testi > 30 kun |
| Tashqi provayderlar | Esri plitkalari va geocoding oylik limiti (80 % sariq, 95 % qizil), PVGIS xato %, SMS balansi (necha kunga yetadi), Telegram webhook | 1 soat | 80 % / 95 % |
| Biznes pulsi | Hisoblar/soat, taklif so'rovlari, ro'yxatdan o'tish, to'lovlar | 5 daq | Odatiydan 50 % past (anomaliya) |

### U12.12.4. Xavfsizlik va amallar

- Panel faqat o'qish uchun; xavfsiz amallar: alertni qabul qilish, muvaffaqiyatsiz job'ni qayta ishga tushirish, keshni tozalash (12.3 tasdiq oynasi bilan, auditga yoziladi).
- Sirlar (token, parol, ulanish satri) hech qayerda ko'rsatilmaydi; SQL so'rovlar parametrlarsiz.
- Metrikalar faqat ruxsat etilgan ro'yxatdan (OPS_METRIC_NOT_ALLOWED) — panel ixtiyoriy PromQL kiritmaydi.
- Mobil (≤ 768 px): faqat 1-qator (holat, SLO) va alertlar; grafiklar "Desktop'da ochish" havolasi bilan.

# U13. Embed vidjet

- Do'kon saytiga iframe orqali; kenglik 320–640 px, balandlik kontentga moslashadi (postMessage orqali).
- Tarkibi: Tez hisob (8.1) do'kon brendi bilan — logo, asosiy rang (faqat tugma va aksentlar; matn ranglari o'zgarmaydi, kontrast saqlanadi), do'kon nomi sarlavhada.
- Natijadan keyin: "Ushbu do'kondan taklif olish" → telefon → OTP → ism → rozilik checkbox'i ("Platformaning foydalanuvchi shartlari va maxfiylik siyosatiga roziman", havolalar bilan) → yuborildi. Akkaunt platformada yaratilishi aytiladi (TZ 13.6).
- Pastda kichik "Quyosh platformasi asosida" belgisi (havola).
- Uchinchi tomon cookie'lariga tayanmaydi (Safari/Firefox cheklovlari): vidjet holati iframe ichida xotirada.
- Animatsiyalar faqat mikro (6.3) va A4 ning qisqa versiyasi (600 ms).

# U14. Bildirishnomalar va Telegram

## U14.1. Kanallar bo'yicha ko'rinish

- **In-app**: 10.6.
- **SMS**: 160 lotin belgigacha; shablon: "[Quyosh] Quyosh Tech taklif yubordi: 41,2 mln so'm. Ko'rish: q.uz/r/AB12". Qisqa havola.
- **Email**: oddiy bir ustunli shablon, 600 px; logo, sarlavha, 1–3 jumla, bitta tugma, footer (bildirishnoma sozlamalari havolasi). Rasmlarsiz ham o'qiladi.

## U14.2. Telegram — mijoz

Xabar: emoji emas — matn belgisi bilan boshlanadi ("●" status), qalin sarlavha, 2–4 qator tafsilot, inline tugma "Ko'rish" (saytga havola).

## U14.3. Telegram — do'kon tezkor amallari (TZ 4.14)

Yangi so'rov xabari:

- Sarlavha: "Yangi so'rov · Yunusobod tumani"
- Tafsilot: "6,6 kVt · tarmoqqa ulangan · akkumulyatorsiz · montaj kerak"
- Inline tugmalar: "Ko'rdim", "Bog'landim", "O'lchov vaqtini taklif qilish", "Rad etish", "Saytda ochish".

Tugma bosilgandan keyin xabar tahrirlanadi: "✓ Bog'landim — 14:32 (Aziz)" va tugmalar olib tashlanadi. "O'lchov vaqtini taklif qilish" — 3 ta tayyor slot tugmalari (ertaga 10:00–12:00 va h.k.) va "Boshqa vaqt — saytda". "Rad etish" — sabablar tugmalari. Ruxsat yetmasa: "Bu amal uchun ruxsatingiz yo'q — do'kon egasiga murojaat qiling". Token eskirgan bo'lsa (48 soat): "Bu xabar eskirgan — saytda oching".

# U15. PDF hisobot (TZ 4.18)

- A4, chetlar 18 mm, Inter + Onest (raqamlar), ranglar 2.1 palitrasidan; bosib chiqarishda kulrangda ham o'qiladi (naqshlar va labellar).
- **Muqova**: platforma logosi, "Quyosh tizimi taxminiy hisobi", obyekt (tuman, maydon), sana, hisob ID, model versiyasi; SunArc chizmasi (obyekt joylashuvi bo'yicha chiqish/botish); pastda ogohlantirish "Bu prognoz, kafolat emas".
- **1-sahifa**: xulosa jumlasi, 4 KPI (RangeBar bilan), tavsiya tizim tarkibi, cheklovchi omil, asosiy taxminlar.
- **Keyingi sahifalar**: energiya balansi va EnergyFlow, oylik ishlab chiqarish/iste'mol grafigi + jadval, moliyaviy natijalar, kredit taqqoslash (bo'lsa), 25 yillik pul oqimi grafigi + jadval, zaxira (bo'lsa), CO₂, "Qanday hisoblandi" — manbalar, tarif, kurs, sanalar.
- **QR-kod** (mijoz tanlovi, 8.14): oxirgi sahifa pastida, 28 mm, ostida "Hisobni onlayn ko'rish" va qisqa havola.
- Har grafik ostida jadval; jadvallar sahifalar orasida bo'linsa sarlavha qatori takrorlanadi; kichik shrift (< 8 pt) yo'q.
- Til va formatlar foydalanuvchi tanlagan tilda (4-bo'lim).
- Tijoriy taklif PDF (`/quotes/:id/pdf`) — do'kon logosi va rekvizitlari, qatorlar jadvali, kafolat va shartlar, amal qilish muddati, tahrir raqami; pastda "Platforma orqali tayyorlangan · bu shartnoma emas".

# U16. Holatlar va mikrocopy

## U16.1. Holatlar

| Holat | Vizual | Matn va xulq |
|---|---|---|
| Loading | Skeleton (kontent shaklida) yoki inline A8 | Sahifa darajasida oq ekran yo'q; 10 s dan oshsa sabab matni |
| Empty — birinchi foydalanish | Illyustratsiya + 1 CTA | Nima bo'lishi va qanday boshlash |
| Empty — filtr natijasi yo'q | Ikonka | "Filtrlarni o'zgartiring" + "Tozalash" |
| Error — maydon | Input ostida error-700 | Nima noto'g'ri va qanday tuzatish |
| Error — blok | Blok ichida banner | "Qayta urinish"; kiritilgan ma'lumot saqlanadi |
| Error — sahifa | 500 sahifasi (7.8) | requestId va yordam havolasi |
| Success | Toast yoki inline check | Nima bo'ldi va keyingi qadam |
| Warning | Diqqat banneri/badge | Muammo, ta'siri, yechim |
| Offline | Header ostida banner | Draft saqlanadi; aloqa tiklanganda qayta yuboriladi |
| Permission denied | Xavfsiz xabar | Ma'lumot oshkor qilinmaydi, orqaga qaytish |
| Not found (404) | 7.8 | Boshqa foydalanuvchi resursi uchun ham xuddi shu (TZ 2.3) |
| Session expired | Modal | Forma ma'lumoti saqlanadi |
| Plan limit (402) | Modal (11.15) | Qaysi limit va yechim |
| Provider unavailable | Inline banner | "Quyosh ma'lumoti vaqtincha olinmadi — viloyat o'rtachasi ishlatildi" (DEFAULT usuli bo'lsa) |

## U16.2. errorCode → foydalanuvchi matni

TZ 9.2 katalogidagi har kod uchun UI matni. Texnik kod foydalanuvchiga ko'rsatilmaydi.

| errorCode | Foydalanuvchiga (uz) |
|---|---|
| VALIDATION_ERROR | Ba'zi maydonlarni tekshiring — ular quyida belgilangan. |
| UNAUTHENTICATED | Sessiya tugadi. Davom etish uchun qayta kiring. |
| FORBIDDEN | Bu amal uchun ruxsatingiz yo'q. |
| NOT_FOUND | Bu sahifa yoki ma'lumot topilmadi. |
| CONFLICT | Bu qiymat allaqachon band (masalan, email). Boshqasini kiriting. |
| VERSION_CONFLICT | Bu ma'lumotni boshqa xodim o'zgartirdi. Yangi versiyani ko'rib, qayta saqlang. |
| INVALID_STATUS_TRANSITION | Bu amal hozirgi holatda mumkin emas. Sahifani yangilang. |
| IDEMPOTENCY_CONFLICT | So'rov allaqachon yuborilgan. Natijani tekshiring. |
| PLAN_LIMIT_EXCEEDED | Rejangiz limitiga yetdingiz. Rejani yangilash yoki keyinroq urinish mumkin. |
| RATE_LIMITED | Juda ko'p urinish. {sekund} soniyadan keyin qayta urining. |
| OTP_INVALID | Kod noto'g'ri. Yana {n} ta urinish qoldi. |
| OTP_EXPIRED | Kod eskirgan. Yangi kod so'rang. |
| OTP_TOO_MANY_ATTEMPTS | Urinishlar tugadi. {daqiqa} daqiqadan keyin qayta urining. |
| POLYGON_INVALID | Chizma noto'g'ri: chiziqlar kesishmasligi kerak. Belgilangan nuqtani suring. |
| POLYGON_TOO_LARGE | Maydon juda katta (50 000 m² gacha). Kichikroq qismini chizing. |
| TARIFF_NOT_FOUND | Bu hudud uchun tarif ma'lumoti yo'q. Elektr sarfini kWh da kiriting. |
| SOLAR_DATA_UNAVAILABLE | Quyosh ma'lumoti hozir olinmadi. Bir necha daqiqadan keyin urining. |
| QUOTE_REQUEST_CLOSED | Bu so'rov yopilgan. |
| SHOP_NOT_RECIPIENT | Bu so'rov sizning do'koningizga yuborilmagan. |
| CONTACT_NOT_REVEALED | Mijoz kontaktni hali ochmagan. Yozishma orqali bog'laning. |
| REVIEW_NOT_ELIGIBLE | Sharh montaj qabul qilingandan keyin yoziladi. |
| FILE_TYPE_NOT_ALLOWED | Bu fayl turi qabul qilinmaydi. Ruxsat etilgan: {turlar}. |
| FILE_TOO_LARGE | Fayl juda katta. Maksimal hajm — {MB} MB. |
| FILE_INFECTED | Fayl xavfsizlik tekshiruvidan o'tmadi va yuklanmadi. |
| PROVIDER_UNAVAILABLE | Tashqi xizmat vaqtincha javob bermayapti. Birozdan keyin urining. |
| INTERNAL_ERROR | Kutilmagan xato yuz berdi. Biz xabardormiz. Murojaat raqami: {requestId}. |

## U16.3. Yozuv uslubi

- "Siz" bilan, faol nisbatda, qisqa jumlalar. Tugma — fe'l bilan: "Taklif so'rash", "Saqlash", "Hisoblab ko'rish" ("OK", "Yuborish" o'rniga aniq fe'l).
- Kafolat ohangi yo'q: "tejaysiz" emas — "taxminan tejashingiz mumkin".
- Xato matni ayblamaydi: "Noto'g'ri kiritdingiz" emas — "Raqam 12 xonali bo'lishi kerak".
- Raqamlar va birliklar 4-bo'lim bo'yicha; atamalar 3-bo'lim bo'yicha.

# U17. Accessibility

- WCAG 2.1 AA: matn 4,5:1, yirik matn va UI grafikasi 3:1 — 2.1 palitrasi tekshirilgan; yangi rang qo'shilsa kontrast jadvalga yoziladi.
- To'liq klaviatura: mantiqiy tab tartibi, ko'rinadigan focus (2.1), "Kontentga o'tish" havolasi, modal'da focus trap va yopilgach oldingi elementga qaytish, Esc.
- Xarita: barcha xarita amallarining muqobili — do'konlar ro'yxat sifatida; poligon chizish o'rniga maydonni raqam bilan kiritish; markerlar klaviatura bilan tanlanadi.
- Har input label bilan bog'langan; xato `aria-live="polite"` bilan e'lon qilinadi; hisob natijasi bitta `aria-live` e'loni (A4).
- Grafiklar — jadval muqobili; SVG'larda `role="img"` va mazmunli label; legenda matn bilan.
- Touch target ≥ 44×44 px; yonma-yon muhim tugmalar orasida ≥ 8 px.
- Matnni 200 % kattalashtirganda kontent kesilmaydi; 320 px kenglikda gorizontal skroll yo'q.
- Reduced motion — 6.6; avtomatik yopiladigan toast hover/fokus'da to'xtaydi.
- Ekran o'quvchida tekshirish: NVDA + Chrome, VoiceOver + Safari iOS, TalkBack + Chrome Android — asosiy oqimlar (Tez hisob, login, taklif so'rovi).

# U18. Lokalizatsiya

- Tillar: `uz` (o'zbek lotin), `oz` (o'zbek kirill), `ru`. Har matn tarjima kalitidan; komponent ichida qattiq yozilgan matn yo'q (lint qoidasi).
- O'zbek lotinida to'g'ri belgilar: oʻ, gʻ — U+02BB (ʻ), tutuq belgisi — U+02BC (ʼ). Kalitlar fayllarida ' (apostrof) ishlatilmaydi; qidiruv har ikkala variantni teng qabul qiladi.
- Kirill: Ў, Қ, Ғ, Ҳ — shriftlar tekshirilgan (2.4).
- Matn uzayishi: rus va kirill matnlari 30–40 % uzunroq bo'lishi mumkin — har komponent shu bilan sinaladi; tugma matni ikki qatorga tushmaydi (qisqaroq tarjima varianti beriladi).
- Ko'plik shakllari ICU MessageFormat bilan (ruschada 1 / 2–4 / 5+).
- Kafolat, kredit, tarif va eksport bo'yicha tasdiqlanmagan va'da yoki huquqiy xulosa yozilmaydi; huquqiy matnlar yurist tasdig'idan o'tadi.

# U19. Figma va handoff

1. Sahifalar: 00 Cover va changelog · 01 Tokens (Variables: rang, spacing, radius, motion) · 02 Components · 03 Signature (SunArc, StepArc, RangeBar, EnergyFlow, PanelLayer) · 04 Public · 05 Calculator · 06 Map va Catalog · 07 Quotes · 08 Customer · 09 Shop · 10 Admin (do'kon yaratish, DevOps paneli bilan) · 11 Widget · 12 PDF · 13 Email/SMS/Telegram · 14 Motion (har A1–A16 uchun kadrlar va reduced holat) · 15 Prototype · 99 Archive.
2. Har ekran desktop 1280 va mobil 360; kerakli joylarda 768 va 1024.
3. Har komponent — barcha holatlar (5.1 jadvali) va uch tildagi eng uzun matn bilan.
4. Komponentlar Auto Layout va Variables bilan; token nomlari kod bilan bir xil.
5. Prototip oqimlari: Tez hisob, Batafsil hisob (mobil va desktop), login va draft tiklanishi, taklif so'rovi, takliflarni solishtirish va tanlash, montajni qabul qilish, do'kon: so'rovga javob va taklif yuborish.
6. Motion: har signature animatsiya uchun parametrlar jadvali (6.4 formatida) va Figma Smart Animate prototipi; murakkablari uchun brauzerda ishlaydigan HTML namunasi.
7. Har ekran ekran reyestridagi ID bilan nomlanadi (21-bo'lim) — Jira vazifalari shu ID'ga bog'lanadi.
8. Figma havolasi va versiyasi TZ bilan birga loyiha hujjatlarida; tasdiqlangan versiya — yagona manba.

# U20. Qabul qilish mezonlari (UX Definition of Done)

| ID | Mezon |
|---|---|
| UX-01 | Ekran reyestridagi (21) barcha ekranlar desktop va mobil maketga ega; prototip oqimlari (19.5) ishlaydi |
| UX-02 | Tokenlar `styles/tokens.css` da (GetMaster tizimi), komponentlar testlari bilan; nomlar Figma bilan bir xil; xom HEX/px kodda yo'q (lint) |
| UX-03 | Bosh sahifadagi asosiy CTA 1280×720 va 360×640 da birinchi ekranda |
| UX-04 | Tez hisob 3 daqiqadan kam vaqtda natija beradi (5 ishtirokchi, mobil va desktop) |
| UX-05 | Draft refresh, til almashishi, brauzer "orqaga" va login'dan keyin saqlanadi |
| UX-06 | Hech bir prognoz kafolat sifatida ko'rsatilmaydi; har bir prognoz KPI diapazon va manba bilan |
| UX-07 | Barcha ranglar 2.1 jadvalidagi kontrastga mos; axe-core: 0 critical/serious |
| UX-08 | Klaviatura va ekran o'quvchi bilan asosiy oqimlar o'tadi (17-bo'lim qurilmalarida) |
| UX-09 | Har signature animatsiya 6.4 parametrlariga mos, reduced holati ishlaydi, o'rta Android'da 60 fps |
| UX-10 | Hero animatsiyasi LCP ni yomonlashtirmaydi: animatsiyali va animatsiyasiz LCP farqi ≤ 100 ms |
| UX-11 | Qayta hisoblash 8.9 qoidasiga mos: tipik Tez hisobda ≤ 4 estimate so'rovi, guest 429 olmaydi |
| UX-12 | Loading, empty, error, success, offline, permission, session expired, 402 holatlari maketlangan va ishlaydi |
| UX-13 | Status badge'lari 5.3 jadvaliga, xato matnlari 16.2 jadvaliga to'liq mos |
| UX-14 | uz / oz / ru da layout buzilmaydi; ʻ va kirill harflari to'g'ri; formatlar 4-bo'limga mos |
| UX-15 | Mobil jadvallar kartaga aylanadi; 320 px da gorizontal skroll yo'q |
| UX-16 | Kontakt ochilmagan holatda do'kon UI'sida telefon, aniq manzil va poligon ko'rinmaydi; ulashilgan sahifada ham |
| UX-17 | Kun vaqti mavzusi to'rt davrda to'g'ri almashadi; joylashuv ruxsati so'ralmaydi |
| UX-18 | Kalkulyator, xarita, natija va taklif oqimlari real kontent bilan usability testdan o'tgan; topilgan kritik muammolar tuzatilgan |
| UX-19 | Bosh sahifa Lighthouse (mobil): Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95; LCP ≤ 2,5 s, CLS ≤ 0,05; hero video reduced motion / Save-Data / 3G da yuklanmaydi, pauza tugmasi ishlaydi |
| UX-20 | Bosh sahifa uch tilda, video subtitrlari uz/oz/ru; video ustidagi matn kontrasti eng yorug' kadrda ≥ 4,5:1 |
| UX-21 | Esri atribusiyasi barcha xarita ko'rinishlarida (mobil sheet ochiq holatda ham) ko'rinadi; limit tugagan holat maketlangan va ishlaydi |
| UX-22 | Admin do'kon yaratish: takroriy STIR bloklaydi, egasiz do'kon public'da ko'rinmaydi, taklif holatlari va barcha hayot sikli amallari auditga yoziladi |
| UX-23 | DevOps paneli: barcha grafiklarda legenda, tooltip va jadval ko'rinishi; status rangi ikon va matnsiz ishlatilmagan; ikki o'qli grafik yo'q |
| UX-25 | Bosh saytda fotosurat/video yo'q; 3D "Quyosh filmi" 8 bob bilan ishlaydi; WebGL yo'q va reduced-motion holatlari statik kadrlar bilan |
| UX-26 | Mijoz, do'kon va admin panellari bitta qobiqda (GetMaster `MainLayout`): sidebar guruhlari, header, mobil navigatsiya, yorug'/qorong'i mavzu, panel rangi |
| UX-27 | Kirish ekrani split-screen; OTP test rejimi kartasi faqat `OTP_DEV_ECHO` yoqilganda va production'da hech qachon chiqmaydi |
| UX-24 | DevOps paneli manba javob bermaganda "Ma'lumot yo'q" ko'rsatadi (nol emas); sirlar va parametrli SQL hech qayerda ko'rinmaydi |

# U21. Ekranlar reyestri

| Guruh | ID va ekranlar |
|---|---|
| Public | PUB-01 Bosh sahifa · PUB-02 Kalkulyator landing · PUB-03 Xarita · PUB-04 Do'konlar ro'yxati · PUB-05 Do'kon profili · PUB-06 Katalog · PUB-07 Mahsulot · PUB-08 Mahsulotlarni solishtirish · PUB-09 Bilimlar markazi · PUB-10 Maqola · PUB-11 Atamalar lug'ati · PUB-12 FAQ · PUB-13 Yordam markazi · PUB-14 Murojaat yaratish · PUB-15 Ulashilgan hisob · PUB-17 Bosh sahifa video pleyer (tushuntiruvchi video, boblar) |
| Auth | AUTH-01 Kirish (telefon) · AUTH-02 Kirish (email) · AUTH-03 OTP · AUTH-04 Ro'yxatdan o'tish · AUTH-05 Parolni tiklash · AUTH-06 Login modal · AUTH-07 Sessiya tugadi · AUTH-08 Admin TOTP · AUTH-09 Do'kon: yangi parol o'rnatish (birinchi kirish; SHP-01 bilan bir ekran) |
| Kalkulyator | CALC-01 Tez hisob · CALC-02..07 Batafsil 1–6 qadam · CALC-08 Maishiy texnika · CALC-09 Natija · CALC-10 Kredit kalkulyatori · CALC-11 Uzilish kalkulyatori · CALC-12 Saqlash · CALC-13 Ulashish · CALC-14 Hisoblarni solishtirish · CALC-15 PDF oynasi · CALC-16 Draft tiklash |
| Takliflar | QT-01 So'rov wizard (4 qadam) · QT-02 So'rov yuborildi · QT-03 So'rov sahifasi · QT-04 Yozishma · QT-05 O'lchov uchrashuvi · QT-06 Taklif tafsiloti va tahrirlar · QT-07 Takliflarni solishtirish · QT-08 Tanlash tasdig'i · QT-09 Montaj kuzatuvi · QT-10 Qabul chek-listi · QT-11 E'tiroz · QT-12 Sharh |
| Mijoz | CUS-01 Bosh panel · CUS-02 Obyektlar · CUS-03 Obyekt sahifasi · CUS-04 Hisoblar · CUS-05 So'rovlar · CUS-06 O'rnatilgan tizim · CUS-07 Ishlab chiqarishni kiritish · CUS-08 Bildirishnomalar · CUS-09 Sevimlilar · CUS-10 Profil · CUS-11 Bildirishnoma sozlamalari · CUS-12 Telegram ulash · CUS-13 Sessiyalar · CUS-14 Hisobni o'chirish · CUS-15 Murojaatlarim |
| Do'kon | SHP-01 Yangi parol o'rnatish (birinchi kirish) · SHP-02 Bosh panel · SHP-03 So'rovlar ro'yxati · SHP-04 Pipeline · SHP-05 So'rov sahifasi · SHP-06 Taklif tayyorlash · SHP-07 Taklif shablonlari · SHP-08 Montajlar · SHP-09 Katalog · SHP-10 Mahsulot qo'shish/tahrirlash · SHP-11 Model taklif qilish · SHP-12 Import · SHP-13 Filiallar · SHP-14 Xizmat hududi · SHP-15 Xizmatlar · SHP-16 Portfolio · SHP-17 Sharhlar · (SHP-18 olib tashlangan) · SHP-19 Vidjet · SHP-20 Analitika · SHP-21 Xodimlar · (SHP-22, SHP-23 olib tashlangan) · SHP-24 Do'kon sozlamalari |
| Admin | ADM-01 Dashboard · ADM-02 (olib tashlangan: verifikatsiya navbati) · ADM-03 Do'kon belgilari (do'kon sahifasida) · ADM-04 ProductModel moderatsiyasi va birlashtirish · ADM-05 Sharhlar · ADM-06 Shikoyatlar · ADM-07 E'tirozli montajlar · ADM-08 Tariflar va preview · ADM-09 Eksport qoidalari · ADM-10 Ulanish limitlari · ADM-11 Moliyalashtirish mahsulotlari · ADM-12 Kalkulyator sozlamalari · ADM-13 Maishiy texnika va shablonlar · ADM-14 Yuklama profillari · ADM-15 Kategoriyalar · ADM-16 Chek-list shablonlari · ADM-17 Kontent · ADM-18 Yordam navbati · ADM-19 Foydalanuvchilar · ADM-20 Obuna rejalari · ADM-21 Funnel · ADM-22 Audit · ADM-23 Valyuta kurslari · ADM-24 Platforma sozlamalari · ADM-25 Do'konlar ro'yxati · ADM-26 Do'kon yaratish · ADM-27 Parolni tiklash va xodim qo'shish · ADM-28 Do'kon admin rejimi · ADM-29 To'xtatish / qayta faollashtirish · ADM-30 Egalikni o'tkazish · ADM-31 Bosh sahifa bloklari va media (SiteBlock) · ADM-32 DevOps paneli · ADM-33 DevOps: navbat tafsiloti · ADM-34 DevOps: alertlar tarixi |
| Boshqa | WID-01 Vidjet (hisob, OTP, yuborildi) · PDF-01 Hisob PDF · PDF-02 Taklif PDF · MSG-01 Email shablonlari · MSG-02 SMS · MSG-03 Telegram (mijoz, do'kon) |
| Tizim holatlari | SYS-01 404 · SYS-02 500 · SYS-03 Texnik ishlar · SYS-04 Offline · SYS-05 Cookie banneri · SYS-06 Ruxsat yo'q · SYS-07 Limit (402) · SYS-08 Provayder ishlamayapti · SYS-09 Skeleton to'plami · SYS-10 Bo'sh holat illyustratsiyalari (8 ta) |

# U22. Ishlab chiqishdan oldingi tasdiqlash

Frontend ishlab chiqish boshlanishidan oldin mahsulot egasi quyidagilarni tasdiqlaydi:

1. «Quyosh yo'li» konsepsiyasi va kun vaqti mavzusi (1-bo'lim).
2. Rang va tipografiya tokenlari (2-bo'lim) — kontrast jadvali bilan.
3. UI atamalar lug'ati (3-bo'lim).
4. Bosh sahifa, Tez hisob, Batafsil hisob (mobil va desktop) va natija sahifasi maketlari.
5. Takliflarni solishtirish va do'konning taklif tayyorlash ekrani.
6. Mijoz, do'kon va admin kabinetlari navigatsiyasi.
7. Signature animatsiyalar (A1–A16) prototiplari va reduced-motion xulqi.
8. Uch tildagi matnlar namunasi.
9. Ilova B dagi TZ o'zgarishlari bo'yicha qaror.

Tasdiqlangan Figma versiyasi ishlab chiqish uchun yagona dizayn manbasi hisoblanadi.

## Ilova C. Ochiq masalalar (UI/UX dan TZ ga)

UI/UX ishlab chiqishda topilgan, TZ darajasida qaror talab qiladigan masalalar. Ular TZ ning keyingi tahririda yopiladi.

| # | Masala | Taklif | TZ bo'limi |
|---|---|---|---|
| 1 | 4-bo'lim olib tashlangan, havolalar qolgan; raqamlash 3 dan 5 ga sakraydi | 0.2 xaritasi bo'yicha havolalarni almashtirish; 4-bo'lim o'rniga "UI/UX — alohida hujjat" degan qisqa bo'lim | 0, 3, 11, 22, Ilova A |
| 2 | Guest estimate 10/daqiqa — interaktiv kalkulyator uchun tor | Guest 20/daqiqa, 150/kun; yoki 8.9 qoidasi bilan qoldirish va UX-11 bilan tekshirish | 10.3 |
| 3 | `GET /map/shops` va `GET /shops` da UI filtrlari yo'q | Qo'shish: `certType` (OFFICIAL_DEALER, CERTIFIED_INSTALLER), `minRating`, `openNow` (xaritaga), `productCategory` | 9.6, 9.8 |
| 4 | Ssenariy nomlari: 11.10 "konservativ/standart/optimistik" | Kodda LOW/BASE/HIGH; matn lug'atga havola | 11.10 |
| 5 | `/quotes/:id/pdf` va `/calculations/:id/report` da til parametri ko'rsatilmagan | `locale` parametri | 9.9, 9.10 |
| 6 | Foydalanuvchi "Animatsiyalarni kamaytirish" sozlamasi uchun maydon yo'q | `User.reducedMotion boolean` (yoki preferences JSON) | 7.2 |
| 7 | Mahalliy vaqtga bog'liq hero uchun quyosh chiqishi/botishi endpointi | Klientda hisoblash (API kerak emas) — TZ 11.2 ga izoh: "UI bezagi uchun klientda ham hisoblanadi" | 11.2 |
| 8 | Uzilgan qayta hisoblash so'rovlari (AbortController) serverda ham to'xtashi | Estimate'ni klient uzganda server hisobni bekor qilishi (request close) | 9.9 |

# Ilova B. v3.0 o'zgarishlari

| # | Avval | v3.0 | Bo'lim |
|---|---|---|---|
| 1 | TZ v1.1 va UI/UX v2.1 alohida | Bitta hujjat: I qism (TZ) va II qism (UI/UX) | Butun hujjat |
| 2 | Next.js, Turborepo, packages/* | Vite + React SPA (4 rejim), NestJS ildizda, GetMaster tuzilmasi | TZ 5, 6.1 |
| 3 | Zod yagona manba | Backend class-validator, frontend zod | TZ 5.5, 6.3 |
| 4 | `User.role` + TOTP | `UserRole[]` (CUSTOMER/SHOP/ADMIN), isSuperAdmin, adminPermissions; 2FA OTP orqali | TZ 2.1, 6.4, 7.2 |
| 5 | Access token cookie'da, CSRF double-submit | Access token xotirada, refresh cookie panel bo'yicha; OTP test rejimi | TZ 6.4 |
| 6 | Bitta veb-ilova ichida kabinetlar | Bosh sayt + mijoz + do'kon + admin — alohida panellar va portlar | TZ 5.2, 5.4 |
| 7 | Bosh sahifada manzil maydoni va video | Funksiyasiz bosh sayt, Three.js "Quyosh filmi", fotosuratsiz | U7.1, U6.9, TZ 5.6 |
| 8 | «Quyosh yo'li» qumrang palitra, Onest + Inter | GetMaster token tizimi, panel aksentlari, qorong'i mavzu; Onest (Manrope o'rnida) + Inter + JetBrains Mono | U2 |
| 9 | Motion 80/140/220/360/600 ms | GetMaster tokenlari 90/160/260/480/900 ms, GSAP + Lenis + Three.js | U6 |
| 10 | Kabinet sidebar 248 px | GetMaster qobig'i: sidebar 288, header 64, mobil navigatsiya, nav-items | U5.5 |
| 11 | Kirish — modal/sahifa | Split-screen AuthLayout | U7.2 |
| 12 | Konsept rasmlar qumrang | GetMaster uslubida qayta chizildi | Rasmlar |
| 13 | v3.1: do'kon o'zi ro'yxatdan o'tadi va onboarding'dan o'tadi; egasi ShopInvitation havolasi orqali kiradi (SMS/OTP); do'kon hujjat va sertifikat yuboradi; bosh sayt mijoz va do'konga | **Do'konni faqat admin yaratadi** (3.7: do'kon + egasining hisobi + vaqtincha parol, `POST /admin/shops`); **do'kon login + parol bilan kiradi**, OTP yo'q, birinchi kirishda parol almashtirish majburiy (`User.mustPasswordChange`, 6.4); ShopInvitation, do'kon ro'yxatdan o'tishi, onboarding va hujjat/sertifikat yuborish olib tashlangan; verifikatsiya hujjat bilan emas — admin yaratgan do'kon `VERIFIED`, belgilarni faqat admin qo'yadi; **bosh sayt faqat mijoz uchun**; do'kon formasida tarif yo'q | TZ 1.3, 2.1, 3.5, 3.7, 4.11, 6.4, 7.3, 9.7, 9.11; U5.5, U7.1, U7.2, U11.1, U11.12, U12.11, U21 |
