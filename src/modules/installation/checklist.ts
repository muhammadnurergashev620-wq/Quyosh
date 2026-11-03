export type ChecklistItemStatus = 'OK' | 'ISSUE' | 'NA';

export interface ChecklistTemplateItem {
  code: string;
  titleI18n: Record<string, string>;
  hintI18n?: Record<string, string>;
  required: boolean;
  photoRequired: boolean;
}

export interface ChecklistResultItem {
  code: string;
  status: ChecklistItemStatus;
  comment?: string | null;
  photoFileIds?: string[];
}

export interface ChecklistEvaluation {
  /** Majburiy bandlar to‘liq, "Muammo bor" izohli, majburiy rasm bor. */
  complete: boolean;
  hasIssues: boolean;
  answered: number;
  total: number;
  missing: string[];
  errors: Array<{ code: string; reason: 'COMMENT_REQUIRED' | 'PHOTO_REQUIRED' | 'UNKNOWN_ITEM' | 'NA_NOT_ALLOWED' }>;
}

/** TZ 13.7: chek-list natijasini shablonga nisbatan baholash. */
export function evaluateChecklist(template: ChecklistTemplateItem[], result: ChecklistResultItem[]): ChecklistEvaluation {
  const byCode = new Map(result.map((item) => [item.code, item]));
  const known = new Set(template.map((item) => item.code));
  const errors: ChecklistEvaluation['errors'] = result.filter((item) => !known.has(item.code)).map((item) => ({ code: item.code, reason: 'UNKNOWN_ITEM' as const }));
  const missing: string[] = [];
  let answered = 0;
  for (const item of template) {
    const answer = byCode.get(item.code);
    if (!answer) {
      if (item.required) missing.push(item.code);
      continue;
    }
    answered += 1;
    // "Tegishli emas" har bandda mumkin, faqat rasm majburiy (asosiy) bandlarda emas.
    if (answer.status === 'NA' && item.photoRequired) errors.push({ code: item.code, reason: 'NA_NOT_ALLOWED' });
    if (answer.status === 'ISSUE' && !answer.comment?.trim()) errors.push({ code: item.code, reason: 'COMMENT_REQUIRED' });
    if (item.photoRequired && answer.status !== 'NA' && !(answer.photoFileIds?.length)) errors.push({ code: item.code, reason: 'PHOTO_REQUIRED' });
  }
  return {
    complete: missing.length === 0 && errors.length === 0,
    hasIssues: result.some((item) => item.status === 'ISSUE'),
    answered,
    total: template.length,
    missing,
    errors,
  };
}

const t = (uz: string, oz: string, ru: string) => ({ uz, oz, ru });

/** TZ 13.7 default bandlari (admin keyin o‘zgartiradi). Akkumulyator bandi faqat HYBRID/OFF_GRID shablonlarida. */
export function defaultChecklistItems(withBattery: boolean): ChecklistTemplateItem[] {
  const items: ChecklistTemplateItem[] = [
    { code: 'PANELS_MOUNTED', titleI18n: t('Panellar mahkam o‘rnatilgan, ramkada shikast yo‘q', 'Панеллар маҳкам ўрнатилган, рамкада шикаст йўқ', 'Панели надёжно закреплены, рамы без повреждений'), hintI18n: t('Rasm ixtiyoriy', 'Расм ихтиёрий', 'Фото по желанию'), required: true, photoRequired: false },
    { code: 'INVERTER_RUNNING', titleI18n: t('Invertor yoqilgan va ishlab chiqarishni ko‘rsatmoqda', 'Инвертор ёқилган ва ишлаб чиқаришни кўрсатмоқда', 'Инвертор включён и показывает выработку'), hintI18n: t('Invertor ekranida ishlab chiqarish ko‘rinishi kerak — ekran rasmini yuklang', 'Инвертор экранида ишлаб чиқариш кўриниши керак — экран расмини юкланг', 'На экране инвертора должна быть видна выработка — загрузите фото экрана'), required: true, photoRequired: true },
    { code: 'GROUNDING', titleI18n: t('Yerga ulash (zazemlenie) bajarilgan', 'Ерга улаш (заземление) бажарилган', 'Выполнено заземление'), required: true, photoRequired: false },
    { code: 'PROTECTION', titleI18n: t('DC va AC tomonida himoya avtomatlari/uzgichlar o‘rnatilgan va belgilangan', 'DC ва AC томонида ҳимоя автоматлари/узгичлар ўрнатилган ва белгиланган', 'Установлены и подписаны защитные автоматы/разъединители DC и AC'), required: true, photoRequired: false },
    { code: 'CABLES', titleI18n: t('Kabellar himoya qutisi/gofra ichida, ochiq joyda osilib qolmagan', 'Кабеллар ҳимоя қутиси/гофра ичида, очиқ жойда осилиб қолмаган', 'Кабели в коробах/гофре, не провисают открыто'), required: true, photoRequired: false },
  ];
  if (withBattery) {
    items.push({ code: 'BATTERY', titleI18n: t('Akkumulyator shamollatiladigan joyda, ulanishlar yopiq', 'Аккумулятор шамоллатиладиган жойда, уланишлар ёпиқ', 'Аккумулятор в проветриваемом месте, клеммы закрыты'), required: false, photoRequired: false });
  }
  items.push(
    { code: 'BRIEFING', titleI18n: t('Mijozga tizimni yoqish/o‘chirish va favqulodda o‘chirish ko‘rsatildi', 'Мижозга тизимни ёқиш/ўчириш ва фавқулодда ўчириш кўрсатилди', 'Клиенту показали включение/выключение и аварийное отключение'), required: true, photoRequired: false },
    { code: 'DOCUMENTS', titleI18n: t('Kafolat hujjatlari va datasheet’lar topshirildi', 'Кафолат ҳужжатлари ва datasheet’лар топширилди', 'Переданы гарантийные документы и даташиты'), required: true, photoRequired: false },
    { code: 'CLEANUP', titleI18n: t('Ish joyi tozalandi, tomda shikast yo‘q', 'Иш жойи тозаланди, томда шикаст йўқ', 'Рабочее место убрано, кровля без повреждений'), required: true, photoRequired: false },
  );
  return items;
}
