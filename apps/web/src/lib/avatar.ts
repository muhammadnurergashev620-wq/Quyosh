import { env } from './env';

/** Backend qaytargan nisbiy rasm manzili (`/avatars/<id>`) yoki tashqi (Google) havolani to‘liq URLga aylantiradi. */
export function avatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return avatar.startsWith('/') ? `${env.apiBaseUrl}${avatar}` : avatar;
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
