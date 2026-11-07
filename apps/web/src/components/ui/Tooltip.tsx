import { cloneElement, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './system.css';

/** Tooltip: ink fon, oq matn, strelka bilan; 400 ms kechikish, fade 120 ms; fokusda ham ochiladi. */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactElement; side?: 'top' | 'bottom' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();
  const show = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), 400); };
  const hide = () => { window.clearTimeout(timer.current); setOpen(false); };
  return (
    <span className="gm-tip" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {cloneElement(children, { 'aria-describedby': open ? id : undefined } as Record<string, unknown>)}
      <span role="tooltip" id={id} className={cx('gm-tip__box', `gm-tip__box--${side}`, open && 'is-open')}>{content}</span>
    </span>
  );
}
