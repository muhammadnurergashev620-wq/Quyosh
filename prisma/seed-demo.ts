import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Faqat dev/demo (SEED_DEMO=true): xarita va katalogni to‘ldirish uchun namunaviy do‘konlar.
 * Demo foydalanuvchi paroli DEMO_USER_PASSWORD dan olinadi (kodda parol saqlanmaydi).
 */
const SHOPS = [
  { slug: 'demo-toshkent-quyosh', name: 'Toshkent Quyosh Tizimlari', stir: '300000001', lat: 41.3111, lon: 69.2797, city: 'Toshkent, Amir Temur ko‘chasi', region: 'toshkent-shahri', radius: 40 },
  { slug: 'demo-chilonzor-solar', name: 'Chilonzor Solar', stir: '300000002', lat: 41.2756, lon: 69.2034, city: 'Toshkent, Chilonzor 19-kvartal', region: 'toshkent-shahri', radius: 25 },
  { slug: 'demo-samarqand-energiya', name: 'Samarqand Energiya', stir: '300000003', lat: 39.6542, lon: 66.9597, city: 'Samarqand, Registon ko‘chasi', region: 'samarqand', radius: 60 },
  { slug: 'demo-buxoro-nur', name: 'Buxoro Nur', stir: '300000004', lat: 39.7747, lon: 64.4286, city: 'Buxoro, Navoiy shoh ko‘chasi', region: 'buxoro', radius: 50 },
  { slug: 'demo-fargona-sun', name: 'Farg‘ona Sun Montaj', stir: '300000005', lat: 40.3842, lon: 71.7843, city: 'Farg‘ona, Mustaqillik ko‘chasi', region: 'fargona', radius: 45 },
  { slug: 'demo-nukus-quyosh', name: 'Nukus Quyosh', stir: '300000006', lat: 42.4619, lon: 59.6003, city: 'Nukus, Doslik guzari', region: 'qoraqalpogiston', radius: 70 },
];

export async function seedDemo(prisma: PrismaClient): Promise<number> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8) throw new Error('SEED_DEMO=true uchun DEMO_USER_PASSWORD (kamida 8 belgi) kerak');
  const phone = process.env.DEMO_USER_PHONE?.trim() || '+998900000099';
  const owner = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone, firstName: 'Demo', lastName: 'Do‘kon', passwordHash: await bcrypt.hash(password, 12), status: UserStatus.ACTIVE, phoneVerifiedAt: new Date() },
  });
  for (const role of [Role.CUSTOMER, Role.SHOP]) {
    await prisma.userRole.upsert({ where: { userId_role: { userId: owner.id, role } }, update: {}, create: { userId: owner.id, role } });
  }
  const models = await prisma.productModel.findMany({ where: { status: 'APPROVED' }, orderBy: { slug: 'asc' } });
  let index = 0;
  for (const item of SHOPS) {
    index += 1;
    const existing = await prisma.shop.findUnique({ where: { slug: item.slug } });
    if (existing) continue;
    const shop = await prisma.shop.create({
      data: {
        slug: item.slug, name: item.name, stir: item.stir, phone: `+99890000${String(index).padStart(4, '0')}`,
        description: `${item.name} — quyosh panellari, invertorlar va akkumulyatorlar sotuvi hamda montaji.`,
        status: 'ACTIVE', verificationStatus: 'VERIFIED', createdSource: 'ADMIN', ratingAvg: (4 + (index % 10) / 10).toFixed(1), ratingCount: 3 + index * 2,
        // Demo uchun barcha do‘konlar bitta egaga tegishli (ilovadagi 3 ta cheklov faqat yaratish oqimida).
        members: { create: { userId: owner.id, memberRole: 'OWNER' } },
      },
    });
    const branch = await prisma.shopBranch.create({
      data: { shopId: shop.id, name: 'Asosiy filial', address: item.city, regionCode: item.region, openingHoursJson: { mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], thu: [['09:00', '18:00']], fri: [['09:00', '18:00']], sat: [['10:00', '16:00']] } },
    });
    await prisma.$executeRaw`UPDATE shop_branches SET location = ST_SetSRID(ST_MakePoint(${item.lon}, ${item.lat}), 4326)::geography WHERE id = ${branch.id}::uuid`;
    await prisma.$executeRaw`
      INSERT INTO service_areas (id, branch_id, geom, area_km2, service_types, active, "updatedAt")
      SELECT gen_random_uuid(), b.id, ST_Multi(ST_Buffer(b.location, ${item.radius * 1000}, 16)::geometry)::geography,
             round((ST_Area(ST_Buffer(b.location, ${item.radius * 1000}, 16)) / 1e6)::numeric, 3), ARRAY[]::"ServiceType"[], true, now()
      FROM shop_branches b WHERE b.id = ${branch.id}::uuid`;
    await prisma.service.createMany({
      data: [
        { shopId: shop.id, serviceType: 'INSTALLATION', pricingModel: 'PER_KW', price: String(1_000_000 + index * 50_000) },
        { shopId: shop.id, serviceType: 'SITE_VISIT', pricingModel: 'FIXED', price: '150000' },
      ],
    });
    for (const [position, model] of models.entries()) {
      if ((position + index) % 2 === 0) continue;
      const usd = model.categoryId.endsWith('2');
      await prisma.shopProduct.create({
        data: {
          shopId: shop.id, productModelId: model.id, status: 'ACTIVE',
          offers: { create: { branchId: branch.id, price: usd ? String(900 + index * 40 + position * 15) : String(1_200_000 + index * 35_000 + position * 110_000), currency: usd ? 'USD' : 'UZS', stockStatus: position % 3 ? 'IN_STOCK' : 'ON_ORDER' } },
        },
      });
    }
  }
  return SHOPS.length;
}
