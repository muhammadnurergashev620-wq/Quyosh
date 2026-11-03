import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cx } from '@/lib/utils';
import type { RangeInputs } from '../range';
import { t } from '@/i18n';
import './DateRangeFilter.css';

const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const daysAgo = (days: number) => iso(new Date(Date.now() - days * 86_400_000));

type Preset = 'all' | 'today' | '7' | '30' | 'custom';

function detect(value: RangeInputs): Preset {
  if (!value.from && !value.to) return 'all';
  const today = iso(new Date());
  if (value.from === today && value.to === today) return 'today';
  if (value.to === today && value.from === daysAgo(6)) return '7';
  if (value.to === today && value.from === daysAgo(29)) return '30';
  return 'custom';
}

/** Davr tanlash: tayyor tugmalar (Hammasi / Bugun / 7 kun / 30 kun) va «Boshqa» — qo‘lda sana oralig‘i. */
export function DateRangeFilter({ value, onChange, withAll = true, showCalendarIcon = true }: { value: RangeInputs; onChange: (next: RangeInputs) => void; withAll?: boolean; showCalendarIcon?: boolean }) {
  const [forceCustom, setForceCustom] = useState(false);
  const active: Preset = forceCustom ? 'custom' : detect(value);
  const today = iso(new Date());
  const presets: Array<{ id: Preset; label: string; range?: RangeInputs }> = [
    ...(withAll ? [{ id: 'all' as Preset, label: t('Hammasi'), range: { from: '', to: '' } }] : []),
    { id: 'today', label: t('Bugun'), range: { from: today, to: today } },
    { id: '7', label: t('7 kun'), range: { from: daysAgo(6), to: today } },
    { id: '30', label: t('30 kun'), range: { from: daysAgo(29), to: today } },
    { id: 'custom', label: t('Boshqa davr') },
  ];
  return (
    <div className="gm-range">
      <div className="gm-range__chips" role="group" aria-label={t('Davr')}>
        {showCalendarIcon && <CalendarDays size={16} aria-hidden="true" className="gm-range__icon" />}
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cx('gm-range__chip', active === preset.id && 'is-on')}
            aria-pressed={active === preset.id}
            onClick={() => {
              if (preset.range) {
                setForceCustom(false);
                onChange(preset.range);
              } else {
                setForceCustom(true);
              }
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {active === 'custom' && (
        <div className="gm-range__custom">
          <Input label={t('Boshlanish sanasi')} type="date" max={value.to || undefined} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <Input label={t('Tugash sanasi')} type="date" min={value.from || undefined} value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
