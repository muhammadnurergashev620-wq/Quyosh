/**
 * Mobil jadvallar (U5, D): har bir `.qs-table` katagiga ustun sarlavhasini `data-label` sifatida yozadi.
 * CSS (styles/system.css) ≤ 640 px da qatorlarni «yorliq — qiymat» kartalariga aylantiradi.
 * Sahifalarga tegmaydi: yangi jadvallar MutationObserver orqali avtomatik qamrab olinadi.
 */
const SELECTOR = 'table.qs-table:not(.qs-compare)';

function label(table: HTMLTableElement) {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((cell) => (cell.textContent ?? '').trim() || cell.getAttribute('aria-label') || '');
  if (!heads.length) return;
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let index = 0;
      for (const cell of Array.from(row.cells)) {
        const text = heads[index] ?? '';
        if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
        index += cell.colSpan || 1;
      }
    }
  }
}

export function startResponsiveTables(root: HTMLElement = document.body) {
  let scheduled = false;
  const run = () => { scheduled = false; root.querySelectorAll<HTMLTableElement>(SELECTOR).forEach(label); };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(run); } };
  // Faqat element qo‘shilishi/olib tashlanishi kuzatiladi (matn o‘zgarishi emas) — animatsiyali sahifalarda ortiqcha ish yo‘q.
  new MutationObserver((records) => { if (records.some((r) => r.addedNodes.length)) schedule(); }).observe(root, { childList: true, subtree: true });
  schedule();
}
