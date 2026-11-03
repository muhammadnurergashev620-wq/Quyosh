import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/utils';
import { BareContext } from './bare-context';

const isMobile = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 899px)').matches;

export function ProfileCard({
  icon: Icon,
  title,
  hint,
  children,
  id,
  highlight = false,
  defaultOpen = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
  highlight?: boolean;
  /** Telefonda kartochka yig‘ilgan holda chiqadi; shu belgi bo‘lsa ochiq boshlanadi. */
  defaultOpen?: boolean;
}) {
  const bare = useContext(BareContext);
  const [open, setOpen] = useState(() => defaultOpen || !isMobile());
  useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);

  if (bare) {
    return (
      <section className="gm-pbare" id={id}>
        {hint && <p className="gm-pbare__hint">{hint}</p>}
        {children}
      </section>
    );
  }

  return (
    <section className={cx('gm-pcard', highlight && 'gm-pcard--highlight', open && 'gm-pcard--open')} id={id}>
      <header
        className="gm-pcard__head"
        role={isMobile() ? 'button' : undefined}
        tabIndex={isMobile() ? 0 : undefined}
        aria-expanded={open}
        onClick={() => isMobile() && setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (isMobile() && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        <span className="gm-pcard__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        <ChevronDown size={18} className="gm-pcard__chevron" aria-hidden="true" />
      </header>
      <div className="gm-pcard__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function InfoRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="gm-inforows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
