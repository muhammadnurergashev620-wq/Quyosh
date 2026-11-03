import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import '@fontsource/onest/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/500.css';
import { installGlobalErrorReporting } from '@/lib/error-reporter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/styles/global.css';
import { applyUiSize, getUiSize } from '@/lib/ui-size';
import '@/styles/polish.css';
import '@/styles/compact.css';
import '@/styles/cards.css';
import '@/styles/premium.css';


applyUiSize(getUiSize());

// Trekped/sichqoncha bilan chapga–o‘ngga surilganda brauzer «orqaga/oldinga» sahifaga o‘tib ketmasin:
// gorizontal g‘ildirak harakati, agar ostida gorizontal skroll qilinadigan element bo‘lmasa, to‘xtatiladi.
function horizontallyScrollable(start: EventTarget | null, dx: number): boolean {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    if (canScrollX) {
      const atStart = el.scrollLeft <= 0 && dx < 0;
      const atEnd = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth && dx > 0;
      if (!atStart && !atEnd) return true;
    }
    el = el.parentElement;
  }
  return false;
}
window.addEventListener(
  'wheel',
  (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && !event.ctrlKey && !horizontallyScrollable(event.target, event.deltaX)) {
      event.preventDefault();
    }
  },
  { passive: false },
);

installGlobalErrorReporting();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
