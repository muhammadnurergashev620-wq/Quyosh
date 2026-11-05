/**
 * Render build: boshlang‘ich ma’lumot (seed) kerakmi? Chiqish kodi: 0 — kerak (baza bo‘sh), 1 — kerak emas, 2 — xato.
 * Marker — bilimlar markazi maqolalari: seed ularni OXIRIDA yozadi, shuning uchun yarim qolgan seed qayta bajariladi.
 * Seed admin parolini va katalog/bilimlar matnlarini boshlang‘ich holatga qaytaradi — shuning uchun to‘ldirilgan bazada ishlamaydi.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
prisma.guideArticle
  .count()
  .then((count) => {
    console.log(count === 0 ? 'seed kerak (baza bo‘sh)' : `seed kerak emas (${count} ta maqola bor)`);
    process.exitCode = count === 0 ? 0 : 1;
  })
  .catch((error: unknown) => {
    console.error('Bazani tekshirib bo‘lmadi:', error instanceof Error ? error.message : error);
    process.exitCode = 2;
  })
  .finally(() => void prisma.$disconnect());
