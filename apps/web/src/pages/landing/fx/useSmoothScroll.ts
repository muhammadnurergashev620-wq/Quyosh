import { useEffect } from 'react';
import Lenis from 'lenis';

/** Silliq (inertsiyali) skroll + tepada skroll progress chizig‘i. Harakat kamaytirilgan bo‘lsa yoqilmaydi. */
export function useSmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bar = document.getElementById('gm-scroll-progress');
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    if (reduce) return () => window.removeEventListener('scroll', update);

    const lenis = new Lenis({ duration: 1.15, easing: (x) => 1 - Math.pow(1 - x, 3), smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    // Sahifa ichidagi #havolalar silliq o‘tadi.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = anchor?.getAttribute('href');
      if (!anchor || !id || id === '#') return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -72 });
    };
    document.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', update);
      lenis.destroy();
    };
  }, []);
}
