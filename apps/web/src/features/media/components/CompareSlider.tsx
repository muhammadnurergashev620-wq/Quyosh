import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { t } from '@/i18n';
import { useMediaSignedUrl } from '../hooks/useMedia';
import './CompareSlider.css';

/** Oldin / Keyin: ikki rasm ustma-ust, sudrash (sichqoncha, sensor) yoki ← → bilan taqqoslanadi. */
export function CompareSlider({ beforeId, afterId, alt }: { beforeId: string; afterId: string; alt: string }) {
  const before = useMediaSignedUrl(beforeId, 'medium', true);
  const after = useMediaSignedUrl(afterId, 'medium', true);
  const box = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const setPos = useCallback((value: number) => {
    const v = Math.min(100, Math.max(0, value));
    box.current?.style.setProperty('--pos', `${v.toFixed(1)}%`);
    if (range.current) range.current.value = String(Math.round(v));
  }, []);

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect) setPos(((event.clientX - rect.left) / rect.width) * 100);
  };

  if (before.isLoading || after.isLoading) return <Skeleton className="gm-cmp" />;
  if (!before.data || !after.data) return null;

  return (
    <div
      ref={box}
      className="gm-cmp"
      style={{ '--pos': '50%' } as CSSProperties}
     
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => dragging.current && move(event)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img className="gm-cmp__img" src={after.data.url} alt={`${alt} — ${t('Keyin')}`} draggable={false} />
      <img className="gm-cmp__img gm-cmp__img--before" src={before.data.url} alt={`${alt} — ${t('Oldin')}`} draggable={false} />
      <span className="gm-cmp__tag gm-cmp__tag--before">{t('Oldin')}</span>
      <span className="gm-cmp__tag gm-cmp__tag--after">{t('Keyin')}</span>
      <span className="gm-cmp__handle" aria-hidden="true">
        <span>{t('Surish')}</span>
      </span>
      <input
        ref={range}
        className="gm-cmp__range"
        type="range"
        min={0}
        max={100}
        defaultValue={50}
        aria-label={t('Oldin va keyin taqqoslash')}
        onChange={(event) => setPos(Number(event.currentTarget.value))}
      />
    </div>
  );
}
