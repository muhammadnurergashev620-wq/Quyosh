import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';
import { useMe } from '@/features/session/hooks/useMe';
import { badgeText, useNavBadges } from '@/features/admin/hooks/useNavBadges';
import { getNavItems } from './nav-items';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { t } from '@/i18n';
import './MobileNavigation.css';

export function MobileNavigation() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const me = useMe();
  const items = getNavItems(preferredRole, { superAdmin: !!me.data?.isSuperAdmin, permissions: me.data?.adminPermissions, canCreateAdmins: !!me.data?.canCreateAdmins });
  const primary = items.filter((item) => item.primary).slice(0, 4);
  // «Yangi buyurtma» — markazda ko‘tarilgan asosiy amal tugmasi (FAB), qolganlari ikki yonida.
  const fab = primary.find((item) => item.to.endsWith('/sorov-yaratish'));
  const rest = primary.filter((item) => item !== fab);
  const ordered = fab ? [...rest.slice(0, Math.ceil(rest.length / 2)), fab, ...rest.slice(Math.ceil(rest.length / 2))] : primary;
  const groups = [...items.reduce((map, item) => map.set(item.group, [...(map.get(item.group) ?? []), item]), new Map<string, typeof items>())];
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useSheetDrag(sheetRef, () => setOpen(false));

  const badges = useNavBadges(preferredRole, pathname);
  const hiddenBadge = items.some((item) => !primary.includes(item) && badges[item.to]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <nav className="gm-mobile-nav" aria-label={t('Asosiy navigatsiya')}>
        {ordered.map((item) =>
          item === fab ? (
            <NavLink key={item.to} to={item.to} className="gm-mobile-nav__fab" aria-label={item.label}>
              <Plus size={26} strokeWidth={2.4} aria-hidden="true" />
              <span>{item.short ?? item.label}</span>
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/dokon'}
              className={({ isActive }) => `gm-mobile-nav__link${isActive ? ' gm-mobile-nav__link--active' : ''}`}
            >
              <span className="gm-mobile-nav__icon">
                <item.icon size={22} strokeWidth={2} aria-hidden="true" />
                {badges[item.to] && <span className="gm-nav-badge gm-nav-badge--corner">{badgeText(badges[item.to]!)}</span>}
              </span>
              <span>{item.short ?? item.label}</span>
            </NavLink>
          ),
        )}
        <button
          type="button"
          className="gm-mobile-nav__link"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="gm-mobile-nav__icon">
            <LayoutGrid size={22} strokeWidth={2} aria-hidden="true" />
            {hiddenBadge && <span className="gm-nav-badge gm-nav-badge--dot" aria-hidden="true" />}
          </span>
          <span>{t('Ko‘proq')}</span>
        </button>
      </nav>

      {open && (
        <div className="gm-sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div ref={sheetRef} className="gm-sheet" role="dialog" aria-modal="true" aria-label={t('Barcha bo‘limlar')}>
            <div className="gm-sheet__grab" aria-hidden="true" {...drag} />
            <div className="gm-sheet__header">
              <h2>{t('Bo‘limlar')}</h2>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('Yopish')} onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
            {groups.map(([group, groupItems]) => (
              <section key={group} className="gm-sheet__group" aria-label={group}>
                <h3 className="gm-sheet__heading">{group}</h3>
                <div className="gm-sheet__grid">
                  {groupItems.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/admin' || item.to === '/dokon'} className="gm-sheet__item">
                      <span className="gm-sheet__icon">
                        <item.icon aria-hidden="true" />
                        {badges[item.to] && <span className="gm-nav-badge gm-nav-badge--corner">{badgeText(badges[item.to]!)}</span>}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
