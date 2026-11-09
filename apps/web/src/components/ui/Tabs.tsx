import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@/lib/utils';
import './system.css';

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Tabs va Segmented (U5) — bitta komponent. Faol indikator siljiydi (260 ms), hisoblagich badge, strelkalar bilan boshqaruv;
 * mobilda gorizontal skroll, chetlarida fade.
 */
export function Tabs<V extends string>({ items, value, onChange, variant = 'tabs', size = 'md', label, className, fullWidth = false }: {
  items: Array<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  variant?: 'tabs' | 'segmented';
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active) return setIndicator(null);
    const update = () => setIndicator({ x: active.offsetLeft, w: active.offsetWidth });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(list);
    return () => ro.disconnect();
  }, [value, items.length]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    const item = enabled[next];
    if (item) {
      onChange(item.value);
      listRef.current?.querySelector<HTMLElement>(`[data-value="${item.value}"]`)?.focus();
    }
  };

  return (
    <div className={cx('gm-tabs-x', `gm-tabs-x--${variant}`, `gm-tabs-x--${size}`, fullWidth && 'gm-tabs-x--full', className)}>
      <div ref={listRef} className="gm-tabs-x__list" role="tablist" aria-label={label} onKeyDown={move}>
        {indicator && <span className="gm-tabs-x__indicator" aria-hidden="true" style={{ '--x': `${indicator.x}px`, '--w': `${indicator.w}px` } as React.CSSProperties} />}
        {items.map((item) => {
          const on = item.value === value;
          return (
            <button key={item.value} type="button" role="tab" data-value={item.value} aria-selected={on} tabIndex={on ? 0 : -1} disabled={item.disabled} className={cx('gm-tabs-x__tab', on && 'is-on')} onClick={() => onChange(item.value)}>
              {item.icon && <span className="gm-tabs-x__icon" aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && <span className="gm-tabs-x__count">{item.count > 99 ? '99+' : item.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ACTIVE = '.is-on, [aria-selected="true"], [aria-checked="true"]';

/**
 * Mavjud tugmalar uchun yagona tab/segment paneli: bolalar `<button>` lar, faoli `.is-on` / `aria-selected` / `aria-checked` dan
 * avtomatik topiladi; indikator siljiydi (260 ms), ←/→ bilan o‘tiladi. `Tabs` bilan bir xil ko‘rinish.
 */
export function TabBar({ variant = 'tabs', children, className, role = 'tablist', fullWidth = false, ...rest }: { variant?: 'tabs' | 'segmented'; children: ReactNode; className?: string; role?: string; fullWidth?: boolean; 'aria-label'?: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const active = list.querySelector<HTMLElement>(`:scope > ${ACTIVE.split(', ').join(`, :scope > `)}`);
      setIndicator(active ? { x: active.offsetLeft, w: active.offsetWidth } : null);
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-checked'] });
    const ro = new ResizeObserver(update);
    ro.observe(list);
    return () => { mo.disconnect(); ro.disconnect(); };
  }, []);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)') ?? []);
    const index = buttons.findIndex((b) => b === document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    next?.click();
  };

  return (
    <div className={cx('gm-tabs-x', `gm-tabs-x--${variant}`, fullWidth && 'gm-tabs-x--full', className)}>
      <div ref={listRef} className="gm-tabs-x__list gm-tabs-x__list--auto" role={role} onKeyDown={onKey} {...rest}>
        {indicator && <span className="gm-tabs-x__indicator" aria-hidden="true" style={{ '--x': `${indicator.x}px`, '--w': `${indicator.w}px` } as React.CSSProperties} />}
        <TabBarRole.Provider value={role}>{children}</TabBarRole.Provider>
      </div>
    </div>
  );
}

/** TabBar roli (tablist / radiogroup / group) — ichidagi `Tab` mos ARIA rolini o‘zi oladi. */
const TabBarRole = createContext<string | null>(null);

/** TabBar ichidagi tab yoki segment tugmasi (yoki tanlov tugmasi): `selected` — faol. ARIA (role, aria-selected/checked/pressed) TabBar roliga qarab avtomatik. */
export function Tab({ selected = false, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  const parent = useContext(TabBarRole);
  const aria: Record<string, unknown> =
    parent === 'tablist' ? { role: 'tab', 'aria-selected': selected, tabIndex: selected ? 0 : -1 }
      : parent === 'radiogroup' ? { role: 'radio', 'aria-checked': selected }
        : parent ? { 'aria-pressed': selected } : {};
  return (
    <button type="button" className={cx('gm-tab-btn', selected && 'is-on', className)} {...aria} {...rest}>
      {children}
    </button>
  );
}
