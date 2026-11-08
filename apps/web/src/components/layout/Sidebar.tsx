import { Link, NavLink, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { badgeText, useNavBadges } from '@/features/admin/hooks/useNavBadges';
import { useAuthStore } from '@/store/auth.store';
import { UserAvatar } from '@/components/common/UserAvatar';
import { setSidebarCollapsed, useSidebarCollapsed } from '@/lib/sidebar';
import { cx } from '@/lib/utils';
import { getNavItems } from './nav-items';
import type { NavItem } from './nav-items';
import { usePanelIdentity } from './usePanelIdentity';
import { t } from '@/i18n';
import './Sidebar.css';

function groupItems(items: NavItem[]): Array<[string, NavItem[]]> {
  const groups = new Map<string, NavItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.entries()];
}

/**
 * Yon panel: guruhlar (Mono sarlavha), faol bo‘lim — primary-soft fon + chapda 3 px chiziq, hisoblagichlar,
 * pastda foydalanuvchi kartasi va yig‘ish tugmasi (72 px; yig‘ilganda nomlar tooltipda).
 */
export function Sidebar() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const hasSession = useAuthStore((state) => state.hasSession);
  const { user, displayName, roleText, profilePath } = usePanelIdentity(preferredRole);
  const groups = groupItems(getNavItems(preferredRole, { superAdmin: !!user?.isSuperAdmin, permissions: user?.adminPermissions, canCreateAdmins: !!user?.canCreateAdmins }));
  const { pathname } = useLocation();
  const badges = useNavBadges(preferredRole, pathname);
  const collapsed = useSidebarCollapsed();

  return (
    <nav className={cx('gm-sidebar', collapsed && 'is-collapsed')} aria-label={t('Asosiy navigatsiya')}>
      <div className="gm-sidebar__scroll">
        {groups.map(([group, items]) => (
          <div key={group} className="gm-sidebar__group">
            <p className="gm-sidebar__heading">{group}</p>
            <ul className="gm-sidebar__list">
              {items.map((item) => {
                const badge = badges[item.to];
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/admin' || item.to === '/dokon'}
                      className={({ isActive }) => cx('gm-sidebar__link', isActive && 'gm-sidebar__link--active')}
                      data-tip={collapsed ? item.label : undefined}
                    >
                      <item.icon aria-hidden="true" />
                      <span className="gm-sidebar__label">{item.label}</span>
                      {badge && (
                        <span className={cx('gm-nav-badge', collapsed && 'gm-nav-badge--dot')} role="status" aria-label={t('{count} ta yangi', { count: badge.count })}>
                          {collapsed ? null : badgeText(badge)}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="gm-sidebar__foot">
        {hasSession && (
          <Link to={profilePath} className="gm-sidebar__user" data-tip={collapsed ? displayName : undefined}>
            <UserAvatar name={displayName} seed={user?.id ?? 'user'} size="sm" src={user?.avatar} />
            <span className="gm-sidebar__who">
              <strong>{displayName}</strong>
              <small>{roleText}</small>
            </span>
          </Link>
        )}
        <button
          type="button"
          className="gm-sidebar__collapse"
          aria-pressed={collapsed}
          aria-label={collapsed ? t('Yon panelni yoyish') : t('Yon panelni yig‘ish')}
          data-tip={collapsed ? t('Yon panelni yoyish') : undefined}
          onClick={() => setSidebarCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          <span className="gm-sidebar__label">{t('Yig‘ish')}</span>
        </button>
      </div>
    </nav>
  );
}
