import type { Request } from 'express';
import { ACCESS_COOKIE, DEVICE_COOKIE, REFRESH_COOKIE } from '../constants/auth.constants';

export const PANEL_HEADER = 'x-app-panel';
const PANELS = ['CUSTOMER', 'SHOP', 'ADMIN'] as const;
export type Panel = (typeof PANELS)[number];

export function panelOf(req: Pick<Request, 'headers'>): Panel | null {
  const raw = req.headers?.[PANEL_HEADER];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toUpperCase();
  return PANELS.find((panel) => panel === value) ?? null;
}

/**
 * Har bir panel (mijoz / usta / admin) o‘z cookie nomlariga ega: bir brauzerda uchala panelga
 * turli akkauntlar bilan bir vaqtda kirish mumkin va biri boshqasining sessiyasini almashtirmaydi.
 * Panel sarlavhasi bo‘lmasa (API mijozlari, testlar) — oddiy nomlar ishlatiladi.
 */
export function authCookieNames(panel: Panel | null): { access: string; refresh: string; device: string } {
  const suffix = panel ? `_${panel.toLowerCase()}` : '';
  return { access: `${ACCESS_COOKIE}${suffix}`, refresh: `${REFRESH_COOKIE}${suffix}`, device: `${DEVICE_COOKIE}${suffix}` };
}
