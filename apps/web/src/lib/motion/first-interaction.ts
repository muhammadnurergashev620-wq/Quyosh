const EVENTS = ['scroll', 'wheel', 'pointerdown', 'touchstart', 'keydown'] as const;

/**
 * Og‘ir bezaklarni (Three.js film, shader, Lenis) foydalanuvchi sahifa bilan birinchi marta ishlaganda ishga tushiradi:
 * birinchi ekran tez chiziladi va asosiy oqim bo‘sh qoladi (Lighthouse LCP/TBT). Sahifa allaqachon aylantirilgan bo‘lsa — darhol.
 * Qaytaradigan funksiya kutishni bekor qiladi.
 */
export function onFirstInteraction(callback: () => void): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    callback();
  };
  const cleanup = () => EVENTS.forEach((name) => window.removeEventListener(name, fire));
  if (window.scrollY > 0) {
    queueMicrotask(fire);
    return () => { done = true; };
  }
  EVENTS.forEach((name) => window.addEventListener(name, fire, { passive: true, once: true }));
  return () => {
    done = true;
    cleanup();
  };
}
