import type { Request } from 'express';

/**
 * Haqiqiy mijoz IP si. Faqat Express'ning `req.ip` qiymatiga tayanadi: u `trust proxy` sozlamasiga (TRUST_PROXY) muvofiq
 * ishonchli proksilar qo‘shgan X-Forwarded-For ni hisobga oladi. Sarlavhani to‘g‘ridan-to‘g‘ri o‘qish MUMKIN EMAS —
 * hujumchi uni soxtalashtirib, IP bo‘yicha cheklovlarni (login/OTP) aylanib o‘tishi mumkin edi.
 */
export function clientIpOf(req: Pick<Request, 'ip' | 'socket'>): string | undefined {
  const raw = req.ip ?? req.socket?.remoteAddress ?? '';
  return raw.replace(/^::ffff:/, '').slice(0, 64) || undefined;
}
