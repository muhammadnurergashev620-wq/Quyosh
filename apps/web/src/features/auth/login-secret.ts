/**
 * Kirish bosqichida «Kodni qayta yuborish» uchun parol faqat shu sahifa ochiq turgan vaqt xotirada saqlanadi
 * (localStorage/zustand'ga yozilmaydi). Sahifa yangilansa yoki kirish tugasa — o‘chadi.
 */
let secret: { phone: string; password: string } | null = null;

export const loginSecret = {
  set: (phone: string, password: string) => {
    secret = { phone, password };
  },
  get: (phone: string) => (secret && secret.phone === phone ? secret.password : null),
  clear: () => {
    secret = null;
  },
};
