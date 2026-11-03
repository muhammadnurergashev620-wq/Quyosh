import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, PackageCheck, Search, Users } from 'lucide-react';
import { getNavItems } from '@/components/layout/nav-items';
import { useMe } from '@/features/session/hooks/useMe';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import './AdminSearch.css';

/** Tezkor qidiruv: bo‘lim nomi bo‘yicha o‘tish yoki foydalanuvchi/buyurtma qidirish (Enter). */
export function AdminSearch() {
  const navigate = useNavigate();
  const me = useMe();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const text = value.trim();

  const options = useMemo(() => {
    if (!text) return [];
    const needle = text.toLowerCase();
    const sections = getNavItems('ADMIN', { superAdmin: !!me.data?.isSuperAdmin, permissions: me.data?.adminPermissions, canCreateAdmins: !!me.data?.canCreateAdmins })
      .filter((item) => item.label.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((item) => ({ key: `s-${item.to}`, icon: <Search size={16} />, label: item.label, hint: t('Bo‘lim'), to: item.to }));
    const q = encodeURIComponent(text);
    return [
      ...sections,
      { key: 'u', icon: <Users size={16} />, label: t('Foydalanuvchilar: «{text}»', { text }), hint: t('Ism, telefon yoki ID'), to: `/admin/foydalanuvchilar?q=${q}` },
      { key: 'o', icon: <PackageCheck size={16} />, label: t('Buyurtmalar: «{text}»', { text }), hint: t('Raqam, mijoz yoki usta'), to: `/admin/buyurtmalar?q=${q}` },
    ];
  }, [text, me.data]);

  const go = (to: string) => {
    setOpen(false);
    setValue('');
    navigate(to);
  };

  return (
    <div className="gm-asearch">
      <Search size={18} aria-hidden="true" className="gm-asearch__icon" />
      <input
        ref={input}
        type="search"
        value={value}
        placeholder={t('Bo‘lim, foydalanuvchi yoki buyurtma qidirish…')}
        aria-label={t('Qidirish')}
        autoComplete="off"
        onChange={(event) => { setValue(event.target.value); setOpen(true); setIndex(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((i) => Math.min(options.length - 1, i + 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
          else if (event.key === 'Enter' && options[index]) go(options[index]!.to);
          else if (event.key === 'Escape') { setOpen(false); input.current?.blur(); }
        }}
      />
      {open && options.length > 0 && (
        <ul className="gm-asearch__menu" role="listbox">
          {options.map((option, i) => (
            <li key={option.key} role="option" aria-selected={i === index}>
              <button type="button" className={cx(i === index && 'is-on')} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setIndex(i)} onClick={() => go(option.to)}>
                <span className="gm-asearch__ico">{option.icon}</span>
                <span className="gm-asearch__txt"><strong>{option.label}</strong><small>{option.hint}</small></span>
                {i === index && <CornerDownLeft size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
