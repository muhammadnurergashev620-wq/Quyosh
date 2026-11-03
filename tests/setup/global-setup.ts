import { execFileSync } from 'node:child_process';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { applyTestEnv, TEST_DATABASE_URL, TEST_ENV } from './env';

export default async function globalSetup({ provide }: { provide: (key: string, value: unknown) => void }): Promise<void> {
  applyTestEnv();

  const admin = new PrismaClient({ datasourceUrl: `${TEST_ENV.DATABASE_BASE_URL}/postgres` });
  try {
    const exists = await admin.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok FROM pg_database WHERE datname = ${TEST_ENV.DATABASE_NAME}`;
    if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_ENV.DATABASE_NAME}"`);
  } finally {
    await admin.$disconnect();
  }

  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await db.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await db.$disconnect();
  }

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], { env, stdio: 'pipe' });

  const probe = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    provide('seedCounts', {
      policies: await probe.policyVersion.count(),
      users: await probe.user.count(),
      shops: await probe.shop.count(),
      notifications: await probe.notification.count(),
      media: await probe.mediaAsset.count(),
      admins: await probe.userRole.count({ where: { role: 'ADMIN' } }),
    });
  } finally {
    await probe.$disconnect();
  }

  const redis = new Redis(TEST_ENV.REDIS_URL);
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }

  const s3 = new S3Client({
    endpoint: TEST_ENV.STORAGE_ENDPOINT,
    region: TEST_ENV.STORAGE_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: TEST_ENV.STORAGE_ACCESS_KEY_ID, secretAccessKey: TEST_ENV.STORAGE_SECRET_ACCESS_KEY },
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: TEST_ENV.STORAGE_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: TEST_ENV.STORAGE_BUCKET }));
  }
}
