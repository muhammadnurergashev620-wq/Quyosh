import { Children, forwardRef, isValidElement, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './SelectMenu.css';

interface Opt { value: string; label: string; disabled?: boolean }

function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean; label?: string };
    if (child.type === 'option') {
      const text = typeof props.children === 'string' || typeof props.children === 'number' ? String(props.children) : Children.toArray(props.children).join('');
      out.push({ value: String(props.value ?? text), label: props.label ?? text, disabled: props.disabled });
    } else if (child.type === 'optgroup') out.push(...readOptions(props.children));
  });
  return out;
}

const setNativeValue = (select: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

export type SelectMenuProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { /** Variantlar 8 tadan ko‘p bo‘lsa — qidiruv (true/false bilan majburlash mumkin). */ searchable?: boolean; uiSize?: 'sm' | 'md'; invalid?: boolean };

/**
 * Maxsus ochiluvchi ro‘yxat (U5): nativ `<select>` ko‘rinishi yo‘q. Ichida yashirin nativ select qiymat va hodisalarni boshqaradi —
 * shuning uchun `value/onChange`, `defaultValue`, react-hook-form `register()` va forma yuborish o‘zgarishsiz ishlaydi.
 * Klaviatura: ↑ ↓ Home End, Enter/Space — tanlash, Esc — yopish, harf — tez o‘tish; 8+ variantda qidiruv.
 */
export const SelectMenu = forwardRef<HTMLSelectElement, SelectMenuProps>(({ children, className, disabled, searchable, uiSize: size = 'md', invalid, id, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...rest }, ref) => {
  const options = useMemo(() => readOptions(children), [children]);
  const nativeRef = useRef<HTMLSelectElement>(null);
  useImperativeHandle(ref, () => nativeRef.current!);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(() => String(rest.value ?? rest.defaultValue ?? options[0]?.value ?? ''));
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const listId = useId();
  const withSearch = searchable ?? options.length > 8;

  // Controlled qiymat o‘zgarsa (yoki RHF reset) — ko‘rinish yangilanadi.
  useEffect(() => {
    if (rest.value !== undefined) setCurrent(String(rest.value));
  }, [rest.value]);
  useEffect(() => {
    const el = nativeRef.current;
    if (!el) return;
    const sync = () => setCurrent(el.value);
    el.addEventListener('change', sync);
    sync();
    return () => el.removeEventListener('change', sync);
  }, [options.length]);

  const visible = useMemo(() => (query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options), [options, query]);
  const selected = options.find((o) => o.value === current);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setRect({ left: r.left, top: below < 280 && r.top > below ? r.top : r.bottom, width: r.width, up: below < 280 && r.top > below });
  }, []);

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) triggerRef.current?.focus();
  };
  const choose = (opt: Opt | undefined) => {
    if (!opt || opt.disabled) return;
    if (nativeRef.current) setNativeValue(nativeRef.current, opt.value);
    setCurrent(opt.value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (event: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(visible.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(visible.length - 1); }
    else if (event.key === 'Enter' || (event.key === ' ' && !withSearch)) { event.preventDefault(); choose(visible[active]); }
    else if (event.key === 'Tab') close(false);
    else if (!withSearch && event.key.length === 1) {
      const i = visible.findIndex((o) => o.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <span className={cx('gm-selectx', `gm-selectx--${size}`, (invalid || ariaInvalid === true || ariaInvalid === 'true') && 'is-invalid', disabled && 'is-disabled', className)}>
      <select ref={nativeRef} className="gm-selectx__native" tabIndex={-1} aria-hidden="true" disabled={disabled} {...rest}>
        {children}
      </select>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="gm-selectx__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
      >
        <span className={cx('gm-selectx__value', !selected?.label && 'is-placeholder')}>{selected?.label || t('Tanlang')}</span>
        <ChevronDown className="gm-selectx__chevron" aria-hidden="true" />
      </button>
      {open && rect && createPortal(
        <div
          ref={listRef}
          className={cx('gm-selectx__pop', rect.up && 'is-up')}
          style={{ left: rect.left, top: rect.top, minWidth: rect.width }}
          onKeyDown={onKey}
        >
          {withSearch && (
            <label className="gm-selectx__search">
              <Search aria-hidden="true" />
              <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder={t('Qidirish…')} aria-label={t('Qidirish…')} aria-controls={listId} />
            </label>
          )}
          <div id={listId} role="listbox" className="gm-selectx__list" aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined} tabIndex={withSearch ? -1 : 0} ref={(node) => { if (node && !withSearch) node.focus(); }}>
            {visible.length === 0 && <div className="gm-selectx__empty">{t('Hech narsa topilmadi')}</div>}
            {visible.map((opt, i) => (
              <div
                key={`${opt.value}-${i}`}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={opt.value === current}
                aria-disabled={opt.disabled || undefined}
                className={cx('gm-selectx__opt', i === active && 'is-active', opt.value === current && 'is-selected', opt.disabled && 'is-disabled')}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
              >
                <span>{opt.label}</span>
                {opt.value === current && <Check aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
});
SelectMenu.displayName = 'SelectMenu';
