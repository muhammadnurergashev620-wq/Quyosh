import { useEffect } from 'react';

/** SPA SEO (TZ 5.5, U7.6): title, description, hreflang alternate va JSON-LD; sahifadan chiqqanda tozalanadi. */
export function useSeo(opts: { title: string; description?: string; jsonLd?: unknown; path?: string } | null) {
  useEffect(() => {
    if (!opts) return;
    const prevTitle = document.title;
    document.title = `${opts.title} · Quyosh`;
    const added: HTMLElement[] = [];
    const add = (el: HTMLElement) => { el.dataset.seo = '1'; document.head.appendChild(el); added.push(el); };
    if (opts.description) {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = opts.description.slice(0, 160);
      add(m);
    }
    if (opts.path) {
      for (const hl of ['uz', 'uz-Cyrl', 'ru']) {
        const l = document.createElement('link');
        l.rel = 'alternate';
        l.hreflang = hl;
        l.href = `${window.location.origin}${opts.path}?lang=${hl}`;
        add(l);
      }
    }
    if (opts.jsonLd) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(opts.jsonLd);
      add(s);
    }
    return () => {
      document.title = prevTitle;
      added.forEach((el) => el.remove());
    };
  }, [opts?.title, opts?.description, opts?.path, JSON.stringify(opts?.jsonLd ?? null)]); // eslint-disable-line react-hooks/exhaustive-deps
}
