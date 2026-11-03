import { ArticleType, CtaType, PrismaClient } from '@prisma/client';

/**
 * Bilimlar markazi boshlang‘ich kontenti (TZ 22.26: ishga tushishda kamida 20 material, 3 tilda).
 * uz va ru shu yerda; oz (kirill) API’da uz dan transliteratsiya qilinadi. Idempotent (slug bo‘yicha upsert).
 * Raqamlar umumiy ma’lumot sifatida; tarif va eksport qoidalari kalkulyatorda admin tasdiqlagan manbadan olinadi.
 */
type L = { uz: string; ru: string };
interface Seed { slug: string; type: ArticleType; cat: string; title: L; summary: L; body: L; cta?: CtaType; beginner?: number; tags?: string[]; sources?: string[] }

const CATS: Array<{ slug: string; icon: string; name: L }> = [
  { slug: 'asoslar', icon: 'sun', name: { uz: 'Asoslar', ru: 'Основы' } },
  { slug: 'tizim-va-uskunalar', icon: 'cpu', name: { uz: 'Tizim va uskunalar', ru: 'Система и оборудование' } },
  { slug: 'tom-va-joylashuv', icon: 'home', name: { uz: 'Tom va joylashuv', ru: 'Крыша и расположение' } },
  { slug: 'pul-va-tarif', icon: 'wallet', name: { uz: 'Pul, tarif va kredit', ru: 'Деньги, тариф и кредит' } },
  { slug: 'takliflar-va-montaj', icon: 'clipboard', name: { uz: 'Takliflar va montaj', ru: 'Предложения и монтаж' } },
  { slug: 'xizmat-korsatish', icon: 'wrench', name: { uz: 'Xizmat ko‘rsatish', ru: 'Обслуживание' } },
  { slug: 'platforma', icon: 'help', name: { uz: 'Platforma bo‘yicha savollar', ru: 'Вопросы о платформе' } },
  { slug: 'atamalar', icon: 'book', name: { uz: 'Atamalar lug‘ati', ru: 'Словарь терминов' } },
];

const PVGIS = 'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en';
const NASA = 'https://power.larc.nasa.gov/';

