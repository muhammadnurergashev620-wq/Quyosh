// Avtomatik yaratilgan boshlang‘ich matn; matnni admin panelidan o‘zgartiring.
/**
 * Bosh sahifa bloklarining standart matni (TZ U7.1, 5.6). Baza bo‘sh bo‘lsa shu matn PUBLISHED v1 sifatida yoziladi;
 * keyin admin "Bosh sahifa" bo‘limida tahrirlaydi. Kirill (oz) berilmasa, sayt o‘zbek lotinidan avtomatik o‘giradi.
 */
export const HOME_DEFAULTS: Record<string, { uz: Record<string, unknown>; ru: Record<string, unknown> }> = {
  "HERO": {
    "uz": {
      "label": "Quyosh energiyasi · O‘zbekiston",
      "titleA": "Tomingiz quyoshdan",
      "titleB": "pul ishlab chiqaradi",
      "text": "Manzilingizni belgilang — nechta panel sig‘ishi, oyiga qancha tejashingiz va qaysi tasdiqlangan do‘konlar o‘rnatib berishini ko‘rasiz.",
      "chips": [
        "Kalkulyator",
        "Do‘konlar xaritasi",
        "Narx takliflari",
        "Montaj kafolati"
      ],
      "ctaPrimary": "Hisoblab ko‘rish",
      "ctaSecondary": "Men do‘kon egasiman"
    },
    "ru": {
      "label": "Солнечная энергия · Узбекистан",
      "titleA": "Ваша крыша",
      "titleB": "зарабатывает на солнце",
      "text": "Укажите адрес — и вы увидите, сколько панелей поместится, сколько можно сэкономить в месяц и какие проверенные магазины установят систему.",
      "chips": [
        "Калькулятор",
        "Карта магазинов",
        "Коммерческие предложения",
        "Гарантия на монтаж"
      ],
      "ctaPrimary": "Рассчитать",
      "ctaSecondary": "Я владелец магазина"
    }
  },
  "STATS": {
    "uz": {
      "title": "Platforma raqamlarda"
    },
    "ru": {
      "title": "Платформа в цифрах"
    }
  },
  "STATEMENT": {
    "uz": {
      "label": "Quyosh",
      "text": "Quyosh har kuni tomingizga tushadi. Biz faqat uni hisoblaymiz."
    },
    "ru": {
      "label": "Quyosh",
      "text": "Солнце каждый день светит на вашу крышу. Мы его просто считаем."
    }
  },
  "PATHS": {
    "uz": {
      "customerTitle": "Men mijozman",
      "customerPoints": [
        "3 daqiqada dastlabki hisob — ro‘yxatdan o‘tmasdan",
        "Naqd va kredit variantlarini solishtirish",
        "Bir nechta do‘kondan narx taklifi"
      ],
      "customerCta": "Hisoblab ko‘rish",
      "shopTitle": "Men do‘kon egasiman",
      "shopPoints": [
        "Tayyor hisobli so‘rovlar: tizim parametrlari va iste’mol bilan",
        "Katalog, filiallar va xizmat hududi bir joyda",
        "Tasdiqlangan do‘kon belgisi va montajdan keyingi sharhlar"
      ],
      "shopCta": "Do‘kon ochish"
    },
    "ru": {
      "customerTitle": "Я клиент",
      "customerPoints": [
        "Предварительный расчёт за 3 минуты — без регистрации",
        "Сравнение оплаты наличными и в кредит",
        "Предложения от нескольких магазинов"
      ],
      "customerCta": "Рассчитать",
      "shopTitle": "Я владелец магазина",
      "shopPoints": [
        "Готовые запросы с параметрами системы и потреблением",
        "Каталог, филиалы и зона обслуживания в одном месте",
        "Знак проверенного магазина и отзывы только после монтажа"
      ],
      "shopCta": "Открыть магазин"
    }
  },
  "HOW_IT_WORKS": {
    "uz": {
      "eyebrow": "Qanday ishlaydi",
      "title": "Manzildan montajgacha — olti qadam",
      "items": [
        {
          "title": "Manzil",
          "text": "Manzilni qidiring yoki xaritada pin qo‘ying."
        },
        {
          "title": "Maydon",
          "text": "Tomni sun’iy yo‘ldosh rasmi ustida chizing yoki taxminiy hajmni tanlang."
        },
        {
          "title": "Sarf",
          "text": "Oylik kWh, to‘lov summasi yoki maishiy texnika ro‘yxati."
        },
        {
          "title": "Natija",
          "text": "Quvvat, oylik tejash, narx va o‘zini oqlash — diapazon bilan."
        },
        {
          "title": "Takliflar",
          "text": "1–5 ta do‘kondan narx taklifi oling va solishtiring."
        },
        {
          "title": "Montaj",
          "text": "Montajni kuzating va chek-list bilan qabul qiling."
        }
      ]
    },
    "ru": {
      "eyebrow": "Как это работает",
      "title": "От адреса до монтажа — шесть шагов",
      "items": [
        {
          "title": "Адрес",
          "text": "Найдите адрес или поставьте метку на карте."
        },
        {
          "title": "Площадка",
          "text": "Нарисуйте крышу на спутниковом снимке или выберите примерный размер."
        },
        {
          "title": "Потребление",
          "text": "кВт·ч в месяц, сумма счёта или список бытовой техники."
        },
        {
          "title": "Результат",
          "text": "Мощность, экономия, цена и окупаемость — диапазоном."
        },
        {
          "title": "Предложения",
          "text": "Получите и сравните предложения от 1–5 магазинов."
        },
        {
          "title": "Монтаж",
          "text": "Следите за монтажом и принимайте его по чек-листу."
        }
      ]
    }
  },
  "TRUST": {
    "uz": {
      "eyebrow": "Ishonch",
      "title": "Nimaga ishonsa bo‘ladi",
      "items": [
        {
          "title": "Tasdiqlangan do‘konlar",
          "text": "Hujjatlari platforma tomonidan tekshirilgan; rasmiy diler va sertifikat belgilari muddati bilan."
        },
        {
          "title": "Faqat montajdan keyingi sharhlar",
          "text": "Sharhni montaji tasdiqlangan mijoz yozadi; shubhali sharhlar moderatsiyadan o‘tadi."
        },
        {
          "title": "Ochiq ma’lumot manbalari",
          "text": "PVGIS quyosh ma’lumoti, manbasi va sanasi ko‘rsatilgan tariflar — hisob qanday qilingani doim ochiq."
        },
        {
          "title": "Ma’lumotlar O‘zbekistonda",
          "text": "Shaxsiy ma’lumotlar O‘zbekiston hududidagi serverlarda saqlanadi."
        }
      ]
    },
    "ru": {
      "eyebrow": "Доверие",
      "title": "Чему можно доверять",
      "items": [
        {
          "title": "Проверенные магазины",
          "text": "Документы проверены платформой; знаки официального дилера и сертификатов — со сроком действия."
        },
        {
          "title": "Отзывы только после монтажа",
          "text": "Отзыв пишет только клиент с подтверждённым монтажом; подозрительные отзывы проходят модерацию."
        },
        {
          "title": "Открытые источники данных",
          "text": "Солнечные данные PVGIS и тарифы с источником и датой — способ расчёта всегда открыт."
        },
        {
          "title": "Данные в Узбекистане",
          "text": "Персональные данные хранятся на серверах в Узбекистане."
        }
      ]
    }
  },
  "TESTIMONIALS": {
    "uz": {
      "eyebrow": "Sharhlar",
      "title": "Montajdan keyin mijozlar nima deydi"
    },
    "ru": {
      "eyebrow": "Отзывы",
      "title": "Что говорят клиенты после монтажа"
    }
  },
  "FAQ": {
    "uz": {
      "eyebrow": "FAQ",
      "title": "Ko‘p beriladigan savollar",
      "items": [
        {
          "title": "Hisob qanchalik aniq?",
          "text": "Hisob PVGIS quyosh ma’lumotlari, hududingiz tarifi va kiritgan iste’molingiz asosida soatlik bajariladi. Natija past, standart va yuqori diapazonda ko‘rsatiladi — bu prognoz, kafolat emas."
        },
        {
          "title": "Tom maydonini bilmasam-chi?",
          "text": "Tez hisobda «Kichik / O‘rtacha / Katta» variantlaridan birini tanlang yoki xaritada tomni sun’iy yo‘ldosh rasmi ustida chizing."
        },
        {
          "title": "Do‘konlar mening telefonimni ko‘radimi?",
          "text": "Yo‘q. Kontaktni o‘zingiz ochmaguningizcha do‘kon faqat tuman, tizim parametrlari va hisob xulosasini ko‘radi; yozishma platforma ichida."
        },
        {
          "title": "Kredit yoki bo‘lib to‘lash bilan hisoblasa bo‘ladimi?",
          "text": "Ha: oylik to‘lov, ortiqcha to‘lov va tejash to‘lovni qancha qoplashi ko‘rsatiladi. Yakuniy shartlarni bank yoki sotuvchi belgilaydi."
        },
        {
          "title": "Montajdan keyin nima bo‘ladi?",
          "text": "Montajni chek-list bilan qabul qilasiz, sharh qoldirasiz va o‘rnatilgan tizimingizni kabinetda kuzatasiz: kafolatlar, tozalash eslatmalari, haqiqiy ishlab chiqarish."
        },
        {
          "title": "Do‘konni qanday ochaman?",
          "text": "Do‘kon panelida ro‘yxatdan o‘ting: nom, telefon va STIR kiriting, filial va xizmat hududini belgilang. Hujjatlar tekshirilgach, do‘kon katalog va xaritada ko‘rinadi."
        },
        {
          "title": "Ma’lumotlarim qayerda saqlanadi?",
          "text": "Shaxsiy ma’lumotlar O‘zbekiston hududidagi serverlarda saqlanadi."
        },
        {
          "title": "Sharhlar haqiqiymi?",
          "text": "Sharhni faqat montaji tasdiqlangan mijoz yozadi; shubhali sharhlar moderatsiyadan o‘tadi."
        }
      ]
    },
    "ru": {
      "eyebrow": "FAQ",
      "title": "Частые вопросы",
      "items": [
        {
          "title": "Насколько точен расчёт?",
          "text": "Расчёт выполняется по часам на основе данных PVGIS, тарифа вашего региона и вашего потребления. Результат показывается диапазоном — это прогноз, а не гарантия."
        },
        {
          "title": "А если я не знаю площадь крыши?",
          "text": "В быстром расчёте выберите «Маленькая / Средняя / Большая» или нарисуйте крышу на спутниковом снимке."
        },
        {
          "title": "Увидят ли магазины мой телефон?",
          "text": "Нет. Пока вы сами не откроете контакт, магазин видит только район, параметры системы и итоги расчёта; переписка — внутри платформы."
        },
        {
          "title": "Можно ли рассчитать кредит или рассрочку?",
          "text": "Да: показываются ежемесячный платёж, переплата и то, насколько экономия покрывает платёж. Окончательные условия определяет банк или продавец."
        },
        {
          "title": "Что происходит после монтажа?",
          "text": "Вы принимаете монтаж по чек-листу, оставляете отзыв и следите за системой в кабинете: гарантии, напоминания об очистке, реальная выработка."
        },
        {
          "title": "Как открыть магазин?",
          "text": "Зарегистрируйтесь в панели магазина: укажите название, телефон и ИНН, филиал и зону обслуживания. После проверки документов магазин появится в каталоге и на карте."
        },
        {
          "title": "Где хранятся мои данные?",
          "text": "Персональные данные хранятся на серверах в Узбекистане."
        },
        {
          "title": "Отзывы настоящие?",
          "text": "Отзыв может оставить только клиент с подтверждённым монтажом; подозрительные отзывы проходят модерацию."
        }
      ]
    }
  },
  "FINALE": {
    "uz": {
      "title": "Bugun quyosh {h} soat {m} daqiqa porlaydi. Uning qancha qismi sizniki?",
      "ctaPrimary": "Hisoblab ko‘rish",
      "ctaSecondary": "Men do‘kon egasiman"
    },
    "ru": {
      "title": "Сегодня солнце светит {h} ч {m} мин. Сколько из этого — ваше?",
      "ctaPrimary": "Рассчитать",
      "ctaSecondary": "Я владелец магазина"
    }
  }
};
