import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Moon, Search, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getThemeMode, setThemeMode } from '@/lib/theme';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import type { NavItem } from './nav-items';
import './CommandPalette.css';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}


/** Lotin/kirill harflarini bir xil solishtirish uchun (o‘, g‘ apostroflari ham). */
const norm = (value: string) => value.toLowerCase().replace(/[‘’ʻ'`]/g, '');

/** ⌘K / Ctrl+K: bo‘limlar bo‘yicha tezkor qidiruv va o‘tish (↑/↓, Enter, Esc). */
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: NavItem[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const previous = useRef<HTMLElement | null>(null);

  const dark = getThemeMode() === 'dark';
  const commands = useMemo<Command[]>(() => [
    ...items.map((item) => ({ id: item.to, label: item.label, hint: item.group, icon: item.icon, run: () => navigate(item.to) })),
    { id: 'theme', label: dark ? t('Yorug‘ mavzu') : t('Qorong‘i mavzu'), hint: t('Mavzu'), icon: dark ? Sun : Moon, run: () => setThemeMode(dark ? 'light' : 'dark') },
  ], [items, navigate, dark]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    return q ? commands.filter((command) => norm(`${command.label} ${command.hint}`).includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => previous.current?.focus();
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); run(results[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'Tab') event.preventDefault();
  }

  return createPortal(
    <div className="gm-cmdk__overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="gm-cmdk" role="dialog" aria-modal="true" aria-label={t('Qidiruv')}>
        <div className="gm-cmdk__field">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('Bo‘lim yoki amalni qidiring…')}
            role="combobox"
            aria-expanded="true"
            aria-controls="gm-cmdk-list"
            aria-activedescendant={results[active] ? `gm-cmdk-${active}` : undefined}
            aria-autocomplete="list"
          />
          <kbd>Esc</kbd>
        </div>
        <ul ref={listRef} id="gm-cmdk-list" className="gm-cmdk__list" role="listbox" aria-label={t('Natijalar')}>
          {results.length === 0 && <li className="gm-cmdk__empty">{t('Hech narsa topilmadi')}</li>}
          {results.map((command, index) => (
            <li
              key={command.id}
              id={`gm-cmdk-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === active}
              className={cx('gm-cmdk__item', index === active && 'is-active')}
              onMouseMove={() => setActive(index)}
              onClick={() => run(command)}
            >
              <span className="gm-cmdk__icon" aria-hidden="true"><command.icon /></span>
              <span className="gm-cmdk__label">{command.label}</span>
              <span className="gm-cmdk__hint">{command.hint}</span>
              {index === active && <CornerDownLeft className="gm-cmdk__enter" aria-hidden="true" />}
            </li>
          ))}
        </ul>
        <p className="gm-cmdk__foot" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> {t('tanlash')} · <kbd>Enter</kbd> {t('ochish')} · <kbd>Esc</kbd> {t('yopish')}</p>
      </div>
    </div>,
    document.body,
  );
}
