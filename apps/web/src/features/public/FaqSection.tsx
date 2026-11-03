import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SupportContacts } from './SupportContacts';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';

interface Qa {
  q: () => string;
  a: () => string;
}

const CUSTOMER: Qa[] = [
  { q: () => t('Hisob qanchalik aniq?'), a: () => t('Hisob PVGIS quyosh ma’lumotlari, hududingiz tarifi va kiritgan iste’molingiz asosida soatlik bajariladi. Natija past, standart va yuqori diapazonda ko‘rsatiladi — bu prognoz, kafolat emas.') },
  { q: () => t('Tom maydonini bilmasam-chi?'), a: () => t('Tez hisobda «Kichik / O‘rtacha / Katta» variantlaridan birini tanlang yoki xaritada tomni sun’iy yo‘ldosh rasmi ustida chizing.') },
  { q: () => t('Elektr to‘lovimni bilmasam-chi?'), a: () => t('«Bilmayman» tugmasini bosing va uydagi maishiy texnikani tanlang — oylik sarf avtomatik hisoblanadi.') },
  { q: () => t('Do‘konlar mening telefonimni ko‘radimi?'), a: () => t('Yo‘q. Kontaktni o‘zingiz ochmaguningizcha do‘kon faqat tuman, tizim parametrlari va hisob xulosasini ko‘radi; yozishma platforma ichida.') },
  { q: () => t('Kredit yoki bo‘lib to‘lash bilan hisoblasa bo‘ladimi?'), a: () => t('Ha: oylik to‘lov, ortiqcha to‘lov va tejash to‘lovni qancha qoplashi ko‘rsatiladi. Yakuniy shartlarni bank yoki sotuvchi belgilaydi.') },
  { q: () => t('Montajdan keyin nima bo‘ladi?'), a: () => t('Montajni chek-list bilan qabul qilasiz, sharh qoldirasiz va o‘rnatilgan tizimingizni kabinetda kuzatasiz: kafolatlar, tozalash eslatmalari, haqiqiy ishlab chiqarish.') },
];

const MASTER: Qa[] = [
  { q: () => t('Do‘konni qanday ochaman?'), a: () => t('Do‘kon panelida ro‘yxatdan o‘ting: nom, telefon va STIR kiriting, filial va xizmat hududini belgilang. Hujjatlar tekshirilgach, do‘kon katalog va xaritada ko‘rinadi.') },
  { q: () => t('So‘rovlar qanday keladi?'), a: () => t('Mijoz tayyor hisob bilan narx so‘raydi; siz tizim parametrlari va iste’molni ko‘rib, taklif yuborasiz yoki o‘lchov uchrashuvini taklif qilasiz.') },
];

const GENERAL: Qa[] = [
  { q: () => t('Ma’lumotlarim qayerda saqlanadi?'), a: () => t('Shaxsiy ma’lumotlar O‘zbekiston hududidagi serverlarda saqlanadi.') },
  { q: () => t('Sharhlar haqiqiymi?'), a: () => t('Sharhni faqat montaji tasdiqlangan mijoz yozadi; shubhali sharhlar moderatsiyadan o‘tadi.') },
];

export const FAQ_PREVIEW: Qa[] = [CUSTOMER[0]!, CUSTOMER[1]!, CUSTOMER[3]!, CUSTOMER[4]!, CUSTOMER[5]!, MASTER[0]!, GENERAL[0]!, GENERAL[1]!];
const ALL: Qa[] = [...CUSTOMER, ...MASTER, ...GENERAL];

export function Column({ items }: { items: Qa[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="gm-faq__col">
      {items.map((item, index) => (
        <div key={index} className={cx('gm-faq__item', open === index && 'is-open')}>
          <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
            <span className="gm-faq__q">{item.q()}</span>
            <span className="gm-faq__plus" aria-hidden="true"><Plus size={16} strokeWidth={2.6} /></span>
          </button>
          {open === index && <p>{item.a()}</p>}
        </div>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section className="gm-show__block" id="savollar">
      <header className="gm-show__head gm-show__head--faq">
        <span className="gm-faq__pill">FAQ</span>
        <h2>{t('Ko‘p beriladigan savollar')}</h2>
        <p className="gm-show__lead">{t('Mijoz va do‘konlar uchun eng kerakli javoblar bir joyda.')}</p>
      </header>
      <div className="gm-faq gm-faq--single">
        <Column items={ALL} />
      </div>
      <SupportContacts title={t('Savolingiz qoldimi?')} />
    </section>
  );
}
