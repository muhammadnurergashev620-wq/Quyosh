import { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, MODEL_VERSION } from '../src/modules/calc-engine/estimate';

const flat24 = () => new Array(24).fill(1 / 24);
const normalize = (values: number[]) => {
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map((v) => Math.round((v / sum) * 1e5) / 1e5);
};

/** Soatlik shakllar (nisbiy og‘irlik) → 24 ta ulush. */
const HOUSEHOLD_DAY = normalize([2, 1.6, 1.4, 1.3, 1.3, 1.6, 2.6, 3.6, 3.4, 2.8, 2.6, 2.6, 2.8, 2.7, 2.6, 2.6, 2.8, 3.4, 4.6, 5.6, 5.8, 5.2, 4.2, 3]);
const AC_SUMMER_DAY = normalize([2.2, 1.8, 1.6, 1.5, 1.5, 1.7, 2.4, 3.2, 3.6, 4.2, 5, 5.8, 6.4, 6.8, 6.8, 6.4, 6, 5.6, 5.4, 5.4, 5, 4.2, 3.2, 2.6]);
const BUSINESS = normalize([1, 1, 1, 1, 1, 1.2, 2, 4, 7, 8, 8, 8, 7.5, 7.5, 8, 8, 7.5, 6, 3, 1.6, 1.2, 1, 1, 1]);

/** TZ 7.5 LoadProfile kodlari. Oylik koeffitsientlar — yillik o‘rtacha 1 atrofida. */
const LOAD_PROFILES = [
  { code: 'HOUSEHOLD_STD', name: { uz: 'Oddiy xonadon', oz: 'Оддий хонадон', ru: 'Обычное домохозяйство' }, monthly: [1.15, 1.1, 1, 0.92, 0.88, 0.95, 1.02, 1.02, 0.92, 0.94, 1.02, 1.12], hourly: () => Array.from({ length: 12 }, () => HOUSEHOLD_DAY) },
  { code: 'HOUSEHOLD_AC', name: { uz: 'Konditsionerli xonadon', oz: 'Кондиционерли хонадон', ru: 'Дом с кондиционером' }, monthly: [0.9, 0.85, 0.8, 0.85, 1.05, 1.35, 1.5, 1.45, 1.1, 0.85, 0.8, 0.9], hourly: () => Array.from({ length: 12 }, (_, m) => (m >= 5 && m <= 7 ? AC_SUMMER_DAY : HOUSEHOLD_DAY)) },
  { code: 'BUSINESS_DAY', name: { uz: 'Kunduzgi biznes', oz: 'Кундузги бизнес', ru: 'Дневной бизнес' }, monthly: [1, 1, 1, 1, 1, 1.05, 1.1, 1.1, 1, 1, 1, 1], hourly: () => Array.from({ length: 12 }, () => BUSINESS) },
  { code: 'ROUND_THE_CLOCK', name: { uz: 'Kecha-kunduz', oz: 'Кеча-кундуз', ru: 'Круглосуточно' }, monthly: new Array(12).fill(1), hourly: () => Array.from({ length: 12 }, flat24) },
];

const EVENING = normalize([1, 0.5, 0.3, 0.3, 0.3, 0.5, 1.5, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2, 4, 5, 5, 4, 3, 2]);
const ALWAYS = flat24();
const MIDDAY = normalize([0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.5, 1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 3, 2, 1.5, 1, 0.8, 0.6, 0.5]);
const MORNING_EVENING = normalize([0.2, 0.1, 0.1, 0.1, 0.1, 0.5, 2, 3, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 2, 3, 3, 2, 1, 0.5, 0.3]);

const SUMMER = [5, 6, 7, 8, 9];
const WINTER = [1, 2, 3, 11, 12];

