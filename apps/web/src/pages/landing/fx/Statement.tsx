import { useEffect, useRef } from 'react';

/**
 * Katta tahririy matn: skroll qilinganda so‘zlar birin-ketin «yoqiladi» (skroll bilan boshqariladigan shaffoflik).
 * Harakat kamaytirilgan bo‘lsa — hamma so‘z darhol to‘liq ko‘rinadi.
 */
export function Statement({ label, text }: { label: string; text: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const spans = Array.from(section.querySelectorAll<HTMLElement>('[data-w]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spans.forEach((span) => span.style.setProperty('--on', '1'));
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0: bo‘lim ekran pastiga kirdi → 1: bo‘lim markazi ekran markazidan o‘tib bo‘ldi.
      const progress = Math.min(1, Math.max(0, (vh * 0.9 - rect.top) / (rect.height + vh * 0.25)));
      const lit = progress * (spans.length + 10);
      spans.forEach((span, index) => {
        const value = Math.min(1, Math.max(0, lit - index));
        span.style.setProperty('--on', value.toFixed(3));
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [text]);

  return (
    <section ref={sectionRef} className="gm-statement" aria-label={text}>
      <p className="gm-statement__label">{label}</p>
      <p className="gm-statement__text" aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} data-w className="gm-statement__word">
            {word}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}
