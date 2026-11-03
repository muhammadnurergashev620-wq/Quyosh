import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../quote/quote-totals';
import { DEFAULT_MODERATION_RULES, containsContact, scoreReviewRisk, type RiskSignals } from './review-risk';
import { defaultChecklistItems, evaluateChecklist } from '../installation/checklist';

const clean: RiskSignals = { selfReview: false, sharedDeviceWithShop: false, accountAgeDays: 100, hasOtherActivity: true, confirmDelayHours: 48, recentShopReviews: 0, maxSimilarity: 0.1, ipDistinctAccounts: 1, comment: 'Yaxshi ishladi' };

describe('Taklif summalari (TZ 13.3)', () => {
  it('qatorlar, yetkazish, chegirma, QQS ichida', () => {
    const totals = computeQuoteTotals({
      items: [
        { itemType: 'EQUIPMENT', quantity: 10, unitPrice: '1500000' },
        { itemType: 'EQUIPMENT', quantity: '1', unitPrice: '9000000.555' },
        { itemType: 'INSTALLATION', quantity: 1, unitPrice: 4000000 },
        { itemType: 'DELIVERY', quantity: 1, unitPrice: 300000 },
      ],
      otherCosts: 200000,
      discountAmount: 500000,
      vatIncluded: true,
      vatRate: 12,
    });
    expect(totals.lineTotals[1].toString()).toBe('9000000.56');
    expect(totals.equipmentSubtotal.toString()).toBe('24000000.56');
    expect(totals.deliveryCost.toString()).toBe('300000');
    expect(totals.total.toString()).toBe('28000000.56');
    expect(totals.vatAmount.toFixed(2)).toBe('3000000.06');
  });

  it('QQS qo‘shiladigan holat va manfiy total', () => {
    const add = computeQuoteTotals({ items: [{ itemType: 'EQUIPMENT', quantity: 2, unitPrice: 1000 }], vatIncluded: false, vatRate: 12 });
    expect(add.total.toString()).toBe('2240');
    const negative = computeQuoteTotals({ items: [{ itemType: 'EQUIPMENT', quantity: 1, unitPrice: 100 }], discountAmount: 200, vatIncluded: false, vatRate: 12 });
    expect(negative.total.isNegative()).toBe(true);
    expect(negative.vatAmount.toString()).toBe('0');
  });
});

describe('Sharh risk belgilari (TZ 13.4)', () => {
  it('toza sharh darhol chiqadi; SELF_REVIEW bloklanadi', () => {
    expect(scoreReviewRisk(clean)).toMatchObject({ blocked: false, score: 0, status: 'PUBLISHED' });
    expect(scoreReviewRisk({ ...clean, selfReview: true })).toMatchObject({ blocked: true, flags: ['SELF_REVIEW'] });
  });

  it('har belgi uchun ijobiy/salbiy holat', () => {
    expect(scoreReviewRisk({ ...clean, sharedDeviceWithShop: true }).flags).toEqual(['SHARED_DEVICE_WITH_SHOP']);
    expect(scoreReviewRisk({ ...clean, accountAgeDays: 3, hasOtherActivity: false }).flags).toEqual(['NEW_ACCOUNT']);
    expect(scoreReviewRisk({ ...clean, accountAgeDays: 3, hasOtherActivity: true }).flags).toEqual([]);
    expect(scoreReviewRisk({ ...clean, confirmDelayHours: 1.5 }).flags).toEqual(['FAST_CONFIRM']);
    expect(scoreReviewRisk({ ...clean, confirmDelayHours: 2 }).flags).toEqual([]);
    expect(scoreReviewRisk({ ...clean, recentShopReviews: 4 }).flags).toEqual(['BURST']);
    expect(scoreReviewRisk({ ...clean, recentShopReviews: 3 }).flags).toEqual([]);
    expect(scoreReviewRisk({ ...clean, maxSimilarity: 0.8 }).flags).toEqual(['DUPLICATE_TEXT']);
    expect(scoreReviewRisk({ ...clean, maxSimilarity: 0.79 }).flags).toEqual([]);
    expect(scoreReviewRisk({ ...clean, ipDistinctAccounts: 3 }).flags).toEqual(['SAME_IP_CLUSTER']);
    expect(scoreReviewRisk({ ...clean, comment: 'Qo‘ng‘iroq qiling +998 90 123 45 67' }).flags).toEqual(['CONTACT_IN_TEXT']);
  });

  it('chegaraviy ball: 39 → PUBLISHED, 40 → PENDING', () => {
    const rules = { ...DEFAULT_MODERATION_RULES, scores: { ...DEFAULT_MODERATION_RULES.scores, FAST_CONFIRM: 19 } };
    expect(scoreReviewRisk({ ...clean, confirmDelayHours: 1, comment: 'sayt: quyosh.uz' }, rules)).toMatchObject({ score: 39, status: 'PUBLISHED' });
    expect(scoreReviewRisk({ ...clean, confirmDelayHours: 1, comment: 'sayt: quyosh.uz' })).toMatchObject({ score: 40, status: 'PENDING' });
  });

  it('kontakt aniqlash', () => {
    expect(containsContact('Rahmat, hammasi zo‘r')).toBe(false);
    expect(containsContact('t.me/quyosh_shop')).toBe(true);
    expect(containsContact('901234567')).toBe(true);
    expect(containsContact('5 kVt tizim 25 yil')).toBe(false);
  });
});

describe('Montaj chek-listi (TZ 13.7)', () => {
  const template = defaultChecklistItems(true);
  const allOk = template.map((item) => ({ code: item.code, status: 'OK' as const, photoFileIds: item.photoRequired ? ['f1'] : [] }));

  it('to‘liq to‘ldirilgan chek-list', () => {
    expect(evaluateChecklist(template, allOk)).toMatchObject({ complete: true, hasIssues: false, answered: template.length });
  });

  it('majburiy band yo‘q, rasm yo‘q, izohsiz muammo', () => {
    const res = evaluateChecklist(template, allOk.filter((item) => item.code !== 'GROUNDING'));
    expect(res.complete).toBe(false);
    expect(res.missing).toEqual(['GROUNDING']);
    const noPhoto = evaluateChecklist(template, allOk.map((item) => (item.code === 'INVERTER_RUNNING' ? { ...item, photoFileIds: [] } : item)));
    expect(noPhoto.errors).toEqual([{ code: 'INVERTER_RUNNING', reason: 'PHOTO_REQUIRED' }]);
    const issue = evaluateChecklist(template, allOk.map((item) => (item.code === 'CABLES' ? { ...item, status: 'ISSUE' as const } : item)));
    expect(issue.errors).toEqual([{ code: 'CABLES', reason: 'COMMENT_REQUIRED' }]);
    const issueOk = evaluateChecklist(template, allOk.map((item) => (item.code === 'CABLES' ? { ...item, status: 'ISSUE' as const, comment: 'Kabel osilib turibdi' } : item)));
    expect(issueOk).toMatchObject({ complete: true, hasIssues: true });
  });

  it('ixtiyoriy bandni o‘tkazib yuborish yoki NA qilish mumkin', () => {
    expect(evaluateChecklist(template, allOk.filter((item) => item.code !== 'BATTERY')).complete).toBe(true);
    expect(evaluateChecklist(template, allOk.map((item) => (item.code === 'GROUNDING' ? { ...item, status: 'NA' as const } : item))).complete).toBe(true);
    expect(evaluateChecklist(template, allOk.map((item) => (item.code === 'INVERTER_RUNNING' ? { ...item, status: 'NA' as const } : item))).errors[0]?.reason).toBe('NA_NOT_ALLOWED');
  });
});
