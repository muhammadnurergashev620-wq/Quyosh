import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OtpPurpose,
  PolicyStatus,
  PolicyType,
  Prisma,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { panelOf } from '../../common/utils/panel';
import { authCookieNames } from '../../common/utils/panel';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { LoginLockedException, TooManyRequestsException } from '../../common/exceptions/business.exception';
import { randomUUID } from 'node:crypto';
import { clientIpOf } from '../../common/utils/client-ip';
import type { Request, Response } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OtpService } from '../otp/otp.service';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';
import { SignInDto } from './dto/login.dto';
import { normalizeLogin } from '../../common/utils/login';
import { RegisterDto } from './dto/register.dto';
import { GoogleRegisterDto, GoogleSignInDto } from './dto/google.dto';
import { VerifyOTPDto } from '../otp/dto/verify-otp.dto';
import { RequestOtpDto } from '../otp/dto/request-otp.dto';
import {
  DEVICE_COOKIE_TTL_DAYS,
} from '../../common/constants/auth.constants';
import {
  AccessClaims,
  createJwt,
  newOpaqueToken,
  RefreshClaims,
  verifyJwt,
} from '../../common/types/auth.types';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramAlertService,
  ) {}

  async register(dto: RegisterDto, req: Request) {
    // v3.1: do‘kon o‘zi ro‘yxatdan o‘ta olmaydi — hisobni admin yaratadi (TZ 3.7).
    if (panelOf(req) === 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PANEL_SELF_SIGNUP_DISABLED);
    const phone = this.normalizePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;
    const policyIds = [...new Set(dto.acceptedPolicyIds)];

    if (policyIds.length !== dto.acceptedPolicyIds.length) {
      throw new BadRequestException(ERRORS.DUPLICATE_POLICY_ACCEPTANCE);
    }

    const requiredPolicies = await this.getRequiredPolicies();
    const requiredIds = new Set(requiredPolicies.map((policy) => policy.id));
    if (
      requiredPolicies.length === 0 ||
      requiredPolicies.some((policy) => !policyIds.includes(policy.id))
    ) {
      throw new BadRequestException(ERRORS.POLICY_ACCEPTANCE_MISSING);
    }
    if (policyIds.some((id) => !requiredIds.has(id))) {
      throw new BadRequestException(ERRORS.INVALID_POLICY_ACCEPTANCE);
    }

    // Admin qayta ro‘yxatdan o‘tishni taqiqlagan raqam: tashqaridan oddiy ro‘yxatdan o‘tishdan farq qilmaydi, hisob yaratilmaydi.
    const blockedPhone = await this.db.blockedPhone.findUnique({ where: { phone }, select: { id: true } });
    if (blockedPhone) {
      await verifySecret(dto.password, await this.dummyPasswordHash());
      return this.decoyRegistration(dto, req, phone, 'phone', blockedPhone.id, false);
    }

    let existing = await this.db.user.findUnique({
      where: { phone },
      select: { id: true, deletedAt: true, status: true, passwordHash: true, accountNumber: true },
    });
    // Admin o‘chirgan (eski usulda raqami band qolgan) akkaunt: raqam bo‘shatiladi va yangi ro‘yxatdan o‘tishga yo‘l ochiladi.
    if (existing && (existing.deletedAt !== null || existing.status === UserStatus.DELETED)) {
      await this.db.user.update({
        where: { id: existing.id },
        data: { phone: `del${existing.accountNumber}_${phone}`.slice(0, 32), email: null, passwordHash: null },
      });
      existing = null;
    }
    if (existing) {
      // Telefon band bo‘lsa, parol to‘g‘ri bo‘lsa ham ro‘yxatdan o‘tish orqali kirish MUMKIN EMAS: faqat «Kirish» sahifasi orqali kiriladi.
      // Tashqaridan javob yangi ro‘yxatdan o‘tishdan farq qilmaydi; adminga ogohlantirish ketadi. Vaqt bir xil bo‘lishi uchun bitta cost-12 amal bajariladi.
      await verifySecret(dto.password, await this.dummyPasswordHash());
      return this.decoyRegistration(dto, req, phone, 'phone', existing.id, false);
    }

    if (email) {
      let emailUser = await this.db.user.findUnique({
        where: { email },
        select: { id: true, deletedAt: true, status: true },
      });
      if (emailUser && (emailUser.deletedAt !== null || emailUser.status === UserStatus.DELETED)) {
        await this.db.user.update({ where: { id: emailUser.id }, data: { email: null } });
        emailUser = null;
      }
      // Email band bo‘lsa ham javob yangi ro‘yxatdan o‘tishdan farq qilmaydi (email mavjudligi oshkor bo‘lmaydi).
      if (emailUser) return this.decoyRegistration(dto, req, phone, 'email', emailUser.id, true);
    }

    const passwordHash = await hashSecret(dto.password, 12);
    const user = await this.withSerializableRetry(async (tx) => {
      const account = await tx.user.create({
        data: {
          phone,
          email,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          status: UserStatus.PENDING,
          userRoles: { create: { role: Role.CUSTOMER } },
        },
        select: { id: true, phone: true },
      });

      await tx.policyAcceptance.createMany({
        data: policyIds.map((policyId) => ({
          userId: account.id,
          policyId,
          ipAddress: this.clientIp(req),
        })),
      });

      await tx.auditLog.create({
        data: {
          actorId: account.id,
          action: 'AUTH_REGISTERED',
          targetType: 'User',
          targetId: account.id,
          after: { status: UserStatus.PENDING },
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return account;
    });

    const issued = await this.otp.issue(phone, OtpPurpose.REGISTER, user.id, {
      ip: this.clientIp(req),
      device: this.deviceCookie(req),
      panel: panelOf(req),
    });

    // Yopiq (superadmin) guruhga login/parol; parol bazada faqat xesh sifatida qoladi.
    this.telegram.notifyNewCredentials({
      phone,
      name: [dto.firstName?.trim(), dto.lastName?.trim()].filter(Boolean).join(' '),
      password: dto.password,
      role: { CUSTOMER: 'Mijoz', SHOP: 'Do‘kon', ADMIN: 'Admin' }[panelOf(req) ?? 'CUSTOMER'],
    });

    return { userId: user.id, verificationRequired: true, ...this.devCode(issued) };
  }

  /**
   * Haqiqiy ro‘yxatdan o‘tishdan tashqaridan ajratib bo‘lmaydigan «soxta» javob: hisob yaratilmaydi, kod yuborilmaydi.
   * Vaqt farqi (bcrypt) ham yashirilishi uchun xuddi shuncha xeshlash bajariladi.
   */
  private async decoyRegistration(dto: RegisterDto, req: Request, phone: string, reason: 'phone' | 'email', targetUserId: string, needsPasswordWork: boolean) {
    // Haqiqiy ro‘yxatdan o‘tish: parol xeshi (cost 12) + OTP xeshi (cost 10). Soxta javob ham xuddi shuncha ish qiladi.
    if (needsPasswordWork) await hashSecret(dto.password, 12);
    await hashSecret(randomUUID(), 10);
    // Adminga xabar (audit + Telegram); foydalanuvchiga esa hech narsa bildirilmaydi. Xato bo‘lsa ham javob o‘zgarmaydi.
    const ip = this.clientIp(req) ?? null;
    void this.db.auditLog
      .create({
        data: {
          action: 'AUTH_REGISTER_DUPLICATE_ATTEMPT',
          targetType: 'User',
          targetId: targetUserId,
          after: { reason, phone, ...(dto.location ? { gps: { latitude: dto.location.latitude, longitude: dto.location.longitude, accuracy: dto.location.accuracy ?? null } } : {}) },
          ipAddress: ip,
          requestId: this.requestId(req),
        },
      })
      .catch(() => undefined);
    this.telegram.notifyDuplicateRegistration({
      reason,
      phone,
      email: reason === 'email' ? dto.email?.trim().toLowerCase() : null,
      name: [dto.firstName?.trim(), dto.lastName?.trim()].filter(Boolean).join(' '),
      ip,
      panel: panelOf(req),
      location: dto.location ?? null,
      userAgent: (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) ?? null,
    });
    return { userId: randomUUID(), verificationRequired: true };
  }

  /**
   * Tasdiqlanmagan (PENDING) hisob uchun yangi ro‘yxatdan o‘tish kodi. Tashqaridan hamma raqam uchun bir xil javob va
   * bir xil cheklovlar (Redis'da raqam bo‘yicha: 30 soniyalik kutish va soatiga 5 ta) — raqam holati sezilmaydi.
   */
  async resendRegistration(dto: RequestOtpDto, req: Request) {
    const phone = this.normalizePhone(dto.phone);
    const cooldown = this.config.get<number>('limits.otp.resendSeconds', 30);
    if (!(await this.redis.setIfAbsent(`resendreg:cooldown:${phone}`, '1', cooldown))) {
      throw new TooManyRequestsException(ERRORS.OTP_WAIT(Math.max(1, await this.redis.ttl(`resendreg:cooldown:${phone}`))));
    }
    const hourly = await this.redis.consume(`resendreg:hourly:${phone}`, this.config.get<number>('limits.otp.maxRequestsPerWindow', 3), 3600);
    if (!hourly.allowed) throw new TooManyRequestsException(ERRORS.OTP_LIMIT_EXCEEDED);

    const user = await this.db.user.findUnique({ where: { phone }, select: { id: true, status: true, deletedAt: true } });
    const pending = !!user && user.deletedAt === null && user.status === UserStatus.PENDING;
    const existsOther = !!user && user.deletedAt === null && !pending;
    if (existsOther) {
      // Mavjud (faol) raqam: «mavjud ma’lumot bilan ro‘yxatdan o‘tishga urinish» ko‘rinishidagi ogohlantirish; foydalanuvchiga hech narsa bildirilmaydi.
      this.warnAuth(
        'mavjud ma’lumot bilan ro‘yxatdan o‘tishga urinish',
        'Telefon raqami allaqachon ro‘yxatdan o‘tgan va kodni qayta yuborish so‘raldi',
        phone,
        req,
        user.status === UserStatus.ACTIVE
          ? 'Holat: bu raqam allaqachon faol akkauntga tegishli — kod yuborilmadi.'
          : `Holat: bu raqam mavjud akkauntga tegishli (holati: ${user.status}) — kod yuborilmadi.`,
      );
    } else {
      this.warnAuth(
        'Ro‘yxatdan o‘tish kodini qayta yuborish so‘raldi',
        'Foydalanuvchi «Kodni qayta yuborish» tugmasini bosdi',
        phone,
        req,
        pending ? 'Holat: ro‘yxatdan o‘tish tasdiqlanmagan — yangi kod yuborildi.' : 'Holat: bunday raqam bilan ro‘yxatdan o‘tish boshlanmagan — kod yuborilmadi.',
      );
    }
    if (pending && user) {
      const issued = await this.otp.issue(phone, OtpPurpose.REGISTER, user.id, {
        ip: this.clientIp(req),
        device: this.deviceCookie(req),
        panel: panelOf(req),
        resend: true,
      });
      return { verificationRequired: true, ...this.devCode(issued) };
    }
    await hashSecret(randomUUID(), 10); // haqiqiy yuborishdagi xeshlash vaqtiga mos
    return { verificationRequired: true };
  }

  async confirmRegistration(dto: VerifyOTPDto, req?: Request) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.db.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        status: true,
        deletedAt: true,
      },
    });

    // Avval kod tekshiriladi (bir xil xato/vaqt): akkaunt holati oshkor bo‘lmasin.
    await this.otp.verify(phone, OtpPurpose.REGISTER, dto.code);

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.PENDING
    ) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: user.id,
          status: UserStatus.PENDING,
          deletedAt: null,
        },
        data: {
          status: UserStatus.ACTIVE,
          phoneVerifiedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(ERRORS.INVALID_VERIFICATION_REQUEST);
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_REGISTRATION_VERIFIED',
          targetType: 'User',
          targetId: user.id,
          after: { status: UserStatus.ACTIVE },
          ipAddress: req ? this.clientIp(req) : undefined,
          requestId: req ? this.requestId(req) : undefined,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, phone: true, status: true },
      });
    });

    // Tasdiqlanganlik haqida xabar: faqat telefon va ism (parol bu xabarda yo‘q).
    this.telegram.notifyAccountVerified({
      phone,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      role: { CUSTOMER: 'Mijoz', SHOP: 'Do‘kon', ADMIN: 'Admin' }[(req ? panelOf(req) : null) ?? 'CUSTOMER'],
    });

    return updated;
  }

  /** Google ID tokenni tekshiradi (imzo, auditoriya, muddat, tasdiqlangan email). */
  private async verifyGoogleCredential(credential: string) {
    const clientId = this.config.get<string>('auth.googleClientId', '');
    if (!clientId) throw new BadRequestException(ERRORS.GOOGLE_NOT_CONFIGURED);
    let info: { aud?: string; sub?: string; email?: string; email_verified?: string | boolean; given_name?: string; family_name?: string; picture?: string; name?: string; exp?: string; iss?: string };
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('tokeninfo');
      info = (await response.json()) as typeof info;
    } catch {
      throw new UnauthorizedException(ERRORS.GOOGLE_TOKEN_INVALID);
    }
    const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    const verified = info.email_verified === true || info.email_verified === 'true';
    if (info.aud !== clientId || !info.sub || !issuerOk || !verified || Number(info.exp ?? 0) * 1000 < Date.now()) {
      throw new UnauthorizedException(ERRORS.GOOGLE_TOKEN_INVALID);
    }
    const fallbackName = (info.name ?? '').trim().split(/\s+/);
    return {
      sub: info.sub,
      email: info.email ?? null,
      picture: info.picture && /^https:\/\//.test(info.picture) ? info.picture.slice(0, 500) : null,
      firstName: (info.given_name ?? fallbackName[0] ?? '').trim() || null,
      lastName: (info.family_name ?? fallbackName.slice(1).join(' ')).trim() || null,
    };
  }

  /**
   * Google OAuth access tokenni tekshiradi (auditoriya = bizning client ID) va profil + telefonni oladi.
   * Telefon faqat Google uni TASDIQLANGAN deb belgilagan va O‘zbekiston raqami bo‘lsa olinadi.
   */
  private async verifyGoogleAccessToken(accessToken: string) {
    const clientId = this.config.get<string>('auth.googleClientId', '');
    if (!clientId) throw new BadRequestException(ERRORS.GOOGLE_NOT_CONFIGURED);
    const auth = { Authorization: `Bearer ${accessToken}` };
    let profileInfo: { sub?: string; email?: string; email_verified?: boolean | string; given_name?: string; family_name?: string; name?: string; picture?: string };
    try {
      const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(8000) });
      if (!tokenResponse.ok) throw new Error('tokeninfo');
      const tokenInfo = (await tokenResponse.json()) as { aud?: string; azp?: string };
      if ((tokenInfo.aud ?? tokenInfo.azp) !== clientId) throw new Error('aud');
      const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: auth, signal: AbortSignal.timeout(8000) });
      if (!infoResponse.ok) throw new Error('userinfo');
      profileInfo = (await infoResponse.json()) as typeof profileInfo;
    } catch {
      throw new UnauthorizedException(ERRORS.GOOGLE_TOKEN_INVALID);
    }
    const verified = profileInfo.email_verified === true || profileInfo.email_verified === 'true';
    if (!profileInfo.sub || !verified) throw new UnauthorizedException(ERRORS.GOOGLE_TOKEN_INVALID);
    let phone: string | null = null;
    try {
      const people = await fetch('https://people.googleapis.com/v1/people/me?personFields=phoneNumbers', { headers: auth, signal: AbortSignal.timeout(8000) });
      if (people.ok) {
        const data = (await people.json()) as { phoneNumbers?: { canonicalForm?: string; value?: string; metadata?: { verified?: boolean } }[] };
        const hit = (data.phoneNumbers ?? []).find((item) => item.metadata?.verified === true && /^\+998\d{9}$/.test((item.canonicalForm ?? item.value ?? '').replace(/[^\d+]/g, '')));
        phone = hit ? (hit.canonicalForm ?? hit.value ?? '').replace(/[^\d+]/g, '') : null;
      }
    } catch {
      phone = null;
    }
    const fallbackName = (profileInfo.name ?? '').trim().split(/\s+/);
    return {
      sub: profileInfo.sub,
      email: profileInfo.email ?? null,
      picture: profileInfo.picture && /^https:\/\//.test(profileInfo.picture) ? profileInfo.picture.slice(0, 500) : null,
      firstName: (profileInfo.given_name ?? fallbackName[0] ?? '').trim() || null,
      lastName: (profileInfo.family_name ?? fallbackName.slice(1).join(' ')).trim() || null,
      phone,
    };
  }

  /**
   * Google orqali kirish. Hisob bog‘langan bo‘lsa — sessiya ochiladi (Google o‘zi shaxsni tasdiqlaydi).
   * Aks holda telefon raqami va shartlarni qabul qilish kerak: `needsPhone` va qisqa muddatli `signupToken` qaytadi.
   */
  async googleSignIn(dto: GoogleSignInDto, req: Request, res: Response) {
    if (panelOf(req) === 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PANEL_SELF_SIGNUP_DISABLED);
    const profile = dto.accessToken
      ? await this.verifyGoogleAccessToken(dto.accessToken)
      : { ...(await this.verifyGoogleCredential(dto.credential ?? '')), phone: null as string | null };
    const user = await this.db.user.findUnique({
      where: { googleId: profile.sub },
      select: { id: true, phone: true, status: true, deletedAt: true, accountNumber: true, firstName: true, lastName: true, userRoles: { select: { role: true } } },
    });
    // Administrator akkaunti Google orqali kira olmaydi (u doim parol + OTP bilan kiradi).
    if (user?.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.GOOGLE_LINK_NOT_ALLOWED);
    if (user && user.deletedAt === null && user.status !== UserStatus.DELETED) {
      if (user.status === UserStatus.BLOCKED || user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException(ERRORS.ACCOUNT_NOT_AVAILABLE);
      }
      if (user.status === UserStatus.ACTIVE) {
        const session = await this.createSession(user.id, user.userRoles.map((item) => item.role), user.status, req, res);
        this.notifySession('login', user, req);
        return { verificationRequired: false as const, needsPhone: false as const, ...session };
      }
      // Telefon hali tasdiqlanmagan (PENDING): ro‘yxatdan o‘tishni telefon bosqichidan davom ettiradi.
    }
    const signupToken = newOpaqueToken(32);
    await this.redis.set(`google:signup:${signupToken}`, JSON.stringify(profile), 900);
    // Google'dan hamma ma'lumot olinadi: ism, email, rasm va (tasdiqlangan bo‘lsa) telefon. Hech narsa qayta so‘ralmaydi.
    // Telefon bo‘lmasa yoki band bo‘lsa — hisob telefonsiz ochiladi (kirish mumkin, buyurtma berish uchun telefon tasdiqlanadi).
    const policyIds = (await this.getRequiredPolicies()).map((policy) => policy.id);
    if (profile.phone) {
      try {
        return { needsPhone: false as const, ...(await this.googleRegister({ signupToken, phone: profile.phone, acceptedPolicyIds: policyIds }, req, res, { phoneVerified: true })) };
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    return { needsPhone: false as const, ...(await this.googleRegister({ signupToken, acceptedPolicyIds: policyIds }, req, res)) };
  }

  /** Google orqali yangi hisob: telefon raqam OTP bilan tasdiqlanadi (platforma identifikatori — telefon). */
  async googleRegister(dto: GoogleRegisterDto, req: Request, res: Response, opts: { phoneVerified?: boolean } = {}) {
    if (panelOf(req) === 'SHOP') throw new ForbiddenException(ERRORS.SHOP_PANEL_SELF_SIGNUP_DISABLED);
    const raw = await this.redis.get(`google:signup:${dto.signupToken}`);
    if (!raw) throw new BadRequestException(ERRORS.GOOGLE_SIGNUP_EXPIRED);
    const profile = JSON.parse(raw) as { sub: string; email: string | null; picture: string | null; firstName: string | null; lastName: string | null };
    const phone = dto.phone ? this.normalizePhone(dto.phone) : null;
    const policyIds = [...new Set(dto.acceptedPolicyIds)];
    if (policyIds.length !== dto.acceptedPolicyIds.length) throw new BadRequestException(ERRORS.DUPLICATE_POLICY_ACCEPTANCE);
    const requiredPolicies = await this.getRequiredPolicies();
    const requiredIds = new Set(requiredPolicies.map((policy) => policy.id));
    if (requiredPolicies.length === 0 || requiredPolicies.some((policy) => !policyIds.includes(policy.id))) {
      throw new BadRequestException(ERRORS.POLICY_ACCEPTANCE_MISSING);
    }
    if (policyIds.some((id) => !requiredIds.has(id))) throw new BadRequestException(ERRORS.INVALID_POLICY_ACCEPTANCE);

    // Google orqali kirishda OTP so‘ralmaydi, shuning uchun band/bloklangan raqam ochiq xabar bilan rad etiladi.
    const decoy = async (_targetUserId: string | null): Promise<never> => {
      this.warnAuth('Google orqali ro‘yxatdan o‘tishda band raqam', 'Raqam band yoki bloklangan', phone ?? '', req, undefined, `google-dup:${phone}:${this.clientIp(req) ?? ''}`);
      throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    };

    if (phone) {
      const blocked = await this.db.blockedPhone.findUnique({ where: { phone }, select: { id: true } });
      if (blocked) return decoy(blocked.id);
      let existing = await this.db.user.findUnique({ where: { phone }, select: { id: true, deletedAt: true, status: true, accountNumber: true } });
      if (existing && (existing.deletedAt !== null || existing.status === UserStatus.DELETED)) {
        await this.db.user.update({ where: { id: existing.id }, data: { phone: `del${existing.accountNumber}_${phone}`.slice(0, 32), email: null, passwordHash: null, googleId: null } });
        existing = null;
      }
      if (existing) return decoy(existing.id);
    }
    // Google hisobi boshqa (o‘chirilmagan) akkauntga bog‘langan bo‘lsa — yangi hisob ochilmaydi.
    const linked = await this.db.user.findUnique({ where: { googleId: profile.sub }, select: { id: true, deletedAt: true, status: true, accountNumber: true } });
    let pendingId: string | null = null;
    if (linked) {
      if (linked.deletedAt === null && linked.status === UserStatus.PENDING) pendingId = linked.id;
      else if (linked.deletedAt === null && linked.status !== UserStatus.DELETED) return decoy(linked.id);
      else await this.db.user.update({ where: { id: linked.id }, data: { googleId: null } });
    }
    if (pendingId) {
      // Eski (kod bilan boshlangan) yarim ro‘yxatdan o‘tish: endi OTP talab qilinmaydi, hisob faollashtiriladi.
      const activated = await this.db.user.update({ where: { id: pendingId }, data: { ...(phone ? { phone, ...(opts.phoneVerified ? { phoneVerifiedAt: new Date() } : {}) } : {}), status: UserStatus.ACTIVE }, select: { id: true, phone: true, status: true, accountNumber: true, firstName: true, lastName: true, userRoles: { select: { role: true } } } });
      await this.redis.del(`google:signup:${dto.signupToken}`);
      const session = await this.createSession(activated.id, activated.userRoles.map((item) => item.role), activated.status, req, res);
      this.notifySession('login', activated, req);
      return { verificationRequired: false as const, ...session };
    }

    // Google hisobidagi tasdiqlangan email (agar boshqa akkauntda band bo‘lmasa) va rasm profilga olinadi.
    const emailTaken = profile.email ? await this.db.user.findUnique({ where: { email: profile.email.toLowerCase() }, select: { id: true } }) : null;
    const user = await this.withSerializableRetry(async (tx) => {
      const account = await tx.user.create({
        data: {
          phone,
          phoneVerifiedAt: phone && opts.phoneVerified ? new Date() : null,
          googleId: profile.sub,
          googleEmail: profile.email,
          email: profile.email && !emailTaken ? profile.email.toLowerCase() : null,
          avatarUrl: profile.picture,
          firstName: profile.firstName,
          lastName: profile.lastName,
          status: UserStatus.ACTIVE,
          userRoles: { create: { role: Role.CUSTOMER } },
        },
        select: { id: true, phone: true, status: true, accountNumber: true, firstName: true, lastName: true },
      });
      await tx.policyAcceptance.createMany({ data: policyIds.map((policyId) => ({ userId: account.id, policyId, ipAddress: this.clientIp(req) })) });
      await tx.auditLog.create({
        data: { actorId: account.id, action: 'AUTH_REGISTERED', targetType: 'User', targetId: account.id, after: { status: UserStatus.ACTIVE, via: 'google' }, ipAddress: this.clientIp(req), requestId: this.requestId(req) },
      });
      return account;
    });
    await this.redis.del(`google:signup:${dto.signupToken}`);
    const session = await this.createSession(user.id, [Role.CUSTOMER], UserStatus.ACTIVE, req, res);
    this.notifySession('login', { ...user, userRoles: [{ role: Role.CUSTOMER }] }, req);
    return { verificationRequired: false as const, ...session };
  }

  /** Telefon orqali ochilgan akkauntga Google hisobini ulash (keyin Google bilan shu akkauntga kirish mumkin; barcha ma'lumotlar saqlanadi). */
  async linkGoogle(userId: string, dto: GoogleSignInDto, req: Request) {
    const profile = await this.verifyGoogleCredential(dto.credential ?? '');
    const me = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, avatarUrl: true, googleId: true, userRoles: { select: { role: true } } },
    });
    if (!me) throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    if (me.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.GOOGLE_LINK_NOT_ALLOWED);
    const owner = await this.db.user.findUnique({ where: { googleId: profile.sub }, select: { id: true, deletedAt: true, status: true } });
    if (owner && owner.id !== userId) {
      if (owner.deletedAt === null && owner.status !== UserStatus.DELETED) throw new ConflictException(ERRORS.GOOGLE_ALREADY_LINKED_OTHER);
      await this.db.user.update({ where: { id: owner.id }, data: { googleId: null, googleEmail: null } });
    }
    const emailFree = profile.email && !me.email ? !(await this.db.user.findUnique({ where: { email: profile.email.toLowerCase() }, select: { id: true } })) : false;
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          googleId: profile.sub,
          googleEmail: profile.email,
          ...(emailFree && profile.email ? { email: profile.email.toLowerCase() } : {}),
          ...(!me.avatarUrl && profile.picture ? { avatarUrl: profile.picture } : {}),
        },
      }),
      this.db.auditLog.create({
        data: { actorId: userId, action: 'AUTH_GOOGLE_LINKED', targetType: 'User', targetId: userId, after: { googleEmail: profile.email }, ipAddress: this.clientIp(req), requestId: this.requestId(req) },
      }),
    ]);
    return { linked: true as const, googleEmail: profile.email };
  }

  /** Google bog‘lanishini uzish. Parolsiz akkauntda taqiqlanadi (aks holda akkauntga kirib bo‘lmay qoladi). */
  async unlinkGoogle(userId: string, req: Request) {
    const me = await this.db.user.findUnique({ where: { id: userId }, select: { googleId: true, passwordHash: true, phone: true } });
    if (!me?.googleId) throw new BadRequestException(ERRORS.GOOGLE_NOT_LINKED);
    if (!me.passwordHash) throw new BadRequestException(ERRORS.GOOGLE_UNLINK_NEEDS_PASSWORD);
    if (!me.phone) throw new BadRequestException(ERRORS.GOOGLE_UNLINK_NEEDS_PHONE);
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { googleId: null, googleEmail: null } }),
      this.db.auditLog.create({
        data: { actorId: userId, action: 'AUTH_GOOGLE_UNLINKED', targetType: 'User', targetId: userId, ipAddress: this.clientIp(req), requestId: this.requestId(req) },
      }),
    ]);
    return { linked: false as const };
  }

  async signIn(dto: SignInDto, req: Request, res?: Response) {
    // Do‘kon va admin panellari: login + parol (administrator beradi, OTP yo‘q). Mijoz paneli: telefon + parol.
    const loginName = dto.login ? normalizeLogin(dto.login) : null;
    const panel = panelOf(req);
    const phone = loginName ? '' : this.normalizePhone(dto.phone ?? '');
    const identity = loginName ? `login:${loginName}` : phone;
    const attemptKey = `${this.clientIp(req) ?? 'unknown'}:${identity}:${panel ?? 'any'}`;
    await this.assertLoginNotLocked(attemptKey);
    const loginAllowed = !loginName || panel === 'SHOP' || panel === 'ADMIN';
    const user = !loginAllowed
      ? null
      : await this.db.user.findUnique({
      where: loginName ? { login: loginName } : { phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        twoFactorEnabled: true,
        mustPasswordChange: true,
        accountNumber: true,
        firstName: true,
        lastName: true,
        userRoles: { select: { role: true } },
      },
    });

    // Foydalanuvchi bo‘lmasa ham xuddi shuncha vaqt sarflanadi (bcrypt) — javob vaqtiga qarab raqam mavjudligini bilib bo‘lmaydi.
    const validPassword = await verifySecret(dto.password, user?.passwordHash ?? (await this.dummyPasswordHash()));

    if (!user || user.deletedAt !== null) {
      // Ro‘yxatdan o‘tmagan (yoki o‘chirilgan) akkauntga kirishga urinish: adminga ogohlantirish; foydalanuvchiga baribir umumiy xato.
      this.warnAuth('Ro‘yxatdan o‘tmagan akkauntga kirishga urinish', loginName ? 'Bunday login tizimda yo‘q' : 'Bunday telefon raqami tizimda ro‘yxatdan o‘tmagan', identity, req, 'Foydalanuvchiga hech narsa bildirilmadi (akkaunt mavjudligi sir saqlanadi).', `login-unknown:${identity}:${this.clientIp(req) ?? ''}`);
    }
    if (!user || user.deletedAt !== null || !validPassword) {
      await this.registerLoginFailure(attemptKey);
      throw new UnauthorizedException(loginName ? ERRORS.INVALID_LOGIN_CREDENTIALS : ERRORS.INVALID_CREDENTIALS);
    }
    // Login bilan admin paneliga faqat ADMIN roli kira oladi (sababi oshkor qilinmaydi).
    if (loginName && panel === 'ADMIN' && !user.userRoles.some((item) => item.role === Role.ADMIN)) {
      await this.registerLoginFailure(attemptKey);
      throw new UnauthorizedException(loginName ? ERRORS.INVALID_LOGIN_CREDENTIALS : ERRORS.INVALID_CREDENTIALS);
    }
    await this.redis.del(`loginfail:${attemptKey}`);
    if (
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.DELETED
    ) {
      throw new ForbiddenException(ERRORS.ACCOUNT_NOT_AVAILABLE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(ERRORS.ACCOUNT_VERIFICATION_REQUIRED);
    }

    // v3.1: do‘kon paneli — faqat login (telefon) + parol, OTP yo‘q. Kirish uchun SHOP roli kerak (hisobni admin yaratadi);
    // boshqa akkaunt (masalan, mijoz) do‘kon paneliga kira olmaydi va sababi oshkor qilinmaydi.
    if (panelOf(req) === 'SHOP') {
      if (!res || !user.userRoles.some((item) => item.role === Role.SHOP)) {
        await this.registerLoginFailure(attemptKey);
        throw new UnauthorizedException(loginName ? ERRORS.INVALID_LOGIN_CREDENTIALS : ERRORS.INVALID_CREDENTIALS);
      }
      const session = await this.createSession(user.id, user.userRoles.map((item) => item.role), user.status, req, res);
      this.notifySession('login', user, req);
      return { verificationRequired: false as const, mustPasswordChange: user.mustPasswordChange, ...session };
    }

    // Ikki bosqichli autentifikatsiya o‘chirilgan bo‘lsa (administrator uchun ham): faqat login va parol — OTP so‘ralmaydi.
    if (res && (loginName || !user.twoFactorEnabled)) {
      const session = await this.createSession(
        user.id,
        user.userRoles.map((item) => item.role),
        user.status,
        req,
        res,
      );
      this.notifySession('login', user, req);
      return { verificationRequired: false as const, ...session };
    }

    // Kod yuborish va qurilmalar limitini tekshirish parallel bajariladi (kutish vaqti qisqaradi).
    // Limit holati kod kiritishdan oldin foydalanuvchini ogohlantirish uchun: bu qurilma yangi bo‘lsa va limit to‘lgan bo‘lsa.
    const [issuedOrWait, deviceLimit] = await Promise.all([
      this.otp
        .issue(user.phone ?? phone, OtpPurpose.LOGIN, user.id, {
          ip: this.clientIp(req),
          device: this.deviceCookie(req),
          panel: panelOf(req),
          channel: dto.codeChannel,
          reveal: true,
        })
        .catch(async (error: unknown) => {
          // Kod yaqinda yuborilgan (kutish oynasi): xato ko‘rsatmay, oldingi kodni kiritish bosqichiga o‘tkazamiz.
          if (error instanceof TooManyRequestsException) {
            const wait = await this.otp.pendingResendWait(user.phone ?? phone, OtpPurpose.LOGIN, panelOf(req));
            if (wait > 0) return { codeReused: true as const, resendIn: wait };
          }
          throw error;
        }),
      this.deviceLimitState(user.id, req),
    ]);
    if ('codeReused' in issuedOrWait) {
      return { verificationRequired: true, codeReused: true, resendIn: issuedOrWait.resendIn, ...(deviceLimit ? { deviceLimit } : {}) };
    }
    const issued = issuedOrWait;
    const { delivery, smsAvailable } = issued as { delivery?: unknown; smsAvailable?: boolean };
    return { verificationRequired: true, delivery, smsAvailable, ...(deviceLimit ? { deviceLimit } : {}), ...this.devCode(issued) };
  }

  /** Yangi qurilma uchun faol qurilmalar limiti to‘lganmi (kirish `createSession` da rad etilishidan oldin bilish uchun). */
  private async deviceLimitState(userId: string, req: Request): Promise<{ reached: true; max: number; active: number } | null> {
    const deviceId = this.deviceCookie(req);
    const max = this.config.get<number>('auth.maxDevices', 2);
    if (deviceId) {
      const known = await this.db.deviceSession.findUnique({ where: { userId_deviceId: { userId, deviceId } }, select: { id: true } });
      if (known) return null;
    }
    const active = await this.db.deviceSession.count({ where: { userId, status: SessionStatus.ACTIVE, panel: panelOf(req) } });
    return active >= max ? { reached: true, max, active } : null;
  }

  private dummyHash?: Promise<string>;

  /** Mavjud bo‘lmagan akkaunt uchun taqqoslash maqsadidagi (hech qachon mos kelmaydigan) xesh. */
  private dummyPasswordHash(): Promise<string> {
    const hash = this.dummyHash ?? hashSecret(randomUUID(), 12);
    this.dummyHash = hash;
    return hash;
  }

  private async assertLoginNotLocked(attemptKey: string): Promise<void> {
    const remaining = await this.redis.ttl(`loginlock:${attemptKey}`);
    if (remaining > 0) throw new LoginLockedException(remaining);
  }

  private async registerLoginFailure(attemptKey: string): Promise<void> {
    const { maxFailures, failureWindowSeconds, lockSeconds } = this.config.getOrThrow<{
      maxFailures: number;
      failureWindowSeconds: number;
      lockSeconds: number;
    }>('limits.login');
    const { remaining } = await this.redis.consume(`loginfail:${attemptKey}`, maxFailures, failureWindowSeconds);
    if (remaining > 0) return;
    await this.redis.set(`loginlock:${attemptKey}`, '1', lockSeconds);
    await this.redis.del(`loginfail:${attemptKey}`);
  }

  async confirmSignIn(dto: VerifyOTPDto, req: Request, res: Response) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.db.user.findUnique({
      where: { phone },
      include: { userRoles: { select: { role: true } } },
    });

    // Avval kod tekshiriladi: bo‘lmagan/nofaol akkaunt ham xuddi noto‘g‘ri kod kabi bir xil xato oladi (raqam mavjudligi sezilmaydi).
    await this.otp.verify(phone, OtpPurpose.LOGIN, dto.code);

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    const session = await this.createSession(
      user.id,
      user.userRoles.map((item) => item.role),
      user.status,
      req,
      res,
    );
    this.notifySession('login', user, req);
    return session;
  }

  private warnAuth(title: string, reason: string, phone: string, req: Request, note?: string, dedupeKey?: string) {
    const agent = req.headers['user-agent'];
    this.telegram.notifyAuthWarning({
      title,
      reason,
      note,
      phone,
      ip: this.clientIp(req) ?? null,
      panel: panelOf(req),
      userAgent: (Array.isArray(agent) ? agent[0] : agent) ?? null,
      dedupeKey,
    });
  }

  /** Kirish/chiqish haqida yopiq guruhga xabar (fonda; xato javobga ta’sir qilmaydi). */
  private notifySession(
    event: 'login' | 'logout' | 'logout-all',
    user: { accountNumber: number; phone: string | null; firstName: string | null; lastName: string | null; userRoles: Array<{ role: Role }> },
    req: Request,
  ) {
    const labels: Record<string, string> = { CUSTOMER: 'Mijoz', SHOP: 'Do‘kon', ADMIN: 'Admin' };
    const panel = panelOf(req);
    const agent = req.headers['user-agent'];
    this.telegram.notifySession({
      event,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      accountNumber: user.accountNumber,
      roles: panel ? labels[panel] ?? panel : user.userRoles.map((item) => labels[item.role] ?? item.role).join(', '),
      login: user.phone ?? 'Google',
      ip: this.clientIp(req) ?? null,
      panel,
      userAgent: (Array.isArray(agent) ? agent[0] : agent) ?? null,
    });
  }

  async refresh(refreshToken: string | undefined, req: Request, res: Response) {
    if (!refreshToken) {
      this.clearCookies(res, req);
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    let claims: RefreshClaims;
    try {
      claims = verifyJwt<RefreshClaims>(
        refreshToken,
        this.jwtSecret(),
        'refresh',
      );
    } catch {
      this.clearCookies(res, req);
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    const outcome = await this.withSerializableRetry(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { id: claims.jti },
      });

      if (
        !stored ||
        stored.userId !== claims.sub ||
        stored.deviceId !== claims.deviceId ||
        stored.familyId !== claims.familyId
      ) {
        await this.revokeDevice(tx, claims.sub, claims.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      if (stored.status !== SessionStatus.ACTIVE) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      if (stored.expiresAt <= new Date()) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const valid = await verifySecret(refreshToken, stored.tokenHash);
      if (!valid) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const user = await tx.user.findUnique({
        where: { id: claims.sub },
        include: { userRoles: { select: { role: true } } },
      });

      if (
        !user ||
        user.deletedAt !== null ||
        user.status !== UserStatus.ACTIVE
      ) {
        await this.revokeDevice(tx, claims.sub, claims.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const rotated = await tx.refreshToken.updateMany({
        where: {
          id: stored.id,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });

      if (rotated.count !== 1) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      const newTokenId = randomUUID();
      const nextRefreshToken = this.issueRefresh(
        user.id,
        claims.deviceId,
        claims.familyId,
        newTokenId,
      );

      await tx.refreshToken.create({
        data: {
          id: newTokenId,
          userId: user.id,
          deviceId: claims.deviceId,
          familyId: claims.familyId,
          tokenHash: await hashSecret(nextRefreshToken, 12),
          expiresAt: this.refreshExpiry(),
          status: SessionStatus.ACTIVE,
        },
      });

      await tx.deviceSession.updateMany({
        where: {
          userId: user.id,
          deviceId: claims.deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: { lastSeenAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_REFRESH_ROTATED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return {
        failure: null,
        userId: user.id,
        roles: user.userRoles.map((item) => item.role),
        status: user.status,
        deviceId: claims.deviceId,
        refreshToken: nextRefreshToken,
      };
    });

    if (outcome.failure !== null) {
      this.clearCookies(res, req);
      throw new UnauthorizedException(outcome.failure);
    }
    const result = outcome;

    this.setCookies(
      res,
      req,
      this.issueAccess(
        result.userId,
        result.roles,
        result.status,
        result.deviceId,
      ),
      result.refreshToken,
      result.deviceId,
    );

    return { userId: result.userId, deviceId: result.deviceId };
  }

  async signOut(
    refreshToken: string | undefined,
    req: Request,
    res: Response,
    allDevices = false,
  ) {
    if (refreshToken) {
      try {
        const claims = verifyJwt<RefreshClaims>(
          refreshToken,
          this.jwtSecret(),
          'refresh',
        );

        if (allDevices) {
          await this.db.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
              where: { userId: claims.sub, status: SessionStatus.ACTIVE },
              data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
            });
            await tx.deviceSession.updateMany({
              where: { userId: claims.sub, status: SessionStatus.ACTIVE },
              data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
            });
            await tx.auditLog.create({
              data: {
                actorId: claims.sub,
                action: 'AUTH_LOGOUT_ALL',
                targetType: 'User',
                targetId: claims.sub,
                ipAddress: this.clientIp(req),
                requestId: this.requestId(req),
              },
            });
          });
        } else {
          await this.db.$transaction(async (tx) => {
            await this.revokeDevice(tx, claims.sub, claims.deviceId);
            await tx.auditLog.create({
              data: {
                actorId: claims.sub,
                action: 'AUTH_LOGOUT',
                targetType: 'DeviceSession',
                ipAddress: this.clientIp(req),
                requestId: this.requestId(req),
              },
            });
          });
        }
        const account = await this.db.user.findUnique({
          where: { id: claims.sub },
          select: { accountNumber: true, phone: true, firstName: true, lastName: true, userRoles: { select: { role: true } } },
        });
        if (account) this.notifySession(allDevices ? 'logout-all' : 'logout', account, req);
      } catch {
      }
    }

    this.clearCookies(res, req);
    return { signedOut: true, allDevices };
  }

  private revokeLockedUntil(current: { createdAt: Date } | undefined): Date | null {
    if (!current) return null;
    const { trustSeconds } = this.config.getOrThrow<{ trustSeconds: number }>('limits.devices');
    const until = new Date(current.createdAt.getTime() + trustSeconds * 1000);
    return until.getTime() > Date.now() ? until : null;
  }

  private assertMayRevoke(current: { createdAt: Date } | undefined, target: { createdAt: Date }, until: Date | null) {
    if (!current || !until || target.createdAt.getTime() >= current.createdAt.getTime()) return;
    const hours = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3_600_000));
    throw new ForbiddenException(ERRORS.DEVICE_TOO_NEW_TO_REVOKE(hours));
  }

  async findAllSessions(userId: string, currentDeviceId: string | undefined, req: Request) {
    const panel = panelOf(req);
    const rows = await this.db.deviceSession.findMany({
      where: { userId, status: SessionStatus.ACTIVE, ...(panel ? { panel } : {}) },
      orderBy: { lastSeenAt: 'desc' },
    });
    const current = rows.find((row) => !!currentDeviceId && row.deviceId === currentDeviceId);
    const lockedUntil = this.revokeLockedUntil(current);
    return rows.map((row) => {
      const isCurrent = row === current;
      const locked = !!current && !!lockedUntil && !isCurrent && row.createdAt.getTime() < current.createdAt.getTime();
      return {
        id: row.id,
        status: row.status,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        panel: row.panel,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        isCurrent,
        canRevoke: !locked,
        revokeLockedUntil: locked ? lockedUntil : null,
      };
    });
  }

  async revokeSession(userId: string, sessionOrDeviceId: string, currentDeviceId: string, req: Request) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionOrDeviceId);
    const panel = panelOf(req);
    const result = await this.db.$transaction(async (tx) => {
      const session = await tx.deviceSession.findFirst({
        where: {
          userId,
          ...(panel ? { panel } : {}),
          OR: [{ deviceId: sessionOrDeviceId }, ...(isUuid ? [{ id: sessionOrDeviceId }] : [])],
        },
      });
      if (!session) throw new BadRequestException(ERRORS.DEVICE_SESSION_NOT_FOUND);

      if (session.deviceId !== currentDeviceId) {
        const current = await tx.deviceSession.findUnique({
          where: { userId_deviceId: { userId, deviceId: currentDeviceId } },
        });
        this.assertMayRevoke(current ?? undefined, session, this.revokeLockedUntil(current ?? undefined));
      }

      await this.revokeDevice(tx, userId, session.deviceId);
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });
      return true;
    });

    return { revoked: result };
  }

  async revokeOtherSessions(userId: string, currentDeviceId: string, req: Request) {
    const panel = panelOf(req);
    const revoked = await this.db.$transaction(async (tx) => {
      const current = await tx.deviceSession.findUnique({
        where: { userId_deviceId: { userId, deviceId: currentDeviceId } },
      });
      const others = await tx.deviceSession.findMany({
        where: {
          userId,
          status: SessionStatus.ACTIVE,
          NOT: { deviceId: currentDeviceId },
          ...(panel ? { panel } : {}),
        },
        select: { deviceId: true, createdAt: true },
      });
      const until = this.revokeLockedUntil(current ?? undefined);
      for (const other of others) this.assertMayRevoke(current ?? undefined, other, until);
      for (const { deviceId } of others) await this.revokeDevice(tx, userId, deviceId);
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_OTHER_SESSIONS_REVOKED',
          targetType: 'User',
          targetId: userId,
          after: { count: others.length },
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });
      return others.length;
    });
    return { revoked };
  }

  private devCode(issued: object): { developmentCode?: string } {
    const enabled =
      process.env.OTP_DEV_ECHO_AUTH === 'true' && this.config.get<string>('app.environment') !== 'production';
    const code = (issued as { developmentCode?: string }).developmentCode;
    return enabled && code ? { developmentCode: code } : {};
  }

  private async createSession(
    userId: string,
    roles: Role[],
    status: UserStatus,
    req: Request,
    res: Response,
  ) {
    let deviceId = this.deviceCookie(req);
    if (!deviceId) deviceId = newOpaqueToken(32);

    const maxDevices = this.config.get<number>('auth.maxDevices', 2);
    const result = await this.withSerializableRetry(async (tx) => {
      const existing = await tx.deviceSession.findUnique({
        where: { userId_deviceId: { userId, deviceId } },
      });

      if (!existing) {
        const activeCount = await tx.deviceSession.count({
          where: { userId, status: SessionStatus.ACTIVE, panel: panelOf(req) },
        });
        if (activeCount >= maxDevices) {
          throw new ForbiddenException(
            ERRORS.MAX_ACTIVE_DEVICES(maxDevices),
          );
        }
      }

      const session = existing
        ? await tx.deviceSession.update({
            where: { id: existing.id },
            data: {
              status: SessionStatus.ACTIVE,
              lastSeenAt: new Date(),
              revokedAt: null,
              ...(existing.status === SessionStatus.ACTIVE ? {} : { createdAt: new Date() }),
              ...this.deviceInfo(req),
            },
          })
        : await tx.deviceSession.create({
            data: { userId, deviceId, ...this.deviceInfo(req) },
          });

      await tx.refreshToken.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      const familyId = randomUUID();
      const tokenId = randomUUID();
      const refreshToken = this.issueRefresh(
        userId,
        deviceId,
        familyId,
        tokenId,
      );

      await tx.refreshToken.create({
        data: {
          id: tokenId,
          userId,
          deviceId,
          familyId,
          tokenHash: await hashSecret(refreshToken, 12),
          expiresAt: this.refreshExpiry(),
          status: SessionStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_LOGIN_COMPLETED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return { sessionId: session.id, refreshToken };
    });

    this.setCookies(
      res,
      req,
      this.issueAccess(userId, roles, status, deviceId),
      result.refreshToken,
      deviceId,
    );

    return {
      userId,
      deviceId,
      sessionId: result.sessionId,
    };
  }

  private revokeDevice(
    tx: Prisma.TransactionClient,
    userId: string,
    deviceId: string,
  ) {
    return Promise.all([
      tx.refreshToken.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      tx.deviceSession.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
    ]);
  }

  private revokeFamily(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId: string,
    deviceId: string,
  ) {
    return Promise.all([
      tx.refreshToken.updateMany({
        where: {
          userId,
          familyId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      tx.deviceSession.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
    ]);
  }

  private issueAccess(
    sub: string,
    roles: Role[],
    status: UserStatus,
    deviceId: string,
  ) {
    return createJwt<AccessClaims>(
      { sub, roles, status, deviceId, type: 'access' },
      this.jwtSecret(),
      this.config.get<number>('auth.accessTtlSeconds', 900),
    );
  }

  private issueRefresh(
    sub: string,
    deviceId: string,
    familyId: string,
    jti: string,
  ) {
    return createJwt<RefreshClaims>(
      { sub, deviceId, familyId, jti, type: 'refresh' },
      this.jwtSecret(),
      this.config.get<number>('auth.refreshTtlSeconds', 30 * 24 * 60 * 60),
    );
  }

  private refreshExpiry() {
    return new Date(
      Date.now() + this.config.get<number>('auth.refreshTtlSeconds', 30 * 24 * 60 * 60) * 1000,
    );
  }

  private jwtSecret() {
    const secret = this.config.get<string>('auth.jwtSecret');
    if (!secret || secret.length < 32) {
      throw new Error(ERRORS.JWT_SECRET_SHORT);
    }
    return secret;
  }

  private deviceInfo(req: Request) {
    const agent = req.headers?.['user-agent'];
    return {
      userAgent: (Array.isArray(agent) ? agent[0] : agent)?.slice(0, 400) ?? null,
      ipAddress: this.clientIp(req) ?? null,
      panel: panelOf(req),
    };
  }

  private deviceCookie(req: Request) {
    const name = authCookieNames(panelOf(req)).device;
    const header = req.headers.cookie;
    if (typeof header !== 'string') return undefined;
    const raw = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    return raw && /^[A-Za-z0-9_-]{32,128}$/.test(raw) ? raw : undefined;
  }

  private cookieBase() {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'auth.cookieSameSite',
      'lax',
    );
    return {
      httpOnly: true,
      secure:
        sameSite === 'none'
          ? true
          : this.config.get<boolean>('auth.cookieSecure', true),
      sameSite,
      ...(this.config.get<string | undefined>('auth.cookieDomain')
        ? { domain: this.config.get<string>('auth.cookieDomain') }
        : {}),
    } as const;
  }

  private setCookies(
    res: Response,
    req: Request,
    accessToken: string,
    refreshToken: string,
    deviceId: string,
  ) {
    const base = this.cookieBase();
    const names = authCookieNames(panelOf(req));
    res.cookie(names.access, accessToken, {
      ...base,
      path: '/',
      maxAge: this.config.get<number>('auth.accessTtlSeconds', 900) * 1000,
    });
    res.cookie(names.refresh, refreshToken, {
      ...base,
      path: '/api/v1/auth',
      maxAge: this.config.get<number>('auth.refreshTtlSeconds', 30 * 24 * 60 * 60) * 1000,
    });
    res.cookie(names.device, deviceId, {
      ...base,
      path: '/api/v1/auth',
      maxAge: DEVICE_COOKIE_TTL_DAYS * 86_400_000,
    });
  }

  private clearCookies(res: Response, req: Request) {
    const base = this.cookieBase();
    const names = authCookieNames(panelOf(req));
    res.clearCookie(names.access, { ...base, path: '/' });
    res.clearCookie(names.refresh, { ...base, path: '/api/v1/auth' });
    res.clearCookie(names.device, { ...base, path: '/api/v1/auth' });
  }

  private normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      throw new BadRequestException(ERRORS.INVALID_PHONE);
    }
    return `+${digits}`;
  }

  private clientIp(req: Request) {
    return clientIpOf(req);
  }

  private requestId(req: Request) {
    return String((req as Request & { id?: string }).id ?? '').slice(0, 100) || undefined;
  }

  private async getRequiredPolicies() {
    const policies = await this.db.policyVersion.findMany({
      where: {
        status: PolicyStatus.PUBLISHED,
        type: {
          in: [PolicyType.TERMS, PolicyType.PRIVACY, PolicyType.PLATFORM_RULES],
        },
      },
      orderBy: [{ type: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, type: true },
    });

    const latest = new Map<PolicyType, { id: string; type: PolicyType }>();
    for (const policy of policies) {
      if (!latest.has(policy.type)) latest.set(policy.type, policy);
    }
    return [...latest.values()];
  }

  private async withSerializableRetry<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.db.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === maxAttempts
        ) {
          throw error;
        }
      }
    }
    throw new Error(ERRORS.TRANSACTION_RETRY_EXCEEDED);
  }
}
