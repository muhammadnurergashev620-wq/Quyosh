import { PolicyStatus, PolicyType, PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedCatalog } from './seed-catalog';
import { seedDemo } from './seed-demo';
import { seedCalc, seedCalcDemo } from './seed-calc';
import { seedM6 } from './seed-m6';
import { seedKnowledge } from './seed-knowledge';

const prisma = new PrismaClient();

const POLICIES: Array<{ id: string; type: PolicyType; version: string; title: string; content: string }> = [
  {
    id: '00000000-0001-4000-8000-000000000001',
    type: PolicyType.TERMS,
    version: '1.0',
    title: 'Foydalanish shartlari',
    content: 'Quyosh platformasidan foydalanish shartlari',
  },
  {
    id: '00000000-0001-4000-8000-000000000002',
    type: PolicyType.PRIVACY,
    version: '1.0',
    title: 'Maxfiylik siyosati',
    content: 'Quyosh maxfiylik siyosati',
  },
  {
    id: '00000000-0001-4000-8000-000000000003',
    type: PolicyType.PLATFORM_RULES,
    version: '1.0',
    title: 'Platforma qoidalari',

    content: 'Quyosh platforma ishlatish qoidalari',
  },
];

async function seedPolicies(): Promise<void> {
  for (const policy of POLICIES) {
    await prisma.policyVersion.upsert({
      where: { type_version: { type: policy.type, version: policy.version } },
      update: {},
      create: { ...policy, status: PolicyStatus.PUBLISHED, publishedAt: new Date('2026-01-01T00:00:00Z') },
    });
  }
}

/** Standart superadmin: login (ADMIN_LOGIN, standart «admin») + ADMIN_PASSWORD; ADMIN_PHONE ixtiyoriy (aloqa uchun). */
async function seedAdmin(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  if (password.length < 12) throw new Error('ADMIN_PASSWORD kamida 12 ta belgidan iborat bo‘lishi kerak');
  const login = (process.env.ADMIN_LOGIN ?? '').trim().toLowerCase() || 'admin';
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(login)) throw new Error('ADMIN_LOGIN 3–32 belgi: lotin harflari, raqamlar va . _ -');
  const rawPhone = process.env.ADMIN_PHONE?.trim();
  const phone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : null;

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findFirst({ where: { OR: [{ login }, ...(phone ? [{ phone }] : [])] }, select: { id: true } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { login, passwordHash, status: UserStatus.ACTIVE, isSuperAdmin: true, twoFactorEnabled: false, mustPasswordChange: false } })
    : await prisma.user.create({
        data: { login, phone, passwordHash, firstName: 'Admin', isSuperAdmin: true, status: UserStatus.ACTIVE, twoFactorEnabled: false, phoneVerifiedAt: phone ? new Date() : null },
      });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.ADMIN } },
    update: {},
    create: { userId: user.id, role: Role.ADMIN },
  });
  return true;
}

async function main(): Promise<void> {
  await seedPolicies();
  if (await seedAdmin()) console.log('Admin foydalanuvchi tayyor (ADMIN_LOGIN + ADMIN_PASSWORD).');
  const categories = await seedCatalog(prisma);
  await seedCalc(prisma);
  await seedM6(prisma);
  console.log(`Bilimlar markazi: ${await seedKnowledge(prisma)} ta material.`);
  if (process.env.SEED_DEMO === 'true') await seedCalcDemo(prisma);
  if (process.env.SEED_DEMO === 'true') console.log(`Demo: ${await seedDemo(prisma)} ta do‘kon (xarita uchun).`);
  console.log(`Seeded ${POLICIES.length} policy version(s), ${categories} categories${process.env.SEED_DEMO === 'true' ? ' + demo models' : ''}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
