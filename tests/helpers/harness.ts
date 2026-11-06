import { ADMIN_PERMISSIONS } from '../../src/common/constants/admin-permissions';
import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { createJwt, type AccessClaims } from '../../src/common/types/auth.types';
import { TEST_ENV } from '../setup/env';

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
  data: any;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  idempotent?: boolean;
  ip?: string;
  cookie?: string;
  rawBody?: string;
}

export interface TestUser {
  id: string;
  phone: string;
  token: string;
  roles: Role[];
}

export interface Harness {
  app: INestApplication;
  db: PrismaService;
  baseUrl: string;
  defaultIp: string;
  api(method: string, path: string, options?: RequestOptions): Promise<ApiResult>;
  get(path: string, token?: string): Promise<ApiResult>;
  post(path: string, token: string | undefined, body?: unknown, options?: RequestOptions): Promise<ApiResult>;
  patch(path: string, token: string | undefined, body?: unknown): Promise<ApiResult>;
  del(path: string, token: string | undefined): Promise<ApiResult>;
  close(): Promise<void>;
}

export async function bootHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
  configureApp(app);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const db = app.get(PrismaService);
  const defaultIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;

  const api: Harness['api'] = async (method, path, options = {}) => {
    const headers: Record<string, string> = { 'x-forwarded-for': options.ip ?? defaultIp, ...(options.headers ?? {}) };
    if (options.token) headers.cookie = `accessToken=${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;
    // TZ 9.4: majburiy kalitli endpointlar — test o‘zi kalit bermasa, tasodifiy kalit qo‘shiladi.
    const needsKey = method === 'POST' && /^\/(quote-requests(\/[^/]+\/quotes)?|quotes\/[^/]+\/send|calculations\/[^/]+\/report)$/.test(path.split('?')[0]!);
    if ((options.idempotent ?? needsKey) && !Object.keys(headers).some((h) => h.toLowerCase() === 'idempotency-key')) headers['idempotency-key'] = `t-${randomUUID()}`;
    let body: BodyInit | undefined;
    if (options.rawBody !== undefined) {
      headers['content-type'] = 'application/json';
      body = options.rawBody;
    } else if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const response = await fetch(`${baseUrl}/api/v1${path}`, { method, headers, body });
    const text = await response.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
    }
    return { status: response.status, body: parsed, headers: response.headers, data: parsed?.data };
  };

  return {
    app,
    db,
    baseUrl,
    defaultIp,
    api,
    get: (path, token) => api('GET', path, { token }),
    post: (path, token, body, options) => api('POST', path, { ...options, token, body }),
    patch: (path, token, body) => api('PATCH', path, { token, body }),
    del: (path, token) => api('DELETE', path, { token }),
    close: () => app.close(),
  };
}

let phoneCounter = 0;
export function uniquePhone(): string {
  phoneCounter += 1;
  const tail = `${Date.now() % 10_000_000}${phoneCounter}`.slice(-7).padStart(7, '0');
  return `+99890${tail}`;
}

export async function createUser(h: Harness, roles: Role[] = ['CUSTOMER'], extra: { firstName?: string } = {}): Promise<TestUser> {
  const phone = uniquePhone();
  const deviceId = `dev-${randomUUID()}`;
  const user = await h.db.user.create({
    data: {
      phone,
      status: 'ACTIVE',
      firstName: extra.firstName ?? 'Test',
      lastName: 'User',
      phoneVerifiedAt: new Date(),
      userRoles: { create: roles.map((role) => ({ role })) },
      deviceSessions: { create: { deviceId } },
    },
  });
  const token = createJwt<AccessClaims>(
    { sub: user.id, roles, status: 'ACTIVE', deviceId, type: 'access' },
    TEST_ENV.JWT_SECRET,
    3600,
  );
  return { id: user.id, phone, token, roles };
}

/** Mavjud foydalanuvchi uchun sessiyali kirish tokeni (API orqali yaratilgan akkauntlar uchun). */
export async function tokenFor(h: Harness, userId: string, roles: Role[]): Promise<string> {
  const deviceId = `dev-${randomUUID()}`;
  await h.db.deviceSession.create({ data: { userId, deviceId } });
  return createJwt<AccessClaims>({ sub: userId, roles, status: 'ACTIVE', deviceId, type: 'access' }, TEST_ENV.JWT_SECRET, 3600);
}

/** Barcha bo‘limlarga huquqi bor oddiy admin (superadmin emas). */
export async function createAdmin(h: Harness, permissions: readonly string[] = ADMIN_PERMISSIONS): Promise<TestUser> {
  const user = await createUser(h, ['ADMIN'], { firstName: 'Admin' });
  await h.db.user.update({ where: { id: user.id }, data: { adminPermissions: [...permissions] } });
  return user;
}

/** Superadmin: boshqa adminlarni yaratish va boshqarish huquqiga ega admin. */
export async function createSuperAdmin(h: Harness): Promise<TestUser> {
  const user = await createUser(h, ['ADMIN'], { firstName: 'Superadmin' });
  await h.db.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  return user;
}

export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  { timeoutMs = 30_000, intervalMs = 250, label = 'condition' } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function uploadImage(
  h: Harness,
  token: string,
  kind: string,
  linkType: string,
  linkId: string,
  size = 64,
): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: size, height: size, channels: 3, background: { r: size % 255, g: 90, b: 160 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set('kind', kind);
  form.set('linkType', linkType);
  form.set('linkId', linkId);
  form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), `photo-${size}.png`);
  const res = await h.api('POST', '/media/uploads', { token, form });
  if (res.status >= 300) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  const id: string = res.data.id;
  await waitFor(
    async () => {
      const asset = await h.db.mediaAsset.findUnique({ where: { id } });
      if (asset && (asset.status === 'REJECTED' || asset.status === 'FAILED')) {
        throw new Error(`asset ${id} ended ${asset.status}: ${asset.rejectionReason ?? asset.lastError}`);
      }
      return asset?.status === 'READY';
    },
    { label: `media ${id} READY`, timeoutMs: 60_000 },
  );
  return id;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MISSING_UUID = '00000000-0000-4000-8000-00000000dead';

const DESCRIPTION = 'Integration scenario request with a sufficiently long description.';

export const soon = (): string => new Date(Date.now() + 86_400_000).toISOString();

export interface TestShop {
  shopId: string;
  owner: TestUser;
}

/** Test uchun do‘kon: OWNER a’zosi bilan (TZ 2.1 — egalik faqat ShopMember orqali). */
export async function createShop(h: Harness, over: { status?: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED' } = {}): Promise<TestShop> {
  const owner = await createUser(h, ['CUSTOMER', 'SHOP'], { firstName: 'Owner' });
  const tag = randomUUID().slice(0, 8);
  const shop = await h.db.shop.create({
    data: { slug: `test-shop-${tag}`, name: `Test shop ${tag}`, status: over.status ?? 'ACTIVE', members: { create: { userId: owner.id, memberRole: 'OWNER' } } },
  });
  return { shopId: shop.id, owner };
}
