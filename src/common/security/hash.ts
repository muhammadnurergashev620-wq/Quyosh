import { compare, hash } from '@node-rs/bcrypt';

/**
 * Parol/kod xeshlash (bcrypt, mahalliy Rust kutubxonasi). `bcryptjs` dan farqi: hisoblash alohida oqimlarda bajariladi,
 * shuning uchun server boshqa so‘rovlarga javob berishda davom etadi. Xesh formati (`$2b$…`) bcryptjs bilan to‘liq mos.
 */
export const hashSecret = (value: string, cost = 12): Promise<string> => hash(value, cost);

export const verifySecret = (value: string, hashed: string): Promise<boolean> => compare(value, hashed).catch(() => false);
