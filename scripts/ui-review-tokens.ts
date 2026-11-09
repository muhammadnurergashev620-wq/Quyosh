/**
 * Faqat lokal dev stend uchun: `scripts/ui-review.mjs` uchun test foydalanuvchilarining access tokenlari (72 soat).
 * Har panel uchun `dev-ui-<panel>` qurilma sessiyasini (qayta) yaratadi. Production’da ishlamaydi.
 * Ishga tushirish: `npx tsx scripts/ui-review-tokens.ts` → `.ui-review-tokens.json` (gitignore’da).
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createJwt } from '../src/common/types/auth.types';

if (process.env.NODE_ENV === 'production') throw new Error('ui-review-tokens faqat lokal dev uchun');

const USERS = {
  customer: { sub: process.env.UI_REVIEW_CUSTOMER_ID ?? '727f3d0b-78cc-4106-aa51-14eea4405169', roles: ['CUSTOMER'] },
  shop: { sub: process.env.UI_REVIEW_SHOP_ID ?? 'e6449e81-8076-4fae-82c5-81f35076fe85', roles: ['CUSTOMER', 'SHOP'] },
  admin: { sub: process.env.UI_REVIEW_ADMIN_ID ?? '9dc11679-fc5b-4506-9d91-f15f6fa8067e', roles: ['ADMIN'] },
} as const;

void (async () => {
  const db = new PrismaClient();
  const out: Record<string, string> = {};
  for (const [panel, user] of Object.entries(USERS)) {
    const deviceId = `dev-ui-${panel}`;
    await db.deviceSession.deleteMany({ where: { userId: user.sub, deviceId } });
    await db.deviceSession.create({ data: { userId: user.sub, deviceId } as never });
    out[panel] = createJwt({ sub: user.sub, roles: [...user.roles], status: 'ACTIVE', deviceId, type: 'access' } as never, process.env.JWT_SECRET!, 72 * 3600);
  }
  writeFileSync(process.argv[2] ?? '.ui-review-tokens.json', JSON.stringify(out));
  await db.$disconnect();
  console.log('tokenlar yozildi:', Object.keys(out).join(', '));
})();
