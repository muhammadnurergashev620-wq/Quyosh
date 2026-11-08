import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Globe, LogOut, Moon, Search, Settings, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Logo } from '@/components/common/Logo';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { UserAvatar } from '@/components/common/UserAvatar';
import { NotificationBell } from '@/features/notification/components/NotificationPanel';
import { useAuthStore } from '@/store/auth.store';
import { PANEL_LABEL } from '@/lib/panel';
import type { Role } from '@/types/common';
import { getNavItems } from './nav-items';
import { CommandPalette } from './CommandPalette';
import { SHORTCUT_LABEL, useCommandShortcut } from './commandShortcut';
import { usePanelIdentity } from './usePanelIdentity';
import { getThemeMode, setThemeMode } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { LANGUAGES, lang, setLanguage, t } from '@/i18n';
import './Header.css';
import './PanelHeader.css';
import { Tab } from '@/components/ui/Tabs';

/** Admin va superadmin panelining yuqori paneli: bo‘lim, foydalanuvchi va buyurtma bo‘yicha qidiruv (Ctrl+K), til, mavzu, bildirishnomalar va profil menyusi. */
export function PanelHeader({ role }: { role: Role | null }) {
  const navigate = useNavigate();
  const hasSession = useAuthStore((s) => s.hasSession);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const current = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0]!;

  const { user, panelRole, isAdmin, isSuper, name, displayName, roleText, profilePath } = usePanelIdentity(role);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useCommandShortcut(openSearch);
  const navItems = getNavItems(panelRole, { superAdmin: isSuper, permissions: user?.adminPermissions, canCreateAdmins: !!user?.canCreateAdmins });
  const home = getNavItems(panelRole, { superAdmin: true })[0]?.to ?? '/';
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

        {!guest && (
          <button type="button" className="gm-aheader__search" onClick={openSearch} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
            <Search aria-hidden="true" />
            <span className="gm-aheader__search-text">{t('Qidirish…')}</span>
            <kbd aria-hidden="true">{SHORTCUT_LABEL}</kbd>
          </button>
        )}

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
              icon: item.code === lang ? <Check size={16} /> : <span className="gm-dropdown__gap" />,
              onSelect: () => setLanguage(item.code),
            }))}
          />

          <div className="gm-aheader__theme" role="group" aria-label={t('Mavzu')}>
            <Tab aria-pressed={mode === 'light'} aria-label={t('Yorug‘ mavzu')} title={t('Yorug‘ mavzu')} onClick={() => setTheme('light')} selected={mode === 'light'}>
              <Sun size={17} strokeWidth={2} />
            </Tab>
            <Tab aria-pressed={mode === 'dark'} aria-label={t('Qorong‘i mavzu')} title={t('Qorong‘i mavzu')} onClick={() => setTheme('dark')} selected={mode === 'dark'}>
              <Moon size={17} strokeWidth={2} />
            </Tab>
          </div>

          {guest ? (
            <span className="gm-aheader__guest">
              <Link to="/register" className="gm-button gm-button--ghost gm-button--sm">{t('Ro‘yxatdan o‘tish')}</Link>
              <Link to="/login" className="gm-button gm-button--primary gm-button--sm">{t('Kirish')}</Link>
            </span>
          ) : (
            <>
            <NotificationBell />

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
                    <strong>{displayName}</strong>
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
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} items={navItems} />
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </header>
  );
}
