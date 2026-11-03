/** Profil manzili raqamli ID bilan: o‘zingizniki — shaxsiy bo‘lim, boshqaniki — foydalanuvchi profili. */
export function accountPath(accountNumber: number, myNumber: number | undefined) {
  return accountNumber === myNumber ? '/admin/profil' : `/admin/foydalanuvchilar/${accountNumber}`;
}