/** TZ 7.5 ApplianceType: odatiy quvvat va soatlar (mijoz o‘zgartiradi). */
const APPLIANCES = [
  { code: 'FRIDGE', name: { uz: 'Muzlatkich', oz: 'Музлаткич', ru: 'Холодильник' }, powerW: 150, hours: 10, months: [], usage: ALWAYS, motor: true, surge: 3 },
  { code: 'FREEZER', name: { uz: 'Muzxona', oz: 'Музхона', ru: 'Морозильник' }, powerW: 120, hours: 10, months: [], usage: ALWAYS, motor: true, surge: 3 },
  { code: 'AC', name: { uz: 'Konditsioner', oz: 'Кондиционер', ru: 'Кондиционер' }, powerW: 1200, hours: 8, months: SUMMER, usage: MIDDAY, motor: true, surge: 2.5 },
  { code: 'LIGHTING_LED', name: { uz: 'LED chiroqlar', oz: 'LED чироқлар', ru: 'LED-освещение' }, powerW: 10, hours: 6, months: [], usage: EVENING, motor: false, surge: 1 },
  { code: 'TV', name: { uz: 'Televizor', oz: 'Телевизор', ru: 'Телевизор' }, powerW: 100, hours: 5, months: [], usage: EVENING, motor: false, surge: 1 },
  { code: 'WASHER', name: { uz: 'Kir yuvish mashinasi', oz: 'Кир ювиш машинаси', ru: 'Стиральная машина' }, powerW: 2000, hours: 1, months: [], usage: MIDDAY, motor: true, surge: 2 },
  { code: 'WATER_PUMP', name: { uz: 'Suv nasosi', oz: 'Сув насоси', ru: 'Водяной насос' }, powerW: 750, hours: 2, months: [], usage: MORNING_EVENING, motor: true, surge: 3 },
  { code: 'KETTLE', name: { uz: 'Elektr choynak', oz: 'Электр чойнак', ru: 'Электрочайник' }, powerW: 2000, hours: 0.5, months: [], usage: MORNING_EVENING, motor: false, surge: 1 },
  { code: 'IRON', name: { uz: 'Dazmol', oz: 'Дазмол', ru: 'Утюг' }, powerW: 1800, hours: 0.3, months: [], usage: EVENING, motor: false, surge: 1 },
  { code: 'COMPUTER', name: { uz: 'Kompyuter', oz: 'Компьютер', ru: 'Компьютер' }, powerW: 200, hours: 6, months: [], usage: MIDDAY, motor: false, surge: 1 },
  { code: 'ROUTER', name: { uz: 'Wi-Fi router', oz: 'Wi-Fi роутер', ru: 'Wi-Fi роутер' }, powerW: 12, hours: 24, months: [], usage: ALWAYS, motor: false, surge: 1 },
  { code: 'HEATER', name: { uz: 'Elektr isitgich', oz: 'Электр иситгич', ru: 'Электрообогреватель' }, powerW: 2000, hours: 5, months: WINTER, usage: EVENING, motor: false, surge: 1 },
  { code: 'WATER_HEATER', name: { uz: 'Elektr suv isitgich', oz: 'Электр сув иситгич', ru: 'Электроводонагреватель' }, powerW: 1500, hours: 2, months: [], usage: MORNING_EVENING, motor: false, surge: 1 },
  { code: 'MICROWAVE', name: { uz: 'Mikroto‘lqinli pech', oz: 'Микротўлқинли печ', ru: 'Микроволновка' }, powerW: 1000, hours: 0.3, months: [], usage: MORNING_EVENING, motor: false, surge: 1 },
  { code: 'CCTV', name: { uz: 'Kuzatuv kamerasi', oz: 'Кузатув камераси', ru: 'Видеонаблюдение' }, powerW: 30, hours: 24, months: [], usage: ALWAYS, motor: false, surge: 1 },
];

const TEMPLATES = [
  { code: 'APARTMENT_SMALL', name: { uz: 'Kvartira (2–3 xona)', oz: 'Квартира (2–3 хона)', ru: 'Квартира (2–3 комнаты)' }, items: [['FRIDGE', 1, 10, true], ['LIGHTING_LED', 10, 6, true], ['TV', 1, 5, false], ['WASHER', 1, 1, false], ['ROUTER', 1, 24, true], ['KETTLE', 1, 0.5, false], ['IRON', 1, 0.3, false]] },
  { code: 'HOUSE_STD', name: { uz: 'Hovli uy', oz: 'Ҳовли уй', ru: 'Частный дом' }, items: [['FRIDGE', 1, 10, true], ['FREEZER', 1, 10, true], ['LIGHTING_LED', 20, 6, true], ['TV', 2, 5, false], ['WASHER', 1, 1, false], ['WATER_PUMP', 1, 2, true], ['ROUTER', 1, 24, true], ['AC', 2, 8, false], ['KETTLE', 1, 0.5, false], ['IRON', 1, 0.3, false], ['CCTV', 2, 24, true]] },
  { code: 'SMALL_SHOP', name: { uz: 'Kichik do‘kon / ofis', oz: 'Кичик дўкон / офис', ru: 'Небольшой магазин / офис' }, items: [['FRIDGE', 2, 10, true], ['LIGHTING_LED', 25, 10, true], ['COMPUTER', 3, 9, true], ['ROUTER', 1, 24, true], ['AC', 2, 8, false], ['CCTV', 4, 24, true]] },
];

