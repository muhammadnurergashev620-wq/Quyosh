/**
 * Quyosh harakat tili (motion tokens). Har bir animatsiyaning sababi bor:
 * o‘zgarish, jarayon, bog‘liqlik, chuqurlik yoki sabab-oqibatni ko‘rsatadi.
 */
export const EASE = {
  /** Sahna almashishi, bo‘lim kirishi — sekin tugaydi. */
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Holat o‘zgarishi (tugma, status) — tez va aniq. */
  standard: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
  /** Qaytish, yopilish. */
  in: 'cubic-bezier(0.5, 0, 0.75, 0)',
} as const;

export const DURATION = {
  instant: 90,
  fast: 160,
  base: 260,
  slow: 480,
  scene: 900,
} as const;

/** Skroll bilan boshqariladigan yumshatish (lerp koeffitsiyenti, har kadrda). */
export const SCRUB_SMOOTHING = 0.12;

export const prefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
