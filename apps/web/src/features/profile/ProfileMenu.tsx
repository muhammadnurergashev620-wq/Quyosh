import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { BareContext } from './bare-context';
import './ProfileMenu.css';

export interface ProfileMenuRow {
  key: string;
  icon: LucideIcon;
  label: string;
  /** O‘ng tomonda qisqa ma’lumot (son, holat belgisi). */
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

/** Profil menyusi: har bir qator — alohida ichki bo‘lim (yoki sahifa) ga o‘tadi. */
export function ProfileMenuList({ rows }: { rows: ProfileMenuRow[] }) {
  return (
    <ul className="gm-pmenu">
      {rows.map((row) => {
        const Icon = row.icon;
        const content = (
          <>
            <span className="gm-pmenu__icon" aria-hidden="true">
              <Icon size={19} />
            </span>
            <span className="gm-pmenu__label">{row.label}</span>
            {row.value != null && <span className="gm-pmenu__value">{row.value}</span>}
            {!row.danger && <ChevronRight size={18} className="gm-pmenu__chev" aria-hidden="true" />}
          </>
        );
        return (
          <li key={row.key}>
            {row.to ? (
              <Link to={row.to} className={cx('gm-pmenu__row', row.danger && 'gm-pmenu__row--danger')}>
                {content}
              </Link>
            ) : (
              <button type="button" className={cx('gm-pmenu__row', row.danger && 'gm-pmenu__row--danger')} onClick={row.onClick}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Ichki bo‘lim sahifasi: orqaga tugmasi + sarlavha + mazmun. */
export function ProfileSubPage({ title, backTo, children }: { title: string; backTo: string; children: ReactNode }) {
  return (
    <div className="gm-psub">
      <header className="gm-psub__head">
        <Link to={backTo} className="gm-psub__back" aria-label={t('Orqaga')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <h1>{title}</h1>
      </header>
      <div className="gm-psub__body">
        <BareContext.Provider value>{children}</BareContext.Provider>
      </div>
    </div>
  );
}