const A: Seed[] = [
  {
    slug: 'quyosh-paneli-qanday-ishlaydi', type: 'GUIDE', cat: 'asoslar', beginner: 1, cta: 'CALCULATOR', sources: [PVGIS],
    title: { uz: 'Quyosh paneli qanday ishlaydi', ru: 'Как работает солнечная панель' },
    summary: { uz: 'Paneldan rozetkagacha: quyosh nuri elektrga qanday aylanadi va uyda qanday ishlatiladi.', ru: 'От панели до розетки: как солнечный свет становится электричеством и используется дома.' },
    body: {
      uz: `## Asosiy g‘oya\n\nQuyosh paneli yarimo‘tkazgich elementlardan iborat. Ularga yorug‘lik tushganda **o‘zgarmas tok (DC)** hosil bo‘ladi. Uydagi jihozlar esa **o‘zgaruvchan tok (AC)** bilan ishlaydi, shuning uchun tizimda **invertor** bor — u DC ni 220 V AC ga aylantiradi.\n\n## Tizim tarkibi\n\n- **Panellar** — tomda yoki yerda, janubga qaratilgan bo‘lsa eng ko‘p ishlab chiqaradi.\n- **Invertor** — DC → AC, ishlab chiqarishni kuzatadi.\n- **Akkumulyator** (ixtiyoriy) — kunduzgi ortiqcha energiyani kechqurun yoki elektr o‘chganda ishlatish uchun.\n- **Himoya va kabellar** — avtomatlar, yerga ulash, kabel kanallari.\n\n## Qachon qancha ishlaydi\n\nIshlab chiqarish quyosh balandligi, havo, soya va harorat bilan o‘zgaradi: yozda ko‘p, qishda kam, tushda eng yuqori. Kalkulyatorimiz har soat uchun hisoblaydi va oylik prognozni ko‘rsatadi.\n\n## Keyingi qadam\n\nManzilingiz va oylik sarfingiz bo‘yicha tez hisob qiling — natija 1–2 daqiqada.`,
      ru: `## Главная идея\n\nСолнечная панель состоит из полупроводниковых элементов. Под действием света в них возникает **постоянный ток (DC)**. Бытовые приборы работают на **переменном токе (AC)**, поэтому в системе есть **инвертор**, который преобразует DC в 220 В AC.\n\n## Из чего состоит система\n\n- **Панели** — на крыше или на земле; больше всего вырабатывают при ориентации на юг.\n- **Инвертор** — DC → AC, учёт выработки.\n- **Аккумулятор** (по желанию) — чтобы использовать дневной излишек вечером или при отключении сети.\n- **Защита и кабели** — автоматы, заземление, кабель-каналы.\n\n## Когда и сколько вырабатывает\n\nВыработка зависит от высоты солнца, погоды, тени и температуры: летом больше, зимой меньше, максимум в полдень. Наш калькулятор считает каждый час и показывает прогноз по месяцам.\n\n## Следующий шаг\n\nСделайте быстрый расчёт по адресу и месячному потреблению — результат за 1–2 минуты.`,
    },
  },
  {
    slug: 'tizim-turlari', type: 'GUIDE', cat: 'asoslar', beginner: 2, cta: 'CALCULATOR',
    title: { uz: 'Tarmoqqa ulangan, gibrid yoki avtonom: qaysi biri sizga mos', ru: 'Сетевая, гибридная или автономная: какая система подходит вам' },
    summary: { uz: 'Uch turdagi tizimning farqi, narxi va elektr o‘chganda nima bo‘lishi.', ru: 'Чем отличаются три типа систем, сколько стоят и что происходит при отключении электричества.' },
    body: {
      uz: `## Tarmoqqa ulangan (on-grid)\n\nAkkumulyatorsiz, eng arzon variant. Kunduzi panellar uyni ta’minlaydi, yetmasa tarmoqdan olinadi. **Muhim:** elektr o‘chganda xavfsizlik uchun invertor ham o‘chadi — zaxira bermaydi.\n\n## Gibrid\n\nTarmoq + akkumulyator. Kunduzgi ortiqcha energiya akkumulyatorga yig‘iladi, kechqurun yoki uzilishda ishlatiladi. Narxi yuqoriroq, lekin uzilishlar ko‘p bo‘lgan joyda qulay.\n\n## Avtonom (off-grid)\n\nTarmoq yo‘q joylar uchun: dala hovli, ferma, uzoq obyektlar. Akkumulyator hajmi katta bo‘lishi kerak, chunki qish kunlari ham hisobga olinadi.\n\n## Qanday tanlash\n\n| Holat | Tavsiya |\n|---|---|\n| Asosiy maqsad — to‘lovni kamaytirish | Tarmoqqa ulangan |\n| Uzilishlar tez-tez bo‘ladi | Gibrid |\n| Tarmoq yo‘q | Avtonom |\n\nKalkulyatorda tizim turini almashtirib, narx va zaxira vaqtini solishtiring.`,
      ru: `## Сетевая (on-grid)\n\nБез аккумулятора, самый дешёвый вариант. Днём панели питают дом, недостающее берётся из сети. **Важно:** при отключении сети инвертор тоже отключается из соображений безопасности — резерва нет.\n\n## Гибридная\n\nСеть + аккумулятор. Дневной излишек заряжает аккумулятор и используется вечером или при отключении. Дороже, но удобно там, где отключения частые.\n\n## Автономная (off-grid)\n\nДля мест без сети: дача, ферма, удалённые объекты. Нужен большой аккумулятор с учётом зимних дней.\n\n## Как выбрать\n\n| Ситуация | Рекомендация |\n|---|---|\n| Главная цель — снизить счёт | Сетевая |\n| Частые отключения | Гибридная |\n| Сети нет | Автономная |\n\nВ калькуляторе меняйте тип системы и сравнивайте цену и время резерва.`,
    },
  },
  {
    slug: 'qancha-quvvat-kerak', type: 'GUIDE', cat: 'asoslar', beginner: 3, cta: 'CALCULATOR',
    title: { uz: 'Uyingizga qancha quvvat kerak', ru: 'Какая мощность нужна вашему дому' },
    summary: { uz: 'Oylik kWh, tom maydoni va tarif bo‘yicha tizim hajmini qanday tanlash.', ru: 'Как выбрать размер системы по месячным кВт·ч, площади крыши и тарифу.' },
    body: {
      uz: `## 1. Sarfingizni biling\n\nElektr hisobingizdagi **oylik kWh** ni oling. Bir necha oylik ma’lumot bo‘lsa yaxshiroq — qish va yozda farq katta. Bilmasangiz, kalkulyatordagi maishiy texnika ro‘yxatidan foydalaning.\n\n## 2. Tom maydoni chegarasi\n\nBitta zamonaviy panel taxminan 2–2,6 m² joy egallaydi. Xaritada tomingizni chizsangiz, kalkulyator foydali maydonni va sig‘adigan panellar sonini hisoblaydi.\n\n## 3. Uch variant\n\nKalkulyator har doim uch variant beradi: **tejamkor**, **muvozanatli** va **maksimal**. Cheklovchi omil (maydon, sarf, tarmoq limiti yoki byudjet) ham ko‘rsatiladi.\n\n## 4. Ortiqcha quvvat foydalimi?\n\nAgar ortiqcha energiyani tarmoqqa berish qoidasi tasdiqlanmagan bo‘lsa, sarfdan ancha katta tizim o‘zini sekinroq oqlaydi. Natija sahifasida bu alohida ko‘rsatiladi.`,
      ru: `## 1. Узнайте потребление\n\nВозьмите **месячные кВт·ч** из счёта за электричество. Лучше данные за несколько месяцев — зимой и летом разница большая. Если не знаете, используйте список бытовой техники в калькуляторе.\n\n## 2. Ограничение площади крыши\n\nОдна современная панель занимает примерно 2–2,6 м². Нарисуйте крышу на карте — калькулятор посчитает полезную площадь и сколько панелей поместится.\n\n## 3. Три варианта\n\nКалькулятор всегда даёт три варианта: **экономный**, **сбалансированный** и **максимальный** и показывает ограничивающий фактор (площадь, потребление, лимит сети или бюджет).\n\n## 4. Выгодна ли лишняя мощность?\n\nЕсли правило продажи излишков в сеть не подтверждено, система намного больше потребления окупается медленнее. На странице результата это показано отдельно.`,
    },
  },
  {
    slug: 'taklifni-qanday-tanlash', type: 'GUIDE', cat: 'takliflar-va-montaj', beginner: 4, cta: 'SHOPS',
    title: { uz: 'Do‘kon takliflarini qanday solishtirish va tanlash', ru: 'Как сравнить и выбрать предложения магазинов' },
    summary: { uz: 'Narxdan tashqari nimalarga qarash kerak: 1 kVt narxi, kafolat, muddat va nimalar kiradi.', ru: 'На что смотреть кроме цены: цена за 1 кВт, гарантия, сроки и что входит.' },
    body: {
      uz: `## Bitta so‘rov — bir nechta taklif\n\nPlatformada bitta so‘rov bilan 5 tagacha do‘kondan taklif olasiz. Kontaktingiz siz ruxsat bermaguncha ochilmaydi.\n\n## Nimalarga qarash kerak\n\n1. **1 kVt narxi** — turli quvvatdagi takliflarni teng solishtirish uchun.\n2. **Kafolat** — uskuna va montaj kafolati alohida yoziladi.\n3. **Montaj muddati** va **amal qilish muddati**.\n4. **Nimalar kiradi va kirmaydi** — konstruksiya, kabellar, hisoblagich, tomni ta’mirlash.\n5. **Do‘kon reytingi** — faqat tasdiqlangan montajlardan keyingi sharhlar asosida.\n\n## Solishtirish sahifasi\n\n«Eng arzon (1 kVt uchun)», «Eng uzoq kafolat», «Eng tez montaj» belgilari faqat haqiqiy taqqoslashdan beriladi. O‘zini oqlash muddati sizning hisobingiz bo‘yicha, taklif narxi bilan qayta hisoblanadi.\n\n## Tanlash nima degani\n\nTaklifni tanlash — shartnoma yoki to‘lov emas. Keyingi qadamlarni do‘kon bilan kelishasiz.`,
      ru: `## Одна заявка — несколько предложений\n\nПо одной заявке вы получаете предложения от 5 магазинов. Ваш контакт не открывается, пока вы не разрешите.\n\n## На что смотреть\n\n1. **Цена за 1 кВт** — чтобы честно сравнить предложения разной мощности.\n2. **Гарантия** — на оборудование и монтаж указывается отдельно.\n3. **Срок монтажа** и **срок действия** предложения.\n4. **Что входит и не входит** — конструкция, кабели, счётчик, ремонт крыши.\n5. **Рейтинг магазина** — только по отзывам после подтверждённых монтажей.\n\n## Страница сравнения\n\nМетки «Самое дешёвое (за 1 кВт)», «Самая долгая гарантия», «Самый быстрый монтаж» ставятся только по реальному сравнению. Окупаемость пересчитывается по вашему расчёту с ценой предложения.\n\n## Что значит «выбрать»\n\nВыбор предложения — не договор и не оплата. Дальнейшие шаги вы согласуете с магазином.`,
    },
  },
  {
    slug: 'montajni-qabul-qilish', type: 'GUIDE', cat: 'takliflar-va-montaj', beginner: 5,
    title: { uz: 'Montajni qanday qabul qilish: chek-list', ru: 'Как принять монтаж: чек-лист' },
    summary: { uz: 'Do‘kon «montaj bajarildi» deganda nimalarni tekshirish kerak.', ru: 'Что проверить, когда магазин сообщил о завершении монтажа.' },
    body: {
      uz: `## Nima uchun chek-list\n\nMontajni qabul qilish chek-listsiz tasdiqlanmaydi. Bu sizni ham, halol do‘konni ham himoya qiladi.\n\n## Asosiy bandlar\n\n- Panellar mahkam o‘rnatilgan, ramkada shikast yo‘q.\n- Invertor yoqilgan va ishlab chiqarishni ko‘rsatmoqda — **ekran rasmini yuklang**.\n- Yerga ulash bajarilgan.\n- DC va AC tomonida himoya avtomatlari o‘rnatilgan va belgilangan.\n- Kabellar himoya qutisi yoki gofra ichida.\n- Akkumulyator (bo‘lsa) shamollatiladigan joyda.\n- Sizga yoqish/o‘chirish va favqulodda o‘chirish ko‘rsatildi.\n- Kafolat hujjatlari topshirildi, ish joyi tozalandi.\n\n## Muammo bo‘lsa\n\n«Muammo bor» deb belgilang va izoh yozing. Keyin: baribir qabul qilish, do‘kondan tuzatishni so‘rash yoki e’tiroz bildirish (admin ko‘rib chiqadi).`,
      ru: `## Зачем чек-лист\n\nМонтаж нельзя принять без чек-листа. Это защищает и вас, и добросовестный магазин.\n\n## Основные пункты\n\n- Панели надёжно закреплены, рамы без повреждений.\n- Инвертор включён и показывает выработку — **загрузите фото экрана**.\n- Выполнено заземление.\n- Защитные автоматы на стороне DC и AC установлены и подписаны.\n- Кабели в коробах или гофре.\n- Аккумулятор (если есть) в проветриваемом месте.\n- Вам показали включение/выключение и аварийное отключение.\n- Переданы гарантийные документы, рабочее место убрано.\n\n## Если есть проблема\n\nОтметьте «Есть проблема» и опишите. Далее: всё равно принять, попросить магазин исправить или оспорить (рассмотрит администратор).`,
    },
  },
  {
    slug: 'tom-yonalishi-va-soya', type: 'ARTICLE', cat: 'tom-va-joylashuv', cta: 'CALCULATOR', sources: [PVGIS],
    title: { uz: 'Tom yo‘nalishi, qiyaligi va soya', ru: 'Ориентация, наклон крыши и тень' },
    summary: { uz: 'Janub, sharq yoki g‘arb — ishlab chiqarishga qanday ta’sir qiladi.', ru: 'Юг, восток или запад — как это влияет на выработку.' },
    body: {
      uz: `## Yo‘nalish\n\nO‘zbekistonda eng ko‘p ishlab chiqarish janubga qaragan panellardan olinadi. Sharq yoki g‘arb yo‘nalishi odatda yillik ishlab chiqarishni bir necha o‘n foizgacha kamaytiradi, lekin ertalabki yoki kechki sarfga yaxshiroq mos keladi.\n\n## Qiyalik\n\nYillik maksimal uchun qiyalik kenglikka yaqin bo‘ladi (taxminan 30–40°). Tekis tomda panellar ramkaga o‘rnatiladi — qatorlar orasida soya qolmasligi uchun masofa kerak.\n\n## Soya\n\nDaraxt, mo‘ri yoki qo‘shni bino soyasi butun qatorni pasaytirishi mumkin. Kalkulyatorda soya darajasini belgilang; o‘lchovda do‘kon aniq tekshiradi.\n\n## Ma’lumot manbasi\n\nHisoblash PVGIS (Yevropa Komissiyasi JRC) yoki NASA POWER soatlik ma’lumotlariga asoslanadi.`,
      ru: `## Ориентация\n\nВ Узбекистане больше всего вырабатывают панели, обращённые на юг. Восток или запад обычно снижают годовую выработку на несколько десятков процентов, но лучше подходят под утреннее или вечернее потребление.\n\n## Наклон\n\nДля годового максимума наклон близок к широте (около 30–40°). На плоской крыше панели ставят на каркас — между рядами нужен промежуток, чтобы не было тени.\n\n## Тень\n\nТень от дерева, трубы или соседнего здания может снизить выработку целого ряда. Укажите уровень затенения в калькуляторе; на замере магазин проверит точно.\n\n## Источник данных\n\nРасчёт основан на почасовых данных PVGIS (JRC Еврокомиссии) или NASA POWER.`,
    },
  },
  {
    slug: 'akkumulyator-tanlash', type: 'ARTICLE', cat: 'tizim-va-uskunalar', cta: 'OUTAGE',
    title: { uz: 'Akkumulyatorni qanday tanlash', ru: 'Как выбрать аккумулятор' },
    summary: { uz: 'LiFePO4 va qo‘rg‘oshin-kislota, foydali sig‘im (DoD) va sikllar soni.', ru: 'LiFePO4 и свинцово-кислотные, полезная ёмкость (DoD) и количество циклов.' },
    body: {
      uz: `## Kimyo turi\n\n- **LiFePO4 (litiy-temir-fosfat)** — uzoq xizmat (minglab sikl), chuqur zaryadsizlanishga chidamli, xavfsiz. Boshlang‘ich narxi yuqori.\n- **Qo‘rg‘oshin-kislota (AGM/GEL)** — arzon, lekin sikllari kam va foydali sig‘imi past.\n\n## Foydali sig‘im\n\nAkkumulyator yorlig‘idagi kWh to‘liq ishlatilmaydi. **DoD** (zaryadsizlanish chuqurligi) qancha foydalanish mumkinligini ko‘rsatadi: masalan, 10 kWh × 90 % = 9 kWh.\n\n## Qancha kerak\n\nKechki sarf yoki uzilish vaqtidagi zarur yuklama bo‘yicha hisoblang. Elektr o‘chganda kalkulyatori muzlatkich, yoritish, router kabi muhim jihozlar uchun zaxira soatini ko‘rsatadi.\n\n## Moslik\n\nAkkumulyator kuchlanishi va kimyosi invertor bilan mos bo‘lishi shart — taklifdagi moslik belgisi buni tekshiradi.`,
      ru: `## Тип химии\n\n- **LiFePO4 (литий-железо-фосфат)** — долгий срок (тысячи циклов), выдерживает глубокий разряд, безопасен. Выше начальная цена.\n- **Свинцово-кислотные (AGM/GEL)** — дешевле, но меньше циклов и ниже полезная ёмкость.\n\n## Полезная ёмкость\n\nкВт·ч на этикетке нельзя использовать полностью. **DoD** (глубина разряда) показывает, сколько доступно: например, 10 кВт·ч × 90 % = 9 кВт·ч.\n\n## Сколько нужно\n\nСчитайте по вечернему потреблению или нужной нагрузке при отключении. Калькулятор отключений показывает часы резерва для холодильника, освещения, роутера и т.п.\n\n## Совместимость\n\nНапряжение и химия аккумулятора должны подходить инвертору — метка совместимости в предложении это проверяет.`,
    },
  },
  {
    slug: 'invertor-tanlash', type: 'ARTICLE', cat: 'tizim-va-uskunalar',
    title: { uz: 'Invertorni qanday tanlash', ru: 'Как выбрать инвертор' },
    summary: { uz: 'Quvvat nisbati, MPPT kuchlanishi va gibrid funksiyalar.', ru: 'Соотношение мощностей, напряжение MPPT и гибридные функции.' },
    body: {
      uz: `## Quvvat\n\nInvertorning AC quvvati odatda panellar quvvatidan biroz kichik yoki teng tanlanadi (DC/AC nisbati taxminan 1,0–1,3). Juda kichik invertor kunduzi «kesish» (clipping) yo‘qotishlarini oshiradi.\n\n## Kuchlanish oynasi\n\nKetma-ket ulangan panellar kuchlanishi sovuq kunda ham invertorning maksimal DC kuchlanishidan oshmasligi, issiqda esa MPPT oynasidan pastga tushmasligi kerak. Taklif builderidagi moslik tekshiruvi buni hisoblaydi.\n\n## Gibrid invertor\n\nAkkumulyator va zaxira chiqishi (uzilishda ishlash) kerak bo‘lsa, gibrid invertor tanlanadi.\n\n## Monitoring\n\nIlova yoki Wi‑Fi orqali ishlab chiqarishni ko‘rish oylik ko‘rsatkichni kiritishni osonlashtiradi.`,
      ru: `## Мощность\n\nAC-мощность инвертора обычно немного меньше или равна мощности панелей (соотношение DC/AC около 1,0–1,3). Слишком маленький инвертор увеличивает потери на «срезку» (clipping) днём.\n\n## Окно напряжений\n\nНапряжение последовательно соединённых панелей в холод не должно превышать максимум DC инвертора, а в жару — опускаться ниже окна MPPT. Проверка совместимости в конструкторе предложения это считает.\n\n## Гибридный инвертор\n\nЕсли нужен аккумулятор и резервный выход (работа при отключении), выбирают гибридный инвертор.\n\n## Мониторинг\n\nПриложение или Wi‑Fi для просмотра выработки упрощает ввод месячных показаний.`,
    },
  },
  {
    slug: 'tarif-va-tejash', type: 'ARTICLE', cat: 'pul-va-tarif', cta: 'CALCULATOR',
    title: { uz: 'Pog‘onali tarif va quyosh qancha tejaydi', ru: 'Ступенчатый тариф и сколько экономит солнце' },
    summary: { uz: 'Nima uchun tejash pog‘ona chegaralariga bog‘liq va kalkulyator buni qanday hisoblaydi.', ru: 'Почему экономия зависит от ступеней тарифа и как это считает калькулятор.' },
    body: {
      uz: `## Pog‘onali tarif\n\nMaishiy iste’molchilar uchun tarif ko‘pincha pog‘onali: oylik sarfning ma’lum qismi bir narxda, undan ortig‘i qimmatroq. Quyosh energiyasi avval **eng qimmat pog‘onadagi** kWh ni qisqartiradi — shuning uchun tejash oddiy «kWh × narx» dan farq qiladi.\n\n## Kalkulyator qanday hisoblaydi\n\n1. Har soatlik iste’mol va ishlab chiqarish solishtiriladi.\n2. Tarmoqdan olingan kWh har oy uchun pog‘onalar bo‘yicha hisoblanadi.\n3. Quyoshsiz va quyosh bilan oylik to‘lov farqi — tejash.\n\n## Tarif manbasi\n\nTariflar admin tomonidan rasmiy manba va kuchga kirish sanasi bilan kiritiladi. Hududingiz uchun tarif topilmasa, kalkulyator narxni o‘ylab topmaydi va moliyaviy natijalarni ko‘rsatmaydi.`,
      ru: `## Ступенчатый тариф\n\nДля бытовых потребителей тариф часто ступенчатый: часть месячного потребления по одной цене, сверх — дороже. Солнечная энергия в первую очередь сокращает кВт·ч на **самой дорогой ступени** — поэтому экономия отличается от простого «кВт·ч × цена».\n\n## Как считает калькулятор\n\n1. Почасово сравниваются потребление и выработка.\n2. Взятые из сети кВт·ч считаются по ступеням за каждый месяц.\n3. Разница счетов без солнца и с солнцем — экономия.\n\n## Источник тарифа\n\nТарифы вносит администратор с официальным источником и датой вступления в силу. Если для вашего региона тарифа нет, калькулятор не выдумывает цену и не показывает финансовые результаты.`,
    },
  },
  {
    slug: 'tarmoqqa-energiya-berish', type: 'ARTICLE', cat: 'pul-va-tarif', cta: 'CALCULATOR',
    title: { uz: 'Ortiqcha energiyani tarmoqqa berish', ru: 'Отдача излишков энергии в сеть' },
    summary: { uz: 'Eksport qoidalari, hisoblagich va nima uchun kalkulyator ba’zan daromadni ko‘rsatmaydi.', ru: 'Правила экспорта, счётчик и почему калькулятор иногда не показывает доход.' },
    body: {
      uz: `## Qanday ishlaydi\n\nKunduzi panellar uy sarfidan ko‘p ishlab chiqarsa, ortig‘i tarmoqqa chiqadi. Bunga ikki tomonlama hisoblagich va energiya ta’minoti tashkiloti bilan kelishuv kerak.\n\n## Kompensatsiya turlari\n\n- **Net metering** — berilgan kWh keyingi oylardagi sarfdan chegiriladi.\n- **Sotish narxi** — berilgan kWh belgilangan narxda to‘lanadi.\n- **Kompensatsiya yo‘q** — energiya chiqadi, lekin pul olinmaydi.\n\n## Kalkulyatorda\n\nEksport qoidasi admin tomonidan manba bilan **tasdiqlangan** bo‘lsagina eksport daromadi pul sifatida ko‘rsatiladi. Aks holda eksport kWh ko‘rinadi, lekin daromad hisoblanmaydi — bu ataylab ehtiyotkorlik.\n\n## Tarmoq limiti\n\nUlanish quvvati chegarasi bo‘lishi mumkin; kalkulyator buni cheklovchi omil sifatida ko‘rsatadi.`,
      ru: `## Как это работает\n\nЕсли днём панели вырабатывают больше, чем потребляет дом, излишек уходит в сеть. Для этого нужен двунаправленный счётчик и согласование с энергоснабжающей организацией.\n\n## Виды компенсации\n\n- **Net metering** — отданные кВт·ч вычитаются из потребления в следующие месяцы.\n- **Цена продажи** — отданные кВт·ч оплачиваются по установленной цене.\n- **Без компенсации** — энергия уходит, но денег нет.\n\n## В калькуляторе\n\nДоход от экспорта показывается в деньгах только если правило **подтверждено** администратором с источником. Иначе виден экспорт в кВт·ч, но доход не считается — это намеренная осторожность.\n\n## Лимит сети\n\nМожет быть ограничение мощности подключения; калькулятор покажет его как ограничивающий фактор.`,
    },
  },
  {
    slug: 'kredit-va-bolib-tolash', type: 'ARTICLE', cat: 'pul-va-tarif', cta: 'FINANCING',
    title: { uz: 'Kredit va bo‘lib to‘lash: oylik to‘lov va «cho‘ntakdan» summa', ru: 'Кредит и рассрочка: ежемесячный платёж и сумма «из кармана»' },
    summary: { uz: 'Annuitet va differensial to‘lov, ortiqcha to‘lov va tejash bilan taqqoslash.', ru: 'Аннуитет и дифференцированный платёж, переплата и сравнение с экономией.' },
    body: {
      uz: `## To‘lov turlari\n\n- **Annuitet** — har oy bir xil to‘lov.\n- **Differensial** — boshida katta, keyin kamayib boradi.\n\n## Nimalarni solishtiring\n\n1. **Oylik to‘lov** va **ortiqcha to‘lov** (foizlar + komissiyalar).\n2. **Cho‘ntakdan summa** — oylik to‘lov minus o‘sha oydagi tejash. Manfiy bo‘lsa, tizim kreditni o‘zi qoplaydi.\n3. **O‘zini moliyalash muddati** — tejash yig‘indisi to‘lovlarni qoplaydigan oy.\n\n## Eslatma\n\nKredit kalkulyatori taxminiy: yakuniy stavka, komissiya va shartlarni bank yoki sotuvchi belgilaydi. Mahsulot ma’lumotlari manba va tekshirilgan sana bilan ko‘rsatiladi.`,
      ru: `## Виды платежей\n\n- **Аннуитет** — одинаковый платёж каждый месяц.\n- **Дифференцированный** — сначала больше, потом уменьшается.\n\n## Что сравнивать\n\n1. **Ежемесячный платёж** и **переплату** (проценты + комиссии).\n2. **Сумму из кармана** — платёж минус экономия в этом месяце. Если отрицательная, система сама покрывает кредит.\n3. **Срок самофинансирования** — месяц, когда накопленная экономия покрывает платежи.\n\n## Важно\n\nКредитный калькулятор ориентировочный: окончательную ставку, комиссии и условия определяет банк или продавец. Данные продуктов показаны с источником и датой проверки.`,
    },
  },
  {
    slug: 'elektr-ochganda-zaxira', type: 'ARTICLE', cat: 'tizim-va-uskunalar', cta: 'OUTAGE',
    title: { uz: 'Elektr o‘chganda: zaxira qancha yetadi', ru: 'При отключении электричества: на сколько хватит резерва' },
    summary: { uz: 'Muhim yuklamani hisoblash va nima uchun on-grid tizim zaxira bermaydi.', ru: 'Как посчитать важную нагрузку и почему сетевая система не даёт резерва.' },
    body: {
      uz: `## On-grid zaxira bermaydi\n\nTarmoqqa ulangan invertor elektr o‘chganda o‘chadi — bu ta’mirlovchilar xavfsizligi uchun talab. Zaxira uchun gibrid invertor va akkumulyator kerak.\n\n## Muhim yuklama\n\nUzilishda faqat zarur jihozlarni qoldiring: muzlatkich, yoritish, router, nasos, isitish qozonining nasosi. Har birining quvvati (Vt) va kunlik ishlash soatini kalkulyatorga kiriting.\n\n## Hisob\n\nZaxira soati ≈ akkumulyatorning foydali sig‘imi ÷ muhim yuklama quvvati. Kunduzi panellar akkumulyatorni zaryadlay oladi, shuning uchun kunduzgi va tungi zaxira alohida ko‘rsatiladi.\n\n## Motorli jihozlar\n\nNasos va konditsioner ishga tushganda bir necha barobar ko‘p tok oladi — invertor bu cho‘qqiga chidashi kerak.`,
      ru: `## Сетевая система не даёт резерва\n\nСетевой инвертор отключается при пропадании сети — это требование безопасности ремонтников. Для резерва нужен гибридный инвертор и аккумулятор.\n\n## Важная нагрузка\n\nПри отключении оставьте только нужное: холодильник, освещение, роутер, насос, насос котла. Введите мощность (Вт) и часы работы каждого прибора в калькулятор.\n\n## Расчёт\n\nЧасы резерва ≈ полезная ёмкость аккумулятора ÷ мощность важной нагрузки. Днём панели могут подзаряжать аккумулятор, поэтому дневной и ночной резерв показаны отдельно.\n\n## Приборы с мотором\n\nНасос и кондиционер при пуске потребляют в несколько раз больше тока — инвертор должен выдерживать этот пик.`,
    },
  },
  {
    slug: 'panellarni-tozalash', type: 'ARTICLE', cat: 'xizmat-korsatish',
    title: { uz: 'Panellarni qachon va qanday tozalash', ru: 'Когда и как мыть панели' },
    summary: { uz: 'Chang ishlab chiqarishni kamaytiradi: xavfsiz tozalash qoidalari.', ru: 'Пыль снижает выработку: правила безопасной мойки.' },
    body: {
      uz: `## Nega muhim\n\nChang va qum, ayniqsa yomg‘irsiz oylarda, ishlab chiqarishni sezilarli kamaytiradi. Platforma har 90 kunda tozalash eslatmasini yuboradi.\n\n## Qanday tozalash\n\n- Ertalab yoki kechqurun, panellar sovuq bo‘lganda.\n- Yumshoq cho‘tka va toza suv; abraziv va kuchli kimyoviy vositalar ishlatmang.\n- Yuqori bosimli yuvgich ramka zichlagichlariga zarar yetkazishi mumkin.\n- Tomga chiqishda xavfsizlik — birinchi o‘rinda; baland tomlar uchun mutaxassis chaqiring.\n\n## Natijani tekshiring\n\nTozalashdan keyingi oyda ishlab chiqarish ko‘rsatkichini kiriting — prognozga yaqinlashganini ko‘rasiz.`,
      ru: `## Почему важно\n\nПыль и песок, особенно в месяцы без дождей, заметно снижают выработку. Платформа присылает напоминание о мойке каждые 90 дней.\n\n## Как мыть\n\n- Утром или вечером, пока панели холодные.\n- Мягкая щётка и чистая вода; без абразивов и агрессивной химии.\n- Мойка высокого давления может повредить уплотнители рамы.\n- Безопасность на крыше — прежде всего; для высоких крыш вызовите специалиста.\n\n## Проверьте результат\n\nВведите показатель выработки за следующий месяц — увидите, как он приблизился к прогнозу.`,
    },
  },
  {
    slug: 'kafolatlar', type: 'ARTICLE', cat: 'xizmat-korsatish',
    title: { uz: 'Kafolatlar: uskuna, montaj va ishlab chiqarish', ru: 'Гарантии: оборудование, монтаж и выработка' },
    summary: { uz: 'Qanday kafolatlar bor va muddati tugashini qanday kuzatish.', ru: 'Какие бывают гарантии и как следить за их сроками.' },
    body: {
      uz: `## Turlari\n\n- **Uskuna kafolati** — ishlab chiqaruvchi beradi (panel, invertor, akkumulyator alohida).\n- **Ishlab chiqarish kafolati** — panel quvvati yillar davomida belgilangan foizdan pastga tushmasligi.\n- **Montaj kafolati** — do‘kon beradi: mahkamlash, ulanishlar, tom germetikligi.\n\n## Platformada\n\nTaklifda uskuna va montaj kafolati alohida yoziladi. Montaj qabul qilingach, «O‘rnatilgan tizim» kartasida har komponent kafolati va qolgan muddat ko‘rinadi; tugashiga 60 kun qolganda eslatma keladi.\n\n## Hujjatlar\n\nKafolat talonlari, seriya raqamlari va chek-list natijasini saqlang — murojaatda kerak bo‘ladi.`,
      ru: `## Виды\n\n- **Гарантия на оборудование** — от производителя (панели, инвертор, аккумулятор отдельно).\n- **Гарантия выработки** — мощность панели с годами не опустится ниже заявленного процента.\n- **Гарантия на монтаж** — от магазина: крепления, соединения, герметичность крыши.\n\n## На платформе\n\nВ предложении гарантии на оборудование и монтаж указаны отдельно. После приёмки в карточке «Установленная система» видны гарантии компонентов и оставшийся срок; за 60 дней до окончания придёт напоминание.\n\n## Документы\n\nСохраните гарантийные талоны, серийные номера и результат чек-листа — они понадобятся при обращении.`,
    },
  },
  {
    slug: 'ishlab-chiqarish-kamaysa', type: 'ARTICLE', cat: 'xizmat-korsatish',
    title: { uz: 'Ishlab chiqarish prognozdan kam bo‘lsa nima qilish', ru: 'Что делать, если выработка ниже прогноза' },
    summary: { uz: '20 % dan ko‘p farqning odatiy sabablari va tekshirish tartibi.', ru: 'Типичные причины отклонения более 20 % и порядок проверки.' },
    body: {
      uz: `## Prognoz bilan taqqoslash\n\nHar oy ishlab chiqarilgan kWh yoki hisoblagich ko‘rsatkichini kiriting. Farq 20 % dan oshsa, kabinetda diqqat kartasi chiqadi.\n\n## Odatiy sabablar\n\n1. **Chang** — eng ko‘p uchraydi; tozalang.\n2. **Yangi soya** — o‘sgan daraxt, yangi qurilish.\n3. **Ob-havo** — bulutli oy prognozdan past bo‘lishi tabiiy.\n4. **Invertor xatosi** — ekrandagi xato kodini tekshiring.\n5. **Ulanish yoki avtomat** — bir qator o‘chib qolgan bo‘lishi mumkin.\n\n## Keyingi qadam\n\nSabab topilmasa, kabinetdagi «Do‘konga yozish» tugmasi orqali montaj qilgan do‘konga murojaat qiling — yozishmaga tizim ma’lumotlari bilan boriladi.`,
      ru: `## Сравнение с прогнозом\n\nКаждый месяц вводите выработанные кВт·ч или показание счётчика. Если отклонение больше 20 %, в кабинете появится карточка внимания.\n\n## Типичные причины\n\n1. **Пыль** — самое частое; помойте панели.\n2. **Новая тень** — выросшее дерево, новая постройка.\n3. **Погода** — пасмурный месяц естественно ниже прогноза.\n4. **Ошибка инвертора** — проверьте код ошибки на экране.\n5. **Соединение или автомат** — мог отключиться один ряд.\n\n## Следующий шаг\n\nЕсли причина не найдена, напишите магазину-установщику кнопкой «Написать магазину» в кабинете.`,
    },
  },
  {
    slug: 'kalkulyator-qanchalik-aniq', type: 'FAQ', cat: 'platforma', sources: [PVGIS, NASA],
    title: { uz: 'Kalkulyator natijasi qanchalik aniq?', ru: 'Насколько точен результат калькулятора?' },
    summary: { uz: 'Prognoz, diapazon va ma’lumot manbalari haqida.', ru: 'О прогнозе, диапазоне и источниках данных.' },
    body: {
      uz: `Natija — **prognoz**. Ishlab chiqarish PVGIS yoki NASA POWER soatlik quyosh ma’lumotlari bo‘yicha hisoblanadi; ular bo‘lmasa viloyat o‘rtachasi ishlatiladi va bu ochiq yoziladi. Natija sahifasida past va yuqori ssenariy diapazoni, ishlatilgan tarif, model versiyasi va taxminlar ko‘rsatiladi. Aniq narx va loyiha — do‘kon o‘lchovidan keyin taklifda.`,
      ru: `Результат — **прогноз**. Выработка считается по почасовым солнечным данным PVGIS или NASA POWER; если их нет, используется среднее по области, и это указано открыто. На странице результата показаны диапазон пессимистичного и оптимистичного сценария, использованный тариф, версия модели и допущения. Точная цена и проект — в предложении магазина после замера.`,
    },
  },
  {
    slug: 'kontakt-qachon-ochiladi', type: 'FAQ', cat: 'platforma',
    title: { uz: 'Telefonim va manzilim do‘konga qachon ko‘rinadi?', ru: 'Когда магазин увидит мой телефон и адрес?' },
    summary: { uz: 'Kontakt siyosati: siz ruxsat bermaguncha do‘kon faqat hudud va parametrlarni ko‘radi.', ru: 'Политика контактов: до вашего разрешения магазин видит только регион и параметры.' },
    body: {
      uz: `So‘rov yuborilganda do‘kon faqat **ismingiz, tuman, tizim parametrlari va hisob xulosasini** ko‘radi. Telefon, aniq manzil va tom chizmasi uch holatda ochiladi: «Kontaktni ochish» tugmasini bossangiz, o‘lchov uchrashuvini tasdiqlasangiz yoki taklifni tanlasangiz. Yozishma kontakt ochilmasdan ham ishlaydi.`,
      ru: `При отправке заявки магазин видит только **ваше имя, район, параметры системы и итоги расчёта**. Телефон, точный адрес и схема крыши открываются в трёх случаях: если вы нажмёте «Открыть контакт», подтвердите замер или выберете предложение. Переписка работает и без открытия контакта.`,
    },
  },
  {
    slug: 'sorov-limitlari', type: 'FAQ', cat: 'platforma',
    title: { uz: 'Nechta so‘rov yuborish mumkin?', ru: 'Сколько заявок можно отправить?' },
    summary: { uz: 'Bir so‘rovga 1–5 do‘kon, bir vaqtda 3 ochiq so‘rov, kuniga 5 ta.', ru: '1–5 магазинов на заявку, 3 открытые заявки одновременно, 5 в день.' },
    body: {
      uz: `Bitta so‘rovga 1 tadan 5 tagacha do‘kon tanlanadi (keyin ham qo‘shish mumkin, jami 5 gacha). Bir vaqtda ko‘pi bilan **3 ta ochiq so‘rov** va kuniga **5 ta yangi so‘rov**. Cheklov spam va do‘konlar vaqtini himoya qiladi. Ochiq so‘rovni yopsangiz, yangisini yubora olasiz.`,
      ru: `В одну заявку выбирается от 1 до 5 магазинов (можно добавить позже, всего до 5). Одновременно не более **3 открытых заявок** и **5 новых в день**. Ограничение защищает от спама и бережёт время магазинов. Закройте открытую заявку, чтобы отправить новую.`,
    },
  },
  {
    slug: 'sharh-qachon-chiqadi', type: 'FAQ', cat: 'platforma',
    title: { uz: 'Sharhim nega darhol chiqmadi?', ru: 'Почему мой отзыв не опубликован сразу?' },
    summary: { uz: 'Sharhlar faqat tasdiqlangan montajdan keyin; ba’zilari tekshiruvga tushadi.', ru: 'Отзывы только после подтверждённого монтажа; некоторые проходят проверку.' },
    body: {
      uz: `Sharh faqat montajni chek-list orqali qabul qilgan mijoz tomonidan yoziladi — bitta montajga bitta sharh. Soxta sharhlarga qarshi avtomatik qoidalar bor: matnda telefon yoki havola, juda tez tasdiqlash va boshqa belgilar bo‘lsa sharh moderatsiyaga tushadi va tekshiruvdan keyin chiqadi. Reyting faqat e’lon qilingan sharhlardan hisoblanadi.`,
      ru: `Отзыв может написать только клиент, принявший монтаж по чек-листу, — один отзыв на один монтаж. Есть автоматические правила против фейков: если в тексте телефон или ссылка, монтаж подтверждён слишком быстро и т.п., отзыв уходит на модерацию и появляется после проверки. Рейтинг считается только по опубликованным отзывам.`,
    },
  },
  {
    slug: 'hisobni-ochirish', type: 'FAQ', cat: 'platforma',
    title: { uz: 'Hisobimni qanday o‘chiraman?', ru: 'Как удалить аккаунт?' },
    summary: { uz: '14 kunlik bekor qilish oralig‘i va qaysi ma’lumotlar o‘chiriladi.', ru: '14 дней на отмену и какие данные удаляются.' },
    body: {
      uz: `Sozlamalar → «Hisobni o‘chirish». So‘rovdan keyin barcha sessiyalar yopiladi va ochiq so‘rovlar bekor qilinadi. **14 kun** ichida qayta kirib o‘chirishni bekor qilishingiz mumkin. Keyin ism, telefon, email, obyektlar (manzil va tom chizmasi), hisoblar va yozishma matnlari o‘chiriladi; taklif, montaj va sharh yozuvlari statistika uchun anonim holda qoladi. Do‘kon egasi avval egalikni topshirishi kerak.`,
      ru: `Настройки → «Удалить аккаунт». После запроса все сеансы закрываются, открытые заявки отменяются. В течение **14 дней** можно войти снова и отменить удаление. Затем удаляются имя, телефон, email, объекты (адрес и схема крыши), расчёты и тексты переписки; записи о предложениях, монтажах и отзывах остаются анонимно для статистики. Владелец магазина должен сначала передать владение.`,
    },
  },
  {
    slug: 'kvt-va-kvt-soat', type: 'GLOSSARY', cat: 'atamalar',
    title: { uz: 'kVt va kVt·soat', ru: 'кВт и кВт·ч' },
    summary: { uz: 'Quvvat va energiya farqi.', ru: 'Разница между мощностью и энергией.' },
    body: {
      uz: `**kVt (kilovatt)** — quvvat, ya’ni bir lahzadagi ish tezligi. Tizim hajmi kVt da (masalan 5 kVt) yoziladi. **kVt·soat (kWh)** — energiya: 1 kVt quvvat 1 soat ishlasa 1 kWh. Elektr hisobi va ishlab chiqarish kWh da o‘lchanadi.`,
      ru: `**кВт (киловатт)** — мощность, то есть скорость работы в данный момент. Размер системы указывают в кВт (например, 5 кВт). **кВт·ч** — энергия: мощность 1 кВт в течение 1 часа = 1 кВт·ч. Счёт за электричество и выработка измеряются в кВт·ч.`,
    },
  },
  {
    slug: 'ozini-oqlash-npv-irr', type: 'GLOSSARY', cat: 'atamalar',
    title: { uz: 'O‘zini oqlash, NPV va IRR', ru: 'Окупаемость, NPV и IRR' },
    summary: { uz: 'Moliyaviy ko‘rsatkichlar oddiy tilda.', ru: 'Финансовые показатели простым языком.' },
    body: {
      uz: `**O‘zini oqlash muddati** — tizim narxi yillik sof foyda (tejash + eksport daromadi − xizmat xarajati) bilan qancha yilda qoplanishi. **NPV (sof joriy qiymat)** — 25 yillik pul oqimlarining bugungi qiymati: musbat bo‘lsa, investitsiya diskont stavkasidan foydaliroq. **IRR (ichki daromadlilik)** — investitsiyaning yillik daromadlilik foizi.`,
      ru: `**Срок окупаемости** — за сколько лет цена системы покрывается чистой годовой выгодой (экономия + доход от экспорта − обслуживание). **NPV (чистая приведённая стоимость)** — сегодняшняя стоимость денежных потоков за 25 лет: если положительна, вложение выгоднее ставки дисконтирования. **IRR (внутренняя норма доходности)** — годовая доходность вложения в процентах.`,
    },
  },
  {
    slug: 'soc-va-dod', type: 'GLOSSARY', cat: 'atamalar',
    title: { uz: 'SOC va DoD', ru: 'SOC и DoD' },
    summary: { uz: 'Akkumulyator zaryad darajasi va zaryadsizlanish chuqurligi.', ru: 'Уровень заряда и глубина разряда аккумулятора.' },
    body: {
      uz: `**SOC (State of Charge)** — akkumulyator zaryad darajasi, foizda. **DoD (Depth of Discharge)** — akkumulyatorni qancha chuqur zaryadsizlantirish mumkinligi. Foydali sig‘im = nominal sig‘im × DoD. Kalkulyator SOC ni ruxsat etilgan chegaradan pastga tushirmaydi.`,
      ru: `**SOC (State of Charge)** — уровень заряда аккумулятора в процентах. **DoD (Depth of Discharge)** — насколько глубоко можно разряжать аккумулятор. Полезная ёмкость = номинальная ёмкость × DoD. Калькулятор не опускает SOC ниже допустимой границы.`,
    },
  },
  {
    slug: 'mppt-va-string', type: 'GLOSSARY', cat: 'atamalar',
    title: { uz: 'MPPT va string (qator)', ru: 'MPPT и стринг' },
    summary: { uz: 'Invertor va panellar ulanishi bilan bog‘liq atamalar.', ru: 'Термины, связанные с подключением панелей к инвертору.' },
    body: {
      uz: `**String (qator)** — ketma-ket ulangan panellar guruhi; ularning kuchlanishi qo‘shiladi. **MPPT** — invertordagi maksimal quvvat nuqtasini kuzatuvchi kontroller: har qatordan eng ko‘p quvvat olish uchun kuchlanish va tokni moslaydi. Har MPPT ning kuchlanish oynasi va maksimal toki bor.`,
      ru: `**Стринг** — группа последовательно соединённых панелей; их напряжения складываются. **MPPT** — контроллер отслеживания точки максимальной мощности в инверторе: подбирает напряжение и ток, чтобы снять максимум с каждого стринга. У каждого MPPT есть окно напряжений и максимальный ток.`,
    },
  },
];

