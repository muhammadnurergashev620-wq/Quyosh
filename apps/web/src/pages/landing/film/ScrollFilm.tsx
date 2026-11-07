import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onFirstInteraction } from '@/lib/motion/first-interaction';
import { prefersReducedMotion } from '@/lib/motion/tokens';
import { sunState } from '@/lib/sun';
import { ShaderBackground } from '../fx/ShaderBackground';
import type { FilmStage } from './FilmStage';
import { SCENE_NAMES, filmLabels, filmScenes } from './film-content';
import './film.css';
import { t } from '@/i18n';

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Bosh saytning «Quyosh filmi» (TZ U6.9): sticky sahna + GSAP ScrollTrigger progressi → 3D sahna va bob sarlavhalari,
 * React har kadrda qayta chizilmaydi. WebGL yo‘q yoki reduced-motion bo‘lsa — statik boblar ro‘yxati.
 * `hero` — 01-bob (sarlavha va CTA), birinchi kadrda o‘qiladi (LCP), 3D sahna uning orqasida yuklanadi.
 */
export function ScrollFilm({ hero, finalCta }: { hero: ReactNode; finalCta: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'pending' | 'film' | 'static'>('pending');
  /** Poster (CSS) → birinchi skroll/teginish/klavishda 3D film va shader dinamik yuklanadi. */
  const [live, setLive] = useState(false);
  const scenes = filmScenes();
  const names = SCENE_NAMES();

  useEffect(() => {
    setMode(webglAvailable() && !prefersReducedMotion() ? 'film' : 'static');
  }, []);

  useEffect(() => (mode === 'film' ? onFirstInteraction(() => setLive(true)) : undefined), [mode]);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = stageRef.current;
    if (mode !== 'film' || !live || !section || !mount) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('./FilmStage'), import('@/lib/motion/gsap')]).then(([film, motion]) => {
      if (disposed) return;
      cleanup = startFilm(section, mount, film, motion.getGsap().ScrollTrigger);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [mode, live]);

  function startFilm(section: HTMLElement, mount: HTMLDivElement, film: typeof import('./FilmStage'), ScrollTrigger: ReturnType<typeof import('@/lib/motion/gsap').getGsap>['ScrollTrigger']): (() => void) | undefined {
    const { createFilmStage, SCENES } = film;
    const lowPower = window.matchMedia('(max-width: 700px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    const stage: FilmStage | null = createFilmStage(mount, (() => { const sun = sunState(); return filmLabels(sun.arc, sun.period === 'NIGHT'); })(), { lowPower });
    if (!stage) {
      setMode('static');
      return undefined;
    }
    const caps = Array.from(section.querySelectorAll<HTMLElement>('[data-cap]'));
    const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'));
    const bar = section.querySelector<HTMLElement>('[data-bar]');
    const last = SCENES.length - 2;
    let current = -1;

    const apply = (p: number) => {
      stage.setProgress(p);
      caps.forEach((cap, i) => {
        const start = SCENES[i]!;
        const end = SCENES[i + 1]!;
        const fadeIn = i === 0 ? 1 : smooth(start - 0.015, start + 0.03, p);
        const fadeOut = i === caps.length - 1 ? 0 : smooth(end - 0.03, end + 0.005, p);
        const on = fadeIn * (1 - fadeOut);
        cap.style.setProperty('--on', on.toFixed(3));
        cap.classList.toggle('is-active', on > 0.55);
      });
      const found = SCENES.findIndex((v, i) => p >= v && p < (SCENES[i + 1] ?? 2));
      const idx = Math.min(last, found === -1 ? last : found);
      if (idx !== current) {
        current = idx;
        section.dataset.scene = String(idx);
        ticks.forEach((tick, i) => tick.classList.toggle('is-on', i <= idx));
      }
      if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
      section.classList.toggle('is-scrolled', p > 0.02);
    };
    apply(0);

    const trigger = ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (self) => apply(self.progress) });
    // Sahna ekrandan chiqqanda va tab yashirilganda render to‘xtaydi (TZ 5.6.1).
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      stage.setActive(visible && !document.hidden);
    }, { rootMargin: '10% 0px' });
    io.observe(section);
    const onVisibility = () => stage.setActive(visible && !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const ro = new ResizeObserver(() => {
      stage.resize();
      ScrollTrigger.refresh();
    });
    ro.observe(mount);

    return () => {
      trigger.kill();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.dispose();
    };
  }

  if (mode !== 'film') {
    return (
      <section className="gm-film gm-film--static" aria-label="Quyosh" ref={sectionRef}>
        <ShaderBackground variant="brand" />
        <div className="gm-film__static-inner">
          <div className="gm-film__cap gm-film__cap--hero">{hero}</div>
          <ol className="gm-film__static-list">
            {scenes.map((scene) => (
              <li key={scene.label}>
                <span className="gm-film__label">{scene.label}</span>
                <strong>{scene.title}</strong>
                <p>{scene.text}</p>
              </li>
            ))}
          </ol>
          {finalCta}
        </div>
      </section>
    );
  }

  return (
    <section className="gm-film gm-film--long" ref={sectionRef} data-scene="0" aria-label={t('Quyosh: hisobdan montajgacha')}>
      <div className={live ? 'gm-film__sticky' : 'gm-film__sticky is-poster'}>
        {live && <ShaderBackground variant="brand" />}
        <div className="gm-film__scrim" aria-hidden="true" />
        <div ref={stageRef} className="gm-film__stage" aria-hidden="true" />

        <div className="gm-film__cap gm-film__cap--hero" data-cap>
          {hero}
        </div>
        {scenes.map((scene, i) => (
          <div key={scene.label} className={i === scenes.length - 1 ? 'gm-film__cap gm-film__cap--final' : 'gm-film__cap'} data-cap>
            <p className="gm-film__label">{scene.label}</p>
            <h2>{scene.title}</h2>
            <p className="gm-film__text">{scene.text}</p>
            {i === scenes.length - 1 && finalCta}
          </div>
        ))}

        <ol className="gm-film__chapters" aria-hidden="true">
          {names.map((name, i) => (
            <li key={name} data-tick className={i === 0 ? 'is-on' : undefined}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span>{name}</span>
            </li>
          ))}
        </ol>
        <div className="gm-film__progress" aria-hidden="true">
          <i data-bar />
        </div>
      </div>
    </section>
  );
}
