import { Link, useLocation } from 'react-router-dom';
import { cx } from '@/lib/utils';
import './Logo.css';
import { t } from '@/i18n';

/** Quyosh belgisi (U1.2 «quyosh yoyi»): ufq chizig‘i ustidagi quyosh va uning kunlik yo‘li. */
export function SunMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="gm-logo__svg" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M5 27a15 15 0 0 1 30 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 3" strokeLinecap="round" opacity="0.55" />
      <circle cx="20" cy="22" r="7.5" fill="#F0B84B" />
      <path d="M4 28h32" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Quyosh logotipi. `onDark` — har doim to‘q fon ustida (oq yozuv) varianti. */
export function Logo({ className, compact = false, onDark = false }: { className?: string; compact?: boolean; onDark?: boolean }) {
  return (
    <span className={cx('gm-logo', onDark && 'gm-logo--on-dark', className)}>
      <span className="gm-logo__mark" aria-hidden="true">
        <SunMark />
      </span>
      {!compact && (
        <span className="gm-logo__word">
          Quyosh<b>.uz</b>
        </span>
      )}
    </span>
  );
}

/** Logotip havolasi: bosh sahifaga qaytaradi; allaqachon bosh sahifada bo‘lsa, silliq tepaga suradi. */
export function LogoLink({ to = '/', className, onDark = false }: { to?: string; className?: string; onDark?: boolean }) {
  const { pathname } = useLocation();
  return (
    <Link
      to={to}
      className={className}
      aria-label={t('Quyosh — bosh sahifa')}
      onClick={(event) => {
        if (pathname === to) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      }}
    >
      <Logo onDark={onDark} />
    </Link>
  );
}
