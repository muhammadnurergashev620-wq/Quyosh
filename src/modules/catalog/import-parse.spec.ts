import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { csvEscape, parseCsv, parseXlsx, toRawRows } from './import-parse';
import { ExchangeRateService } from './exchange-rate.service';

describe('parseCsv', () => {
  it('qo‘shtirnoq, ichki qo‘shtirnoq va CRLF ni to‘g‘ri o‘qiydi', () => {
    const rows = parseCsv('﻿brand,model,price\r\n"Longi","LR5 ""Hi-MO""",1450000\r\n\r\nDeye,SUN-8K,1250.5\n');
    expect(rows).toEqual([
      ['brand', 'model', 'price'],
      ['Longi', 'LR5 "Hi-MO"', '1450000'],
      ['Deye', 'SUN-8K', '1250.5'],
    ]);
  });

  it('nuqtali vergulni (Excel lokali) ajratgich sifatida taniydi', () => {
    expect(parseCsv('brand;model;price\nJA;JAM72;1 200 000')).toEqual([
      ['brand', 'model', 'price'],
      ['JA', 'JAM72', '1 200 000'],
    ]);
  });
});

describe('toRawRows', () => {
  it('sarlavha bo‘yicha xaritalaydi va qator raqamini 2 dan boshlaydi', () => {
    const { rows, missing } = toRawRows([
      ['Brand', 'Model', 'Price', 'Stock Status', 'nomaʼlum'],
      [' Longi ', 'LR5', '100', 'IN_STOCK', 'x'],
    ]);
    expect(missing).toEqual([]);
    expect(rows).toEqual([{ row: 2, brand: 'Longi', model: 'LR5', price: '100', stock_status: 'IN_STOCK' }]);
  });

  it('majburiy ustunlar yo‘qligini qaytaradi', () => {
    expect(toRawRows([['brand', 'qty']]).missing).toEqual(['model', 'price']);
  });
});

describe('parseXlsx', () => {
  it('birinchi varaqni matn qatorlariga aylantiradi (sana → YYYY-MM-DD)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Narxlar');
    sheet.addRow(['brand', 'model', 'price', 'valid_from']);
    sheet.addRow(['Longi', 'LR5', 1450000, new Date(Date.UTC(2026, 10, 1))]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    expect(await parseXlsx(buffer)).toEqual([
      ['brand', 'model', 'price', 'valid_from'],
      ['Longi', 'LR5', '1450000', '2026-11-01'],
    ]);
  });
});

describe('csvEscape', () => {
  it('maxsus belgilarni qo‘shtirnoqqa oladi', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscape('-5')).toBe('-5');
    expect(csvEscape(-5)).toBe('-5');
  });
});

describe('ExchangeRateService.toUzs', () => {
  const rate = { currency: 'USD' as const, rateToUzs: '12650.45', rateDate: '2026-10-30', source: 'cbu', stale: false };
  it('USD ni Decimal aniqligida so‘mga o‘giradi', () => {
    expect(ExchangeRateService.toUzs('1250.10', 'USD', rate)).toBe('15814327.55');
  });
  it('UZS o‘zgarmaydi, kurs yo‘q bo‘lsa null', () => {
    expect(ExchangeRateService.toUzs('1000', 'UZS', null)).toBe('1000.00');
    expect(ExchangeRateService.toUzs('1', 'USD', null)).toBeNull();
  });
});
