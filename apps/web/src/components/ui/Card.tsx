import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { StatTone } from './StatCard';
import './system.css';

export type CardVariant = 'default' | 'muted' | 'outline' | 'highlight' | 'dark' | 'gradient';

/**
 * Asosiy karta (U5): radius 20, 1 px chegara, soya sm. `interactive` — hover’da 2 px ko‘tariladi, chegara primary 35 %.
 * Variantlar: default, muted, outline (soyasiz), highlight (chapda 3 px chiziq), dark (ink fon), gradient (profil sarlavhasi).
 */
export function Card({ variant = 'default', interactive = false, padding = 'md', className, children, ...rest }: HTMLAttributes<HTMLElement> & { variant?: CardVariant; interactive?: boolean; padding?: 'none' | 'sm' | 'md' | 'lg' }) {
  return (
    <section className={cx('gm-card-x', `gm-card-x--${variant}`, `gm-card-x--pad-${padding}`, interactive && 'is-interactive', className)} {...rest}>
      {children}
    </section>
  );
}

/** Karta sarlavha qatori: ikonka-quti (36×36) + sarlavha (Onest 700 16 px) + izoh; o‘ngda amal. */
export function CardHeader({ icon, tone = 'primary', title, subtitle, action }: { icon?: ReactNode; tone?: StatTone; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="gm-card-x__head">
      {icon && <span className={cx('gm-icon-box', `gm-icon-box--${tone}`)} aria-hidden="true">{icon}</span>}
      <div className="gm-card-x__titles">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="gm-card-x__action">{action}</div>}
    </header>
  );
}

/** Rangli ikonka-quti (36×36, radius 10) — KPI, ro‘yxat va bildirishnomalarda bir xil. */
export function IconBox({ tone = 'primary', size = 'md', children }: { tone?: StatTone; size?: 'sm' | 'md' | 'lg'; children: ReactNode }) {
  return <span className={cx('gm-icon-box', `gm-icon-box--${tone}`, `gm-icon-box--${size}`)} aria-hidden="true">{children}</span>;
}

/**
 * Ro‘yxat qatori (so‘rov, taklif, do‘kon, bildirishnoma): 44 px ikonka/logo-quti, sarlavha, meta qatori, o‘ngda badge yoki narx.
 * `to` yoki `onClick` bo‘lsa butun qator bosiladi (hover fon).
 */
export function ListItem({ media, title, meta, trailing, to, onClick, unread, chevron, className }: { media?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; to?: string; onClick?: () => void; unread?: boolean; chevron?: boolean; className?: string }) {
  const body = (
    <>
      {media && <span className="gm-list-item__media">{media}</span>}
      <span className="gm-list-item__main">
        <span className="gm-list-item__title">{title}</span>
        {meta && <span className="gm-list-item__meta">{meta}</span>}
      </span>
      {trailing && <span className="gm-list-item__trail">{trailing}</span>}
      {chevron && <ChevronRight className="gm-list-item__chevron" aria-hidden="true" />}
    </>
  );
  const cls = cx('gm-list-item', (to || onClick) && 'is-clickable', unread && 'is-unread', className);
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('gm-list', className)}>{children}</div>;
}

/** Meta qatori: qismlar «·» bilan ajratiladi, bo‘shlari tashlab yuboriladi. */
export function Meta({ parts }: { parts: Array<ReactNode | null | undefined | false> }) {
  const items = parts.filter((part) => part !== null && part !== undefined && part !== false && part !== '');
  return <>{items.map((part, i) => <span key={i}>{i > 0 && <span className="gm-meta-dot" aria-hidden="true">·</span>}{part}</span>)}</>;
}

/** Karta ichidagi havola qatori («Hammasi →»). */
export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="gm-card-link">{children} <ChevronRight aria-hidden="true" /></Link>;
}
