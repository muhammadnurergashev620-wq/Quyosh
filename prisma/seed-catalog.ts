import { Prisma, PrismaClient } from '@prisma/client';

type Attr = { key: string; type: 'number' | 'string'; unit?: string; label: { uz: string; oz: string; ru: string }; filter?: 'range' | 'select' };
const attr = (key: string, unit: string | undefined, uz: string, oz: string, ru: string, filter?: Attr['filter']): Attr => ({ key, type: key === 'batteryChemistry' ? 'string' : 'number', unit, label: { uz, oz, ru }, filter });

/** TZ 7.4 / U7.5: asosiy kategoriyalar va filtr atributlari. id’lar barqaror — seed qayta ishlatilsa ham o‘zgarmaydi. */
const CATEGORIES: Array<{ id: string; slug: string; name: { uz: string; oz: string; ru: string }; sortOrder: number; attributes: Attr[] }> = [
  {
    id: '00000000-0002-4000-8000-000000000001', slug: 'quyosh-panellari', sortOrder: 1,
    name: { uz: 'Quyosh panellari', oz: 'Қуёш панеллари', ru: 'Солнечные панели' },
    attributes: [
      attr('nominalPowerW', 'W', 'Quvvat', 'Қувват', 'Мощность', 'range'),
      attr('efficiencyPct', '%', 'Samaradorlik', 'Самарадорлик', 'КПД', 'range'),
      attr('widthMm', 'mm', 'Eni', 'Эни', 'Ширина'),
      attr('heightMm', 'mm', 'Bo‘yi', 'Бўйи', 'Высота'),
      attr('weightKg', 'kg', 'Og‘irligi', 'Оғирлиги', 'Вес'),
      attr('tempCoeffPmaxPctPerC', '%/°C', 'Harorat koeffitsienti', 'Ҳарорат коэффициенти', 'Темп. коэффициент'),
      attr('vocV', 'V', 'Voc', 'Voc', 'Voc'),
      attr('vmpV', 'V', 'Vmp', 'Vmp', 'Vmp'),
      attr('iscA', 'A', 'Isc', 'Isc', 'Isc'),
      attr('impA', 'A', 'Imp', 'Imp', 'Imp'),
      attr('degradationPctPerYear', '%/yil', 'Yillik degradatsiya', 'Йиллик деградация', 'Деградация в год'),
      attr('warrantyMonths', 'oy', 'Kafolat', 'Кафолат', 'Гарантия'),
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000002', slug: 'invertorlar', sortOrder: 2,
    name: { uz: 'Invertorlar', oz: 'Инверторлар', ru: 'Инверторы' },
    attributes: [
      attr('inverterAcKw', 'kW', 'AC quvvat', 'AC қувват', 'Мощность AC', 'range'),
      attr('inverterMaxDcV', 'V', 'Maks. DC kuchlanish', 'Макс. DC кучланиш', 'Макс. DC напряжение'),
      attr('mpptMinV', 'V', 'MPPT min', 'MPPT мин', 'MPPT мин'),
      attr('mpptMaxV', 'V', 'MPPT maks', 'MPPT макс', 'MPPT макс'),
      attr('mpptMaxCurrentA', 'A', 'MPPT maks. tok', 'MPPT макс. ток', 'Макс. ток MPPT'),
      attr('efficiencyPct', '%', 'Samaradorlik', 'Самарадорлик', 'КПД', 'range'),
      attr('warrantyMonths', 'oy', 'Kafolat', 'Кафолат', 'Гарантия'),
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000003', slug: 'akkumulyatorlar', sortOrder: 3,
    name: { uz: 'Akkumulyatorlar', oz: 'Аккумуляторлар', ru: 'Аккумуляторы' },
    attributes: [
      attr('batteryCapacityKwh', 'kWh', 'Sig‘im', 'Сиғим', 'Ёмкость', 'range'),
      attr('batteryVoltageV', 'V', 'Kuchlanish', 'Кучланиш', 'Напряжение', 'select'),
      attr('batteryUsableDod', '', 'Foydali DoD', 'Фойдали DoD', 'Полезная DoD'),
      attr('batteryChemistry', undefined, 'Kimyo', 'Кимё', 'Химия', 'select'),
      attr('batteryCycles', 'sikl', 'Sikllar', 'Цикллар', 'Циклы'),
      attr('warrantyMonths', 'oy', 'Kafolat', 'Кафолат', 'Гарантия'),
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000004', slug: 'montaj-konstruksiyalari', sortOrder: 4,
    name: { uz: 'Montaj konstruksiyalari', oz: 'Монтаж конструкциялари', ru: 'Монтажные конструкции' },
    attributes: [attr('weightKg', 'kg', 'Og‘irligi', 'Оғирлиги', 'Вес'), attr('warrantyMonths', 'oy', 'Kafolat', 'Кафолат', 'Гарантия')],
  },
  {
    id: '00000000-0002-4000-8000-000000000005', slug: 'kabel-va-himoya', sortOrder: 5,
    name: { uz: 'Kabel va himoya', oz: 'Кабел ва ҳимоя', ru: 'Кабель и защита' },
    attributes: [attr('warrantyMonths', 'oy', 'Kafolat', 'Кафолат', 'Гарантия')],
  },
];

/** Faqat dev/demo: SEED_DEMO=true bo‘lsa namunaviy modellar. */
const DEMO_MODELS: Array<Prisma.ProductModelUncheckedCreateInput> = [
  { categoryId: CATEGORIES[0].id, brand: 'Longi', model: 'Hi-MO 6 LR5-72HTH-580M', slug: 'longi-hi-mo-6-lr5-72hth-580m', status: 'APPROVED', nominalPowerW: 580, efficiencyPct: '22.5', widthMm: 1134, heightMm: 2278, weightKg: '27.2', tempCoeffPmaxPctPerC: '-0.29', vocV: '51.95', vmpV: '43.45', iscA: '14.19', impA: '13.35', degradationPctPerYear: '0.4', warrantyMonths: 180 },
  { categoryId: CATEGORIES[0].id, brand: 'JA Solar', model: 'JAM72D40-575/LB', slug: 'ja-solar-jam72d40-575-lb', status: 'APPROVED', nominalPowerW: 575, efficiencyPct: '22.3', widthMm: 1134, heightMm: 2278, weightKg: '32.5', tempCoeffPmaxPctPerC: '-0.30', vocV: '51.8', vmpV: '43.2', iscA: '14.1', impA: '13.31', degradationPctPerYear: '0.4', warrantyMonths: 144 },
  { categoryId: CATEGORIES[0].id, brand: 'Trina Solar', model: 'Vertex N TSM-NEG19RC.20 600W', slug: 'trina-solar-vertex-n-600w', status: 'APPROVED', nominalPowerW: 600, efficiencyPct: '22.2', widthMm: 1134, heightMm: 2384, weightKg: '33.7', tempCoeffPmaxPctPerC: '-0.29', vocV: '50.5', vmpV: '42.3', iscA: '15.1', impA: '14.2', degradationPctPerYear: '0.4', warrantyMonths: 180 },
  { categoryId: CATEGORIES[1].id, brand: 'Deye', model: 'SUN-8K-SG04LP3-EU', slug: 'deye-sun-8k-sg04lp3-eu', status: 'APPROVED', inverterAcKw: '8', inverterMaxDcV: '800', mpptMinV: '160', mpptMaxV: '650', mpptMaxCurrentA: '13', efficiencyPct: '97.6', warrantyMonths: 60 },
  { categoryId: CATEGORIES[1].id, brand: 'Huawei', model: 'SUN2000-10KTL-M1', slug: 'huawei-sun2000-10ktl-m1', status: 'APPROVED', inverterAcKw: '10', inverterMaxDcV: '1100', mpptMinV: '140', mpptMaxV: '980', mpptMaxCurrentA: '11', efficiencyPct: '98.6', warrantyMonths: 120 },
  { categoryId: CATEGORIES[2].id, brand: 'Pylontech', model: 'US5000', slug: 'pylontech-us5000', status: 'APPROVED', batteryCapacityKwh: '4.8', batteryVoltageV: '48', batteryUsableDod: '0.95', batteryChemistry: 'LiFePO4', batteryCycles: 6000, warrantyMonths: 120 },
  { categoryId: CATEGORIES[2].id, brand: 'Deye', model: 'SE-G5.1 Pro-B', slug: 'deye-se-g5-1-pro-b', status: 'APPROVED', batteryCapacityKwh: '5.12', batteryVoltageV: '51.2', batteryUsableDod: '0.9', batteryChemistry: 'LiFePO4', batteryCycles: 6000, warrantyMonths: 120 },
];

export async function seedCatalog(prisma: PrismaClient): Promise<number> {
  for (const category of CATEGORIES) {
    const data = { slug: category.slug, nameI18n: category.name, sortOrder: category.sortOrder, attributeSchemaJson: category.attributes as unknown as Prisma.InputJsonValue };
    await prisma.category.upsert({ where: { id: category.id }, update: data, create: { id: category.id, ...data } });
  }
  if (process.env.SEED_DEMO === 'true') {
    for (const model of DEMO_MODELS) {
      await prisma.productModel.upsert({ where: { slug: model.slug }, update: {}, create: model });
    }
  }
  return CATEGORIES.length;
}
