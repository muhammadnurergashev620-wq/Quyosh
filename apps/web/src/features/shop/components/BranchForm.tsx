import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { REGIONS } from '@/lib/regions';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { usePointPicker } from '@/features/map/editors';
import type { LngLat } from '@/features/map/geometry';
import '@/features/map/map.css';
import { WEEKDAYS } from '../labels';
import type { Branch, BranchInput, OpeningHours, Weekday } from '../types';
import { t } from '@/i18n';

const DEFAULT_HOURS: OpeningHours = { mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], thu: [['09:00', '18:00']], fri: [['09:00', '18:00']], sat: [['10:00', '16:00']] };

/** Hafta kunlari jadvali (U11.8): har kun — ochiq/yopiq va vaqt oralig‘i. */
export function OpeningHoursEditor({ value, onChange }: { value: OpeningHours; onChange: (next: OpeningHours) => void }) {
  const set = (day: Weekday, range: [string, string] | null) => {
    const next = { ...value };
    if (range) next[day] = [range];
    else delete next[day];
    onChange(next);
  };
  return (
    <div className="qs-hours" role="group" aria-label={t('Ish vaqti')}>
      {WEEKDAYS.map(({ key, label }) => {
        const range = value[key]?.[0];
        return (
          <div key={key} className="qs-hours__row">
            <strong>{label}</strong>
            <label className="qs-check">
              <input type="checkbox" checked={!!range} onChange={(e) => set(key, e.target.checked ? ['09:00', '18:00'] : null)} />
              {range ? t('Ochiq') : t('Dam olish')}
            </label>
            {range && (
              <span className="qs-hours__times">
                <input type="time" aria-label={t('{day} ochilish', { day: label })} value={range[0]} onChange={(e) => set(key, [e.target.value, range[1]])} />
                —
                <input type="time" aria-label={t('{day} yopilish', { day: label })} value={range[1]} onChange={(e) => set(key, [range[0], e.target.value])} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BranchForm({ initial, loading, onSubmit, onCancel, submitLabel }: { initial?: Branch; loading?: boolean; onSubmit: (input: BranchInput) => void; onCancel?: () => void; submitLabel?: string }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [regionCode, setRegionCode] = useState(initial?.regionCode ?? '');
  const [phone, setPhone] = useState(initial?.phone?.replace(/^\+998/, '') ?? '');
  const [hours, setHours] = useState<OpeningHours>(initial?.openingHoursJson ?? DEFAULT_HOURS);
  const [active, setActive] = useState((initial?.status ?? 'ACTIVE') === 'ACTIVE');
  const [error, setError] = useState('');
  const [point, setPoint] = useState<LngLat | null>(initial?.lat != null && initial.lon != null ? [initial.lon, initial.lat] : null);
  const { map, onStyleReady } = useMapHandle();
  usePointPicker(map, point, setPoint);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError(t('Filial nomini kiriting'));
    if (address.trim().length < 3) return setError(t('Manzilni kiriting'));
    const digits = phone.replace(/\D/g, '');
    if (digits && digits.length !== 9) return setError(t('Telefon raqami 9 ta raqamdan iborat bo‘lishi kerak'));
    setError('');
    onSubmit({ name: name.trim(), address: address.trim(), regionCode: regionCode || undefined, phone: digits ? `+998${digits}` : undefined, openingHoursJson: hours, status: active ? 'ACTIVE' : 'INACTIVE', lat: point ? point[1] : null, lon: point ? point[0] : null });
  }

  return (
    <form className="qs-form" onSubmit={submit} noValidate>
      <div className="qs-form__row">
        <Input label={t('Filial nomi')} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder={t('Masalan: Chilonzor filiali')} />
        <Select label={t('Viloyat')} value={regionCode} onChange={(e) => setRegionCode(e.target.value)} placeholder={t('Tanlang')} options={REGIONS.map((region) => ({ value: region.code, label: region.name }))} />
      </div>
      <Input label={t('Manzil')} value={address} onChange={(e) => setAddress(e.target.value)} required maxLength={500} />
      <div>
        <span className="gm-field__label">{t('Xaritadagi nuqta')}</span>
        <MapView center={point ?? undefined} zoom={point ? 16 : 11} onStyleReady={onStyleReady} onLocate={setPoint} className="qs-map--form" ariaLabel={t('Filial nuqtasi')}>
          <div className="qs-map__overlay">{point ? t('Nuqta belgilandi — kerak bo‘lsa sudrab aniqlashtiring.') : t('Filial joylashgan joyni xaritada bosing — mijozlar sizni xaritada shu nuqtada ko‘radi.')}</div>
        </MapView>
      </div>
      <Input label={t('Telefon')} prefix="+998" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="90 123 45 67" />
      <div>
        <span className="gm-field__label">{t('Ish vaqti')}</span>
        <OpeningHoursEditor value={hours} onChange={setHours} />
      </div>
      <label className="qs-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('Filial faol')}
      </label>
      {error && <p role="alert" className="gm-field__error">{error}</p>}
      <div className="qs-form__actions">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>}
        <Button type="submit" loading={loading}>{submitLabel ?? t('Saqlash')}</Button>
      </div>
    </form>
  );
}
