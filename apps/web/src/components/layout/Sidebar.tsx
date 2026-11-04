import { NavLink, useLocation } from 'react-router-dom';
import { badgeText, useNavBadges } from '@/features/admin/hooks/useNavBadges';
import { useAuthStore } from '@/store/auth.store';
import { useMe } from '@/features/session/hooks/useMe';
import { getNavItems } from './nav-items';
import type { NavItem } from './nav-items';
import { t } from '@/i18n';
import './Sidebar.css';

function groupItems(items: NavItem[]): Array<[string, NavItem[]]> {
  const groups = new Map<string, NavItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.entries()];
}

export function Sidebar() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const me = useMe();
  const groups = groupItems(getNavItems(preferredRole, { superAdmin: !!me.data?.isSuperAdmin, permissions: me.data?.adminPermissions, canCreateAdmins: !!me.data?.canCreateAdmins }));
  const { pathname } = useLocation();
  const badges = useNavBadges(preferredRole, pathname);

  return (
    <nav className="gm-sidebar" aria-label={t('Asosiy navigatsiya')}>
      {groups.map(([group, items]) => (
        <div key={group} className="gm-sidebar__group">
          <p className="gm-sidebar__heading">{group}</p>
          <ul className="gm-sidebar__list">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/admin' || item.to === '/dokon'}
                  className={({ isActive }) => `gm-sidebar__link${isActive ? ' gm-sidebar__link--active' : ''}`}
                >
                  <item.icon size={19} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {badges[item.to] && (
                    <span className="gm-nav-badge" role="status" aria-label={t('{count} ta yangi', { count: badges[item.to]!.count })}>
                      {badgeText(badges[item.to]!)}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