/** Viloyat o‘rtacha specific yield, kWh/kWp/oy (yo‘qotishlarsiz). Taxminiy — PVGIS bilan solishtirib yangilanadi. */
const SHAPE = [0.046, 0.056, 0.078, 0.094, 0.114, 0.126, 0.131, 0.125, 0.104, 0.082, 0.054, 0.041];
const ANNUAL: Record<string, number> = {
  'toshkent-shahri': 1520, 'toshkent-viloyati': 1530, andijon: 1500, buxoro: 1640, fargona: 1510, jizzax: 1600, xorazm: 1600,
  namangan: 1500, navoiy: 1620, qashqadaryo: 1660, qoraqalpogiston: 1580, samarqand: 1610, sirdaryo: 1570, surxondaryo: 1700,
};

export async function seedCalc(prisma: PrismaClient) {
  await prisma.calculationSettings.upsert({
    where: { modelVersion: MODEL_VERSION },
    update: {},
    create: { modelVersion: MODEL_VERSION, parametersJson: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue, effectiveFrom: new Date('2026-01-01'), status: 'PUBLISHED', sourceNotes: 'Boshlang‘ich standart qiymatlar (TZ 11). Admin yangi versiya bilan yangilaydi.' },
  });
  for (const profile of LOAD_PROFILES) {
    const data = { nameI18n: profile.name, monthlyFactors: profile.monthly, hourlyFactorsJson: profile.hourly() };
    await prisma.loadProfile.upsert({ where: { code: profile.code }, update: data, create: { code: profile.code, ...data } });
  }
  for (const [index, item] of APPLIANCES.entries()) {
    const data = { nameI18n: item.name, defaultPowerW: item.powerW, defaultHoursPerDay: item.hours, defaultMonths: item.months, surgeFactor: item.surge, hourlyUsageTemplate: item.usage, isMotorLoad: item.motor, sortOrder: index };
    await prisma.applianceType.upsert({ where: { code: item.code }, update: data, create: { code: item.code, ...data } });
  }
  for (const [index, template] of TEMPLATES.entries()) {
    const items = template.items.map(([code, count, hoursPerDay, isCritical]) => ({ applianceTypeCode: code, count, hoursPerDay, isCritical }));
    const data = { nameI18n: template.name, itemsJson: items, customerType: template.code === 'SMALL_SHOP' ? ('LEGAL' as const) : ('HOUSEHOLD' as const), sortOrder: index };
    await prisma.applianceTemplate.upsert({ where: { code: template.code }, update: data, create: { code: template.code, ...data } });
  }
  for (const [regionCode, annual] of Object.entries(ANNUAL)) {
    const monthlyYieldJson = SHAPE.map((share) => Math.round(share * annual * 10) / 10);
    await prisma.regionalYield.upsert({ where: { regionCode }, update: {}, create: { regionCode, monthlyYieldJson, sourceNote: 'Taxminiy boshlang‘ich qiymat; PVGIS bilan tekshirib yangilang.' } });
  }
}

/**
 * Faqat dev/demo: TEKSHIRILMAGAN namunaviy tarif va moliyalashtirish mahsuloti (sarlavhada «DEMO»).
 * Productionda tarifni admin rasmiy manba (sourceUrl) bilan kiritadi va tasdiqlaydi.
 */
export async function seedCalcDemo(prisma: PrismaClient) {
  const exists = await prisma.tariffSchedule.findFirst({ where: { title: { startsWith: 'DEMO' } } });
  if (!exists) {
    for (const regionCode of Object.keys(ANNUAL)) {
      await prisma.tariffSchedule.create({
        data: {
          regionCode, customerType: 'HOUSEHOLD', title: 'DEMO — maishiy pog‘onali tarif (tekshirilmagan)', effectiveFrom: new Date('2026-01-01'), status: 'PUBLISHED',
          tiers: { create: [
            { minKwh: 0, maxKwh: 200, ratePerKwh: 600 },
            { minKwh: 200, maxKwh: 1000, ratePerKwh: 1000 },
            { minKwh: 1000, maxKwh: null, ratePerKwh: 1500 },
          ] },
        },
      });
      await prisma.gridConnectionLimit.create({ data: { regionCode, customerType: 'HOUSEHOLD', maxKw: 15, effectiveFrom: new Date('2026-01-01'), status: 'PUBLISHED' } });
    }
  }
  if (!(await prisma.financingProduct.findFirst({ where: { providerName: { startsWith: 'DEMO' } } }))) {
    await prisma.financingProduct.create({
      data: { providerName: 'DEMO Bank — «Yashil energiya» krediti', financingType: 'BANK_LOAN', annualRate: 0.22, minTermMonths: 6, maxTermMonths: 36, allowedTerms: [6, 12, 18, 24, 36], minDownPaymentPct: 0.2, oneTimeFeePct: 0.01, paymentType: 'ANNUITY', customerTypes: ['HOUSEHOLD', 'LEGAL'], effectiveFrom: new Date('2026-01-01'), status: 'PUBLISHED' },
    });
  }
}
