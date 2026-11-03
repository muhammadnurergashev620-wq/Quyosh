import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(language?: string) {
  vi.resetModules();
  localStorage.clear();
  if (language) localStorage.setItem('quyosh.lang', language);
  return import('./index');
}

afterEach(() => localStorage.clear());

describe('t()', () => {
  it('defaults to Uzbek (Latin) and returns the source text with params filled in', async () => {
    const { t, lang } = await load();
    expect(lang).toBe('uz');
    expect(t('Kirish')).toBe('Kirish');
    expect(t('{count} ta yangi', { count: 3 })).toBe('3 ta yangi');
  });

  it('translates to Russian, ignoring apostrophe variants', async () => {
    const ru = await load('ru');
    expect(ru.t('Kirish')).toBe('Вход');
    expect(ru.t('Ro‘yxatdan o‘tish')).toBe('Регистрация');
    expect(ru.t('Ro\'yxatdan o\'tish')).toBe('Регистрация');
    expect(ru.t('Bildirishnomalar, {count} ta yangi', { count: 2 })).toBe('Уведомления, новых: 2');
  });

  it('transliterates to Uzbek Cyrillic and keeps {params}', async () => {
    const { t } = await load('uz-Cyrl');
    expect(t('Kirish')).toBe('Кириш');
    expect(t('{count} ta yangi', { count: 5 })).toBe('5 та янги');
  });

  it('falls back to the Uzbek source for strings without a translation', async () => {
    const ru = await load('ru');
    expect(ru.t('Bu matn lug‘atda yo‘q')).toBe('Bu matn lug‘atda yo‘q');
  });

  it('uses localized months', async () => {
    const { MONTHS } = await load('ru');
    expect(MONTHS.ru[9]).toBe('окт');
  });

  it('keeps the trailing period in step with the Uzbek source text', async () => {
    const ru = await load('ru');
    // «Yuklanmoqda» kabi nuqtasiz kalit — tarjimada ham nuqta yo‘q; nuqtali kalit — nuqtali tarjima.
    expect(ru.t('Hujjat o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.')).toBe('Документ будет удалён. Это действие нельзя отменить.');
    expect(ru.t('Hujjat o‘chiriladi. Bu amalni qaytarib bo‘lmaydi')).toBe('Документ будет удалён. Это действие нельзя отменить');
  });
});

describe('languages (TZ U18)', () => {
  it('offers exactly uz, oz (uz-Cyrl) and ru; a stale «en» choice falls back to Uzbek', async () => {
    const { LANGUAGES, lang } = await load('en');
    expect(LANGUAGES.map((item) => item.code)).toEqual(['uz', 'uz-Cyrl', 'ru']);
    expect(lang).toBe('uz');
  });

  it('translates Quyosh terms from the U3 glossary', async () => {
    const ru = await load('ru');
    expect(ru.t('Tarmoqqa ulangan')).toBe('Сетевая');
    expect(ru.t('Hisoblab ko‘rish')).toBe('Рассчитать');
  });
});