export async function seedKnowledge(prisma: PrismaClient) {
  const catIds = new Map<string, string>();
  for (const [i, c] of CATS.entries()) {
    const row = await prisma.knowledgeCategory.upsert({ where: { slug: c.slug }, update: { nameI18n: c.name, icon: c.icon, sortOrder: i }, create: { slug: c.slug, nameI18n: c.name, icon: c.icon, sortOrder: i } });
    catIds.set(c.slug, row.id);
  }
  const now = new Date();
  for (const a of A) {
    const words = a.body.uz.split(/\s+/).length;
    const data = {
      articleType: a.type, categoryId: catIds.get(a.cat)!, titleI18n: a.title, summaryI18n: a.summary, bodyI18n: a.body,
      searchText: [a.title.uz, a.title.ru, a.summary.uz, a.summary.ru, a.body.uz, a.body.ru, ...(a.tags ?? [])].join(' \n '),
      ctaType: a.cta ?? 'NONE', readingMinutes: Math.max(1, Math.round(words / 180)), sourceUrls: a.sources ?? [], beginnerOrder: a.beginner ?? null,
      seoTitleI18n: a.title, seoDescriptionI18n: a.summary, status: 'PUBLISHED' as const, verifiedAt: now,
    };
    await prisma.guideArticle.upsert({ where: { slug: a.slug }, update: data, create: { slug: a.slug, ...data, publishedAt: now } });
  }
  const templates = await prisma.supportReplyTemplate.count();
  if (!templates) {
    await prisma.supportReplyTemplate.createMany({
      data: [
        { category: null, titleI18n: { uz: 'Salomlashish', ru: 'Приветствие' }, bodyI18n: { uz: 'Assalomu alaykum! Murojaatingiz uchun rahmat. Vaziyatni tekshirib, tez orada javob beramiz.', ru: 'Здравствуйте! Спасибо за обращение. Проверим ситуацию и скоро ответим.' } },
        { category: 'CALCULATOR', titleI18n: { uz: 'Prognoz haqida', ru: 'О прогнозе' }, bodyI18n: { uz: 'Kalkulyator natijasi prognoz: quyosh ma’lumoti va tarif manbasi natija sahifasidagi «Qanday hisoblandi» blokida ko‘rsatilgan.', ru: 'Результат калькулятора — прогноз: источник солнечных данных и тарифа указан в блоке «Как рассчитано».' } },
        { category: 'INSTALLATION', titleI18n: { uz: 'Montaj bo‘yicha', ru: 'По монтажу' }, bodyI18n: { uz: 'Do‘kon bilan bog‘landik. Agar 2 ish kuni ichida javob bo‘lmasa, montaj sahifasida e’tiroz bildirishingiz mumkin.', ru: 'Мы связались с магазином. Если ответа не будет в течение 2 рабочих дней, вы можете оспорить монтаж на его странице.' } },
      ],
    });
  }
  return A.length;
}
