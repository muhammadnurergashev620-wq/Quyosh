import { describe, expect, it } from 'vitest';
import { toUzbekCyrillic } from './translit';

describe('toUzbekCyrillic', () => {
  it.each([
    ['Kirish', 'Кириш'],
    ['Ro‘yxatdan o‘tish', 'Рўйхатдан ўтиш'],
    ['Telefon raqami', 'Телефон рақами'],
    ['ma’lumot', 'маълумот'],
    ['Mijoz paneli', 'Мижоз панели'],
    ['Hisobingiz yaratildi', 'Ҳисобингиз яратилди'],
    ['Chiqish', 'Чиқиш'],
    ['Sozlamalar', 'Созламалар'],
    ['Elektrik', 'Электрик'],
    ['yaxshi', 'яхши'],
    ['Ishonchli', 'Ишончли'],
    ['Tog‘ri', 'Тоғри'],
    ['Yangi buyurtma', 'Янги буюртма'],
    ['shartlari', 'шартлари'],
    ['Eslatma', 'Эслатма'],
    ['Davomiylik', 'Давомийлик'],
    ['Akkauntingiz yo‘qmi?', 'Аккаунтингиз йўқми?'],
    ['yo‘l', 'йўл'],
    ['yoz', 'ёз'],
  ])('%s → %s', (input, expected) => {
    expect(toUzbekCyrillic(input)).toBe(expected);
  });

  it('keeps brand names, numbers and {params}', () => {
    expect(toUzbekCyrillic('Quyosh — Mijoz paneli')).toBe('Quyosh — Мижоз панели');
    expect(toUzbekCyrillic('Yana {count} ta, 40 000 UZS')).toBe('Яна {count} та, 40 000 UZS');
    expect(toUzbekCyrillic('OTP kod')).toBe('OTP код');
  });
});
