// Web `apps/web/src/i18n/translit.ts` bilan bir xil (PDF hisobotlari uchun backendda ham kerak).
/** O‘zbek lotin → kirill (2021 alifbosi) transliteratsiyasi. Brend nomlari, raqamlar va {param} lar o‘zgarmaydi. */

const PROTECTED = /(\{[A-Za-z0-9_]+\}|\b(?:Quyosh|UZS|OTP|ID|Click|Payme|Uzum|Telegram|DevOps|GPS|IP|PDF|SMS|HTTPS?|URL|Chrome|Linux|Android|iOS|APK|AES|API|kWh|kWp|kW|kVt|MWh|NPV|IRR|LCOE|USD|PVGIS|NASA|POWER|JRC|MPPT|DC|AC|DoD|LED|STIR|CSV|XLSX|QR|Esri|OpenStreetMap|MapLibre)\b)/;
const APOSTROPHES = "[‘’ʻʼ'`]";
const VOWELS = 'aeiouAEIOUоОўЎ';

const MAP: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
};

function upperIf(source: string, cyr: string): string {
  return source === source.toUpperCase() && source !== source.toLowerCase() ? cyr.toUpperCase() : cyr;
}

function convertWord(word: string): string {
  let out = '';
  let i = 0;
  const lower = word.toLowerCase();
  while (i < word.length) {
    const ch = word[i]!;
    const lc = lower[i]!;
    const next = lower[i + 1] ?? '';
    const afterNext = word[i + 1] ?? '';
    const isLetterStart = out === '' || VOWELS.includes(out[out.length - 1]!);

    // o‘ g‘
    if ((lc === 'o' || lc === 'g') && new RegExp(`^${APOSTROPHES}$`).test(afterNext)) {
      out += upperIf(ch, lc === 'o' ? 'ў' : 'ғ');
      i += 2;
      continue;
    }
    // sh ch yo yu ya ye ng ts
    const pair = lc + next;
    if (pair === 'sh') { out += upperIf(ch, 'ш'); i += 2; continue; }
    if (pair === 'ch') { out += upperIf(ch, 'ч'); i += 2; continue; }
    if (pair === 'yo' && !new RegExp(`^${APOSTROPHES}$`).test(word[i + 2] ?? '')) { out += upperIf(ch, 'ё'); i += 2; continue; }
    if (pair === 'yu') { out += upperIf(ch, 'ю'); i += 2; continue; }
    if (pair === 'ya') { out += upperIf(ch, 'я'); i += 2; continue; }
    if (pair === 'ye') { out += upperIf(ch, 'е'); i += 2; continue; }
    if (pair === 'ng') { out += upperIf(ch, 'н') + (word[i + 1] === 'G' ? 'Г' : 'г'); i += 2; continue; }
    // e: so‘z boshida yoki unlidan keyin — «э»
    if (lc === 'e') { out += upperIf(ch, isLetterStart ? 'э' : 'е'); i += 1; continue; }
    // tutuq belgisi (ma’lumot → маълумот)
    if (new RegExp(`^${APOSTROPHES}$`).test(ch)) { out += 'ъ'; i += 1; continue; }
    const mapped = MAP[lc];
    if (mapped) { out += upperIf(ch, mapped); i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
}

/** Matnni kirill alifbosiga o‘giradi (himoyalangan so‘zlar va {param} lar saqlanadi). */
export function toUzbekCyrillic(text: string): string {
  // split(regex bilan bitta qamrovli guruh): juft indekslar — oddiy matn, toq indekslar — himoyalangan qism.
  return text
    .split(PROTECTED)
    .map((chunk, index) => (index % 2 === 1 ? chunk : chunk.replace(/[A-Za-z‘’ʻʼ'`]+/g, (word) => convertWord(word))))
    .join('');
}
