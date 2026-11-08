import { t } from '@/i18n';

export interface Qa {
  q: () => string;
  a: () => string;
}

export const CUSTOMER: Qa[] = [
  { q: () => t('Hisob qanchalik aniq?'), a: () => t('Hisob PVGIS quyosh ma’lumotlari, hududingiz tarifi va kiritgan iste’molingiz asosida soatlik bajariladi. Natija past, standart va yuqori diapazonda ko‘rsatiladi — bu prognoz, kafolat emas.') },
  { q: () => t('Tom maydonini bilmasam-chi?'), a: () => t('Tez hisobda «Kichik / O‘rtacha / Katta» variantlaridan birini tanlang yoki xaritada tomni sun’iy yo‘ldosh rasmi ustida chizing.') },
  { q: () => t('Elektr to‘lovimni bilmasam-chi?'), a: () => t('«Bilmayman» tugmasini bosing va uydagi maishiy texnikani tanlang — oylik sarf avtomatik hisoblanadi.') },
  { q: () => t('Do‘konlar mening telefonimni ko‘radimi?'), a: () => t('Yo‘q. Kontaktni o‘zingiz ochmaguningizcha do‘kon faqat tuman, tizim parametrlari va hisob xulosasini ko‘radi; yozishma platforma ichida.') },
  { q: () => t('Kredit yoki bo‘lib to‘lash bilan hisoblasa bo‘ladimi?'), a: () => t('Ha: oylik to‘lov, ortiqcha to‘lov va tejash to‘lovni qancha qoplashi ko‘rsatiladi. Yakuniy shartlarni bank yoki sotuvchi belgilaydi.') },
  { q: () => t('Montajdan keyin nima bo‘ladi?'), a: () => t('Montajni chek-list bilan qabul qilasiz, sharh qoldirasiz va o‘rnatilgan tizimingizni kabinetda kuzatasiz: kafolatlar, tozalash eslatmalari, haqiqiy ishlab chiqarish.') },
];

export const GENERAL: Qa[] = [
  { q: () => t('Ma’lumotlarim qayerda saqlanadi?'), a: () => t('Shaxsiy ma’lumotlar O‘zbekiston hududidagi serverlarda saqlanadi.') },
  { q: () => t('Sharhlar haqiqiymi?'), a: () => t('Sharhni faqat montaji tasdiqlangan mijoz yozadi; shubhali sharhlar moderatsiyadan o‘tadi.') },
];

export const FAQ_PREVIEW: Qa[] = [CUSTOMER[0]!, CUSTOMER[1]!, CUSTOMER[3]!, CUSTOMER[4]!, CUSTOMER[5]!, GENERAL[0]!, GENERAL[1]!];
