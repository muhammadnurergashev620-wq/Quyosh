import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './Dropdown.css';

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
  /** O‘ng tomondagi qo‘shimcha element (masalan, almashtirgich). */
  trailing?: ReactNode;
  /** Tanlanganda menyu yopilmaydi. */
  keepOpen?: boolean;
  /** Elementdan oldin ajratuvchi chiziq. */
  separator?: boolean;
}

export function Dropdown({ trigger, items, triggerClassName, menuClassName, label }: { trigger: ReactNode; items: DropdownItem[]; triggerClassName?: string; menuClassName?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function focusItem(delta: number) {
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + delta + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  }

  return (
    <div className="gm-dropdown" ref={rootRef}>
      <button
        type="button"
        className={cx('gm-dropdown__trigger', triggerClassName)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div className={cx('gm-dropdown__menu', menuClassName)} role="menu" ref={menuRef}>
          {items.map((item) => (
            <Fragment key={item.label}>
              {item.separator && <div className="gm-dropdown__sep" role="separator" />}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx('gm-dropdown__item', item.danger && 'gm-dropdown__item--danger')}
              onClick={() => {
                if (!item.keepOpen) setOpen(false);
                item.onSelect();
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  focusItem(1);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  focusItem(-1);
                }
              }}
            >
              {item.icon && <span aria-hidden="true" className="gm-dropdown__icon">{item.icon}</span>}
              <span className="gm-dropdown__text">{item.label}</span>
              {item.trailing}
            </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
