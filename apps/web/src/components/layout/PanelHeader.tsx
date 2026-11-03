import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Globe, LogOut, Moon, Settings, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Logo } from '@/components/common/Logo';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useUnreadCount } from '@/features/notification/hooks/useNotifications';
import { useMe } from '@/features/session/hooks/useMe';
import { useAuthStore } from '@/store/auth.store';
import { accountName } from '@/lib/account-name';
import { env } from '@/lib/env';
import { PANEL_LABEL } from '@/lib/panel';
import type { Role } from '@/types/common';
import { getNavItems } from './nav-items';
import { getThemeMode, setThemeMode } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { cx } from '@/lib/utils';
import { LANGUAGES, lang, setLanguage, t } from '@/i18n';
import './Header.css';
import './PanelHeader.css';

/** Admin va superadmin panelining yuqori paneli: bo‘lim, foydalanuvchi va buyurtma bo‘yicha qidiruv (Ctrl+K), til, mavzu, bildirishnomalar va profil menyusi. */
export function PanelHeader({ role }: { role: Role | null }) {
  const navigate = useNavigate();
  const me = useMe();
  const hasSession = useAuthStore((s) => s.hasSession);
  const unread = useUnreadCount();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const current = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0]!;

  const user = me.data;
  const isSuper = !!user?.isSuperAdmin;
  const name = accountName(user);
  const panelRole: Role = role ?? env.appRole ?? 'CUSTOMER';
  const isAdmin = panelRole === 'ADMIN';
  const roleText = isAdmin ? (isSuper ? t('Superadmin') : t('Administrator')) : panelRole === 'SHOP' ? t('Do‘kon xodimi') : t('Mijoz');
  const count = unread.data?.count ?? 0;
  const home = getNavItems(panelRole, { superAdmin: true })[0]?.to ?? '/';
  const profilePath = isAdmin ? '/admin/profil' : panelRole === 'SHOP' ? '/sozlamalar' : '/mijoz/profil';
  const guest = !hasSession;

  const setTheme = (next: ThemeMode) => {
    setThemeMode(next);
    setMode(next);
  };

  return (
    <header className="gm-aheader">
      <div className="gm-aheader__card">
        <Link to={home} className="gm-aheader__brand" aria-label={t('Quyosh — bosh sahifa')}>
          <Logo />
        </Link>
        <span className="gm-aheader__panel">
          {isAdmin && <ShieldCheck size={13} strokeWidth={2.4} aria-hidden="true" />}
          {isAdmin ? (isSuper ? t('Superadmin paneli') : t('Admin paneli')) : PANEL_LABEL[panelRole]}
        </span>
        <span className="gm-aheader__divider" aria-hidden="true" />

        <div className="gm-aheader__actions">
          <Dropdown
            label={`${t('Til')}: ${current.label}`}
            triggerClassName="gm-aheader__pill"
            trigger={
              <>
                <Globe size={17} strokeWidth={2} aria-hidden="true" />
                <span>{current.short}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </>
            }
            items={LANGUAGES.map((item) => ({
              label: item.label,
              icon: item.code === lang ? <ShieldCheck size={16} /> : <span style={{ width: 16, display: 'inline-block' }} />,
              onSelect: () => setLanguage(item.code),
            }))}
          />

          <div className="gm-aheader__theme" role="group" aria-label={t('Mavzu')}>
            <button type="button" className={cx(mode === 'light' && 'is-on')} aria-pressed={mode === 'light'} aria-label={t('Yorug‘ mavzu')} title={t('Yorug‘ mavzu')} onClick={() => setTheme('light')}>
              <Sun size={17} strokeWidth={2} />
            </button>
            <button type="button" className={cx(mode === 'dark' && 'is-on')} aria-pressed={mode === 'dark'} aria-label={t('Qorong‘i mavzu')} title={t('Qorong‘i mavzu')} onClick={() => setTheme('dark')}>
              <Moon size={17} strokeWidth={2} />
            </button>
          </div>

          {guest ? (
            <span className="gm-aheader__guest">
              <Link to="/register" className="gm-button gm-button--ghost gm-button--sm">{t('Ro‘yxatdan o‘tish')}</Link>
              <Link to="/login" className="gm-button gm-button--primary gm-button--sm">{t('Kirish')}</Link>
            </span>
          ) : (
            <>
            <Link to="/bildirishnomalar" className="gm-aheader__bell" aria-label={count > 0 ? t('Bildirishnomalar, {count} ta yangi', { count }) : t('Bildirishnomalar')}>
              <Bell size={19} strokeWidth={2} />
              {count > 0 && <span className="gm-aheader__badge">{count > 99 ? '99+' : count}</span>}
            </Link>

            <span className="gm-aheader__divider gm-aheader__divider--tall" aria-hidden="true" />

            <Dropdown
              label={t('Profil menyusi')}
              triggerClassName="gm-aheader__user"
              menuClassName="gm-aheader__menu"
              trigger={
                <>
                  <span className="gm-aheader__avatar">
                    <UserAvatar name={name} seed={user?.id ?? 'user'} size="sm" src={user?.avatar} />
                    <i aria-hidden="true" />
                  </span>
                  <span className="gm-aheader__who">
                    <strong>{name === t('Ism kiritilmagan') ? user?.phone ?? t('Menyu') : name}</strong>
                    <small>{roleText}</small>
                  </span>
                  <ChevronDown size={16} aria-hidden="true" className="gm-aheader__chev" />
                </>
              }
              items={[
                { label: t('Profilim'), icon: <UserRound size={17} />, onSelect: () => navigate(profilePath) },
                { label: t('Xavfsizlik'), icon: <ShieldCheck size={17} />, onSelect: () => navigate('/sozlamalar/xavfsizlik') },
                { label: t('Sozlamalar'), icon: <Settings size={17} />, onSelect: () => navigate('/sozlamalar/korinish') },
                {
                  label: t('Tungi rejim'),
                  icon: <Moon size={17} />,
                  separator: true,
                  keepOpen: true,
                  onSelect: () => setTheme(mode === 'dark' ? 'light' : 'dark'),
                  trailing: <span className="gm-aheader__switch" data-on={mode === 'dark'} aria-hidden="true"><span /></span>,
                },
                { label: t('Chiqish'), icon: <LogOut size={17} />, onSelect: () => setLogoutOpen(true), danger: true, separator: true },
              ]}
            />
            </>
          )}
        </div>
      </div>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </header>
  );
}
