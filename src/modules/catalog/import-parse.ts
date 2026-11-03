import ExcelJS from 'exceljs';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;

/** Shablon ustunlari (U11.7). Sarlavhalar katta-kichik harfga sezgir emas. */
export const IMPORT_COLUMNS = ['brand', 'model', 'price', 'currency', 'vat_included', 'stock_status', 'quantity', 'branch', 'valid_from', 'valid_until', 'description'] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type RawRow = { row: number } & Partial<Record<ImportColumn, string>>;

export const IMPORT_TEMPLATE_CSV =
  `${IMPORT_COLUMNS.join(',')}\n` +
  'Longi,LR5-72HPH-550M,1450000,UZS,true,IN_STOCK,40,Chilonzor filiali,2026-11-01,,Tier-1 panel\n' +
  'Deye,SUN-8K-SG04LP3,1250,USD,true,ON_ORDER,,,,,\n';

/** RFC 4180 CSV: qo‘shtirnoq, ichki «""», CRLF; ajratgich — «,» yoki «;» (Excel lokal sozlamasi). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value);
}

export async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    rows.push(values.slice(1).map(cellText));
  });
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/** Sarlavha bo‘yicha xom qatorlarga aylantiradi. Majburiy ustunlar yo‘q bo‘lsa — null. */
export function toRawRows(table: string[][]): { rows: RawRow[]; missing: string[] } {
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = (['brand', 'model', 'price'] as const).filter((column) => !header.includes(column));
  const rows = table.slice(1).map((cells, index) => {
    const raw: RawRow = { row: index + 2 };
    header.forEach((column, position) => {
      if ((IMPORT_COLUMNS as readonly string[]).includes(column)) raw[column as ImportColumn] = (cells[position] ?? '').trim();
    });
    return raw;
  });
  return { rows, missing };
}

/**
 * CSV katagi. Formula in’yeksiyasidan himoya (OWASP): `= + - @` yoki tab/CR bilan boshlanadigan matn oldiga `'` qo‘yiladi —
 * Excel/Sheets uni formula sifatida bajarmaydi. Oddiy sonlar (masalan, `-5`) o‘zgarmaydi.
 */
export function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^[-+]?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
