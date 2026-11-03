import { Prisma, PrismaClient, SystemType } from '@prisma/client';
import { defaultChecklistItems } from '../src/modules/installation/checklist';
import { DEFAULT_MODERATION_RULES } from '../src/modules/review/review-risk';

/** M6: qabul chek-listi shablonlari (TZ 13.7) va ModerationSettings v1 (13.4). Idempotent. */
export async function seedM6(prisma: PrismaClient) {
  for (const systemType of ['ON_GRID', 'HYBRID', 'OFF_GRID'] as SystemType[]) {
    await prisma.acceptanceChecklistTemplate.upsert({
      where: { systemType_version: { systemType, version: 1 } },
      update: {},
      create: { systemType, version: 1, itemsJson: defaultChecklistItems(systemType !== 'ON_GRID') as unknown as Prisma.InputJsonValue, active: true },
    });
  }
  const existing = await prisma.moderationSettings.findFirst({ select: { id: true } });
  if (!existing) await prisma.moderationSettings.create({ data: { version: 1, rulesJson: DEFAULT_MODERATION_RULES as unknown as Prisma.InputJsonValue, active: true } });
}
