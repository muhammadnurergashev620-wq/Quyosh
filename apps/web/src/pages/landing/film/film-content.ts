import { t } from '@/i18n';
import type { FilmLabels } from './FilmStage';

export interface FilmScene {
  label: string;
  title: string;
  text: string;
}

/** 02–08 boblar matni (01 — hero, sarlavha va CTA portal sahifasidan) — TZ U6.9. */
export function filmScenes(): FilmScene[] {
  return [
    { label: t('02 — Panel to‘ri'), title: t('Panellar o‘z joyiga tushadi.'), text: t('Tom maydoni va yo‘nalishi bo‘yicha — nechta panel sig‘ishini darhol ko‘rasiz.') },
    { label: t('03 — Energiya'), title: t('Har soatda — haqiqiy kVt·soat.'), text: t('PVGIS ma’lumoti asosida soatlik ishlab chiqarish va uydagi iste’mol.') },
    { label: t('04 — Tejash'), title: t('Oyiga 410–520 ming so‘m.'), text: t('Bitta «chiroyli raqam» emas — past, standart va yuqori diapazon.') },
    { label: t('05 — Xarita'), title: t('Yaqin atrofdagi tasdiqlangan do‘konlar.'), text: t('Xizmat hududingizga kiradigan do‘konlar birinchi ko‘rsatiladi.') },
    { label: t('06 — Takliflar'), title: t('Narxlarni solishtiring.'), text: t('1–5 ta do‘kondan taklif oling; kafolat, muddat va 1 kVt narxi yonma-yon.') },
    { label: t('07 — Montaj'), title: t('O‘rnatildi va tekshirildi.'), text: t('Montajni chek-list bilan qabul qilasiz; sharh faqat shundan keyin.') },
    { label: t('08 — Quyosh.uz'), title: 'Quyosh.uz', text: t('Hisoblab ko‘ring — 3 daqiqa. Natija — prognoz, kafolat emas.') },
  ];
}

export function filmLabels(sunArc: number, night: boolean): FilmLabels {
  return {
    saving: t('410–520 ming so‘m'),
    savingNote: t('oylik tejash · standart ssenariy 465 ming'),
    quotes: [
      { shop: 'SunLine', price: t('69,9 mln') },
      { shop: 'Quyosh Tech', price: t('66,4 mln') },
      { shop: 'Energiya', price: t('71,2 mln') },
    ],
    steps: [t('Kelishildi'), t('O‘lchov'), t('Montaj'), t('Bajarildi'), t('Qabul qilindi')],
    sunArc,
    night,
  };
}

export const SCENE_NAMES = () => [t('Tong'), t('Panel to‘ri'), t('Energiya'), t('Tejash'), t('Xarita'), t('Takliflar'), t('Montaj'), t('Quyosh.uz')];
