import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { getGsap } from '@/lib/motion/gsap';
import { SCRUB_SMOOTHING, prefersReducedMotion } from '@/lib/motion/tokens';
import './ScrollVideo.css';

export interface ScrollVideoProps {
  /** Manbalar: avval WebM, keyin MP4. Silliq orqaga-oldinga surish uchun har kadr kalit kadr (all-intra) bo‘lishi kerak. */
  sources: Array<{ src: string; type: string }>;
  poster?: string;
  /** Tashqaridan beriladigan progress (0..1). Berilmasa, videoning o‘z konteyneri bo‘yicha ScrollTrigger yaratiladi. */
  progress?: MutableRefObject<number>;
  /** Vertikal tor ekranlar uchun alohida (kichikroq) manba. */
  mobileSources?: Array<{ src: string; type: string }>;
  label: string;
  className?: string;
}

/**
 * Haqiqiy SKROLL-BOSHQARUVLI VIDEO: skroll pozitsiyasi → normallashgan progress → video.currentTime.
 * - Pastga skroll videoni oldinga, yuqoriga skroll orqaga suradi.
 * - Har kadrda React qayta chizilmaydi: faqat requestAnimationFrame va currentTime.
 * - Ko‘rinish maydonidan uzoqlashganda video yuklanishi to‘xtatiladi (xotira tejaladi).
 * - «Harakatni kamaytirish» yoqilgan bo‘lsa — faqat poster ko‘rsatiladi.
 */
export function ScrollVideo({ sources, mobileSources, poster, progress, label, className }: ScrollVideoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ownProgress = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video || prefersReducedMotion()) return;
    const { ScrollTrigger } = getGsap();
    const source = progress ?? ownProgress;

    const narrow = window.matchMedia('(max-width: 700px)').matches;
    const list = narrow && mobileSources?.length ? mobileSources : sources;
    let loaded = false;
    let frame = 0;
    let shown = 0;
    let duration = 0;

    const load = () => {
      if (loaded) return;
      loaded = true;
      video.innerHTML = '';
      list.forEach(({ src, type }) => {
        const el = document.createElement('source');
        el.src = src;
        el.type = type;
        video.appendChild(el);
      });
      video.preload = 'auto';
      video.load();
    };
    const unload = () => {
      if (!loaded) return;
      loaded = false;
      video.removeAttribute('src');
      video.innerHTML = '';
      video.load();
    };
    video.addEventListener('loadedmetadata', () => {
      duration = video.duration || 0;
      wrap.classList.add('is-ready');
    });

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!loaded || !duration) return;
      shown += (source.current - shown) * SCRUB_SMOOTHING;
      const time = Math.min(duration - 0.04, Math.max(0, shown * duration));
      if (!video.seeking && Math.abs(video.currentTime - time) > 0.025) video.currentTime = time;
    };
    frame = requestAnimationFrame(tick);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load();
        else unload();
      },
      { rootMargin: '150% 0px 150% 0px' },
    );
    io.observe(wrap);

    // Alohida ishlatilganda (progress berilmagan) — o‘z konteyneri bo‘yicha.
    const trigger = progress
      ? null
      : ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onUpdate: (self) => (ownProgress.current = self.progress) });

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      trigger?.kill();
      unload();
    };
  }, [sources, mobileSources, progress]);

  return (
    <div ref={wrapRef} className={className ? `gm-scrollvideo ${className}` : 'gm-scrollvideo'}>
      {poster && <img className="gm-scrollvideo__poster" src={poster} alt="" loading="lazy" decoding="async" />}
      <video ref={videoRef} className="gm-scrollvideo__video" muted playsInline preload="none" poster={poster} aria-label={label} tabIndex={-1} />
    </div>
  );
}
