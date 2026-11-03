import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { RangeInputs } from '../range';
import { t } from '@/i18n';
import './PeriodPill.css';

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const fmt = (value: string) => {
  const d = new Date(`${value}T00:00:00`);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
};

export type PeriodId = 'all' | 'today' | '7' | '30' | 'custom';

function periodOf(value: RangeInputs): PeriodId {
  if (!value.from && !value.to) return 'all';
  const today = iso(new Date());
  if (value.from === today && value.to === today) return 'today';
  if (value.to === today && value.from === daysAgo(6)) return '7';
  if (value.to === today && value.from === daysAgo(29)) return '30';
  return 'custom';
}

/** Sarlavhadagi davr tanlagich: «Bugun · 9-oktabr, 2026». Ochiluvchi ro‘yxatdan tayyor davr tanlanadi. */
export function PeriodPill({ value, onChange }: { value: RangeInputs; onChange: (next: RangeInputs) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = periodOf(value);
  const today = iso(new Date());
  const options: Array<{ id: PeriodId; label: string; range: RangeInputs }> = [
    { id: 'all', label: t('Hammasi'), range: { from: '', to: '' } },
    { id: 'today', label: t('Bugun'), range: { from: today, to: today } },
    { id: '7', label: t('Oxirgi 7 kun'), range: { from: daysAgo(6), to: today } },
    { id: '30', label: t('Oxirgi 30 kun'), range: { from: daysAgo(29), to: today } },
  ];
  const label = id === 'custom' ? t('Boshqa davr') : (options.find((o) => o.id === id)?.label ?? '');
  const text = id === 'all' ? t('butun davr') : id === 'today' ? fmt(today) : `${value.from ? fmt(value.from) : '…'} – ${value.to ? fmt(value.to) : fmt(today)}`;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="gm-pperiod" ref={box}>
      <button type="button" className="gm-pperiod__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <CalendarDays size={18} aria-hidden="true" />
        <span><b>{label}</b> · {text}</span>
        <ChevronDown size={16} aria-hidden="true" className={cx(open && 'is-open')} />
      </button>
      {open && (
        <ul className="gm-pperiod__menu" role="listbox">
          {options.map((option) => (
            <li key={option.id} role="option" aria-selected={id === option.id}>
              <button type="button" onClick={() => { onChange(option.range); setOpen(false); }}>
                <span>{option.label}</span>
                {id === option.id && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          ))}
          <li className="gm-pperiod__custom" aria-label={t('Boshqa davr')}>
            <label>
              <span>{t('Boshlanish sanasi')}</span>
              <input type="date" max={value.to || undefined} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
            </label>
            <label>
              <span>{t('Tugash sanasi')}</span>
              <input type="date" min={value.from || undefined} value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
            </label>
          </li>
        </ul>
      )}
    </div>
  );
}
