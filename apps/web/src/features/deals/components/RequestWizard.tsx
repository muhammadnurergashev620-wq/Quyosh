import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, EyeOff, Lock, MapPin, Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { calcService } from '@/features/calc/calc.service';
import { kw, SYSTEM_TYPE, sumShort } from '@/features/calc/labels';
import type { SystemType } from '@/features/calc/types';
import { publicShopsService } from '@/features/catalog/public-shops.service';
import { mapService } from '@/features/map/map.service';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime } from '@/lib/utils';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { t } from '@/i18n';
import { dealsService } from '../deals.service';
import '@/features/calc/calc.css';
import { responseTime } from '../labels';

type Basis = { kind: 'calc' | 'site'; id: string; title: string; systemType?: SystemType; powerKw?: number; siteId?: string | null };
interface PickShop { id: string; name: string; ratingAvg: string; ratingCount: number; distanceKm?: number; avgResponseMinutes?: number | null; serving: boolean }

const STEPS = [t('Asos'), t('Ehtiyojlar'), t('Do‘konlar'), t('Tekshirish')];

/**
 * U9.1: taklif so‘rovi — 4 qadam (asos → ehtiyojlar → 1–5 do‘kon → tekshirish). Cheklovlar (3 ochiq, kuniga 5) oldindan ko‘rsatiladi.
 * Xizmat hududi mijoz nuqtasini qamraydigan do‘konlar birinchi (TZ 3.4).
 */
export function RequestWizard({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { calculationId?: string; shopId?: string } }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [basis, setBasis] = useState<Basis | null>(null);
  const [systemType, setSystemType] = useState<SystemType>('ON_GRID');
  const [capacity, setCapacity] = useState('');
  const [battery, setBattery] = useState(false);
  const [installation, setInstallation] = useState(true);
  const [financing, setFinancing] = useState(false);
  const [notes, setNotes] = useState('');
  const [shopIds, setShopIds] = useState<string[]>(preset?.shopId ? [preset.shopId] : []);
  const [search, setSearch] = useState('');
  const [done, setDone] = useState<{ id: string; number: number; shopCount: number } | null>(null);

  const limits = useQuery({ queryKey: ['quote-limits'], queryFn: dealsService.limits, enabled: open });
  const calcs = useQuery({ queryKey: ['calculations'], queryFn: calcService.list, enabled: open });
  const sites = useQuery({ queryKey: ['sites'], queryFn: mapService.sites, enabled: open });

  // Asos nuqtasi: obyekt yoki hisob kiritmasidagi joylashuv.
  const calcDetail = useQuery({ queryKey: ['calculation', basis?.id], queryFn: () => calcService.get(basis!.id), enabled: open && basis?.kind === 'calc' });
  const point = useMemo<[number, number] | null>(() => {
    if (basis?.kind === 'site') {
      const site = sites.data?.find((s) => s.id === basis.id);
      return site ? [site.lon, site.lat] : null;
    }
    const input = calcDetail.data?.input as { lat?: number; lon?: number } | undefined;
    return input?.lat && input?.lon ? [input.lon, input.lat] : null;
  }, [basis, sites.data, calcDetail.data]);
  const serving = useQuery({ queryKey: ['serving', point], queryFn: () => mapService.serving(point!, installation ? 'INSTALLATION' : undefined), enabled: open && step >= 2 && !!point });
  const all = useQuery({ queryKey: ['public-shops', search], queryFn: () => publicShopsService.list({ search: search || undefined }), enabled: open && step >= 2 });

  const shops = useMemo<PickShop[]>(() => {
    const out: PickShop[] = (serving.data ?? []).map((s) => ({ id: s.id, name: s.name, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount, distanceKm: s.distanceKm, serving: true }));
    for (const s of all.data?.items ?? []) if (!out.some((x) => x.id === s.id)) out.push({ id: s.id, name: s.name, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount, avgResponseMinutes: s.avgResponseMinutes, serving: false });
    return search ? out.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) : out;
  }, [serving.data, all.data, search]);

  // Preset: hisobdan kelganda — asos avtomatik.
  useEffect(() => {
    if (!open || basis || !preset?.calculationId || !calcs.data) return;
    const row = calcs.data.find((c) => c.id === preset.calculationId);
    if (row) choose({ kind: 'calc', id: row.id, title: row.title || t('Hisob'), systemType: row.systemType, powerKw: row.systemPowerKw, siteId: row.site?.id ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, calcs.data]);

  function choose(b: Basis) {
    setBasis(b);
    if (b.systemType) {
      setSystemType(b.systemType);
      setBattery(b.systemType !== 'ON_GRID');
    }
    if (b.powerKw) setCapacity(String(Math.round(b.powerKw * 10) / 10));
  }

  const requestBody = {
    calculationId: basis?.kind === 'calc' ? basis.id : undefined,
    siteId: basis?.kind === 'site' ? basis.id : (basis?.siteId ?? undefined),
    title: basis?.title,
    systemType,
    requiredCapacityKw: capacity ? Number(capacity.replace(',', '.')) : undefined,
    batteryNeeded: battery,
    installationNeeded: installation,
    financingInterest: financing,
    notes: notes.trim() || undefined,
    shopIds,
  };
  const idem = useIdempotencyKey(requestBody);
  const create = useMutation({
    mutationFn: () => dealsService.createRequest(requestBody, idem.key),
    onSuccess: (res) => {
      idem.rotate();
      setDone(res);
      void queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['quote-limits'] });
    },
  });

  function close() {
    setStep(0);
    setDone(null);
    create.reset();
    onClose();
  }

  const max = limits.data?.maxShops ?? 5;
  const toggle = (id: string) => setShopIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < max ? [...cur, id] : cur));
  const blocked = limits.data && !limits.data.canCreate;
  const canNext = step === 0 ? !!basis : step === 2 ? shopIds.length >= 1 : true;
  const picked = shops.filter((s) => shopIds.includes(s.id));

  const footer = done ? (
    <Button onClick={() => { close(); navigate(`/mijoz/sorovlar/${done.id}`); }}>{t('So‘rovni ochish')}</Button>
  ) : (
    <div className="qs-form__actions" style={{ width: '100%' }}>
      {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{t('Orqaga')}</Button>}
      {step < 3 ? (
        <Button disabled={!canNext || !!blocked} onClick={() => setStep(step + 1)}>{t('Davom etish')}</Button>
      ) : (
        <Button loading={create.isPending} disabled={!!blocked} onClick={() => create.mutate()}>{t('Yuborish')}</Button>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={close} title={done ? t('So‘rov yuborildi') : t('Taklif so‘rash')} wide footer={footer}>
      {done ? (
        <div className="qs-page" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <CheckCircle2 size={48} color="var(--qs-color-success)" />
          <h2 style={{ margin: 0 }}>{t('So‘rov №{n}', { n: done.number })}</h2>
          <p className="qs-muted" style={{ margin: 0 }}>{t('{n} ta do‘konga yuborildi.', { n: done.shopCount })}</p>
          <p style={{ margin: 0 }}>{t('Do‘konlar odatda 24 soat ichida javob beradi; javob kelsa SMS va bildirishnoma orqali xabar beramiz.')}</p>
        </div>
      ) : (
        <div className="qs-form">
          <ol className="qs-steps" aria-label={t('Qadamlar')}>
            {STEPS.map((label, i) => <li key={label} className={cx(i < step && 'is-done', i === step && 'is-current')}><button type="button" disabled={i > step} onClick={() => setStep(i)}>{i + 1}. {label}</button></li>)}
          </ol>
          {limits.data && (
            blocked ? (
              <Alert tone="warning">
                {limits.data.open >= limits.data.maxOpen
                  ? t('Bir vaqtda ko‘pi bilan {n} ta ochiq so‘rov bo‘lishi mumkin. Avvalgisini yoping yoki natijasini kuting.', { n: limits.data.maxOpen })
                  : t('Bugun {n} ta so‘rov yubordingiz. Yana {at} dan keyin yuborishingiz mumkin.', { n: limits.data.today, at: formatDateTime(limits.data.nextAvailableAt) })}
              </Alert>
            ) : (
              <small className="qs-muted">{t('Ochiq so‘rovlar: {o} / {mo} · bugun: {d} / {md}', { o: limits.data.open, mo: limits.data.maxOpen, d: limits.data.today, md: limits.data.maxPerDay })}</small>
            )
          )}

          {step === 0 && (
            <>
              <h3 style={{ margin: 0 }}>{t('Saqlangan hisob yoki obyektni tanlang')}</h3>
              {!calcs.data?.length && !sites.data?.length ? (
                <Alert tone="info">{t('Avval tez hisob qiling — so‘rovga hisob natijasi qo‘shiladi.')} <Link to="/mijoz/kalkulyator">{t('Kalkulyatorga o‘tish')}</Link></Alert>
              ) : (
                <div className="qs-basis">
                  {calcs.data?.map((c) => (
                    <button key={c.id} type="button" className={cx(basis?.kind === 'calc' && basis.id === c.id && 'is-on')} onClick={() => choose({ kind: 'calc', id: c.id, title: c.title || t('Hisob'), systemType: c.systemType, powerKw: c.systemPowerKw, siteId: c.site?.id ?? null })}>
                      <strong>{c.title || t('Hisob')}</strong>
                      <small>{formatDate(c.createdAt)} · {kw(c.systemPowerKw)} · {SYSTEM_TYPE[c.systemType].title}</small>
                      <small>{sumShort(c.initialCost)}</small>
                    </button>
                  ))}
                  {sites.data?.map((s) => (
                    <button key={s.id} type="button" className={cx(basis?.kind === 'site' && basis.id === s.id && 'is-on')} onClick={() => choose({ kind: 'site', id: s.id, title: s.title })}>
                      <strong><MapPin size={13} /> {s.title}</strong>
                      <small>{t('Obyekt')} · {t('{n} m² foydali', { n: Math.round(Number(s.usableAreaM2)) })}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="qs-segment" role="radiogroup" aria-label={t('Tizim turi')}>
                {(['ON_GRID', 'HYBRID', 'OFF_GRID'] as SystemType[]).map((st) => (
                  <button key={st} type="button" role="radio" aria-checked={systemType === st} className={cx(systemType === st && 'is-on')} onClick={() => { setSystemType(st); setBattery(st !== 'ON_GRID'); }}>{SYSTEM_TYPE[st].title}</button>
                ))}
              </div>
              <Input label={t('Kerakli quvvat')} suffix={t('kVt')} inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^\d.,]/g, ''))} hint={basis?.powerKw ? t('Hisobdan olindi') : undefined} />
              <div className="qs-chips">
                <label className="qs-check"><input type="checkbox" checked={battery} onChange={(e) => setBattery(e.target.checked)} /> {t('Akkumulyator kerak')}</label>
                <label className="qs-check"><input type="checkbox" checked={installation} onChange={(e) => setInstallation(e.target.checked)} /> {t('Montaj kerak')}</label>
                <label className="qs-check"><input type="checkbox" checked={financing} onChange={(e) => setFinancing(e.target.checked)} /> {t('Kredit/bo‘lib to‘lash qiziqtiradi')}</label>
              </div>
              <Textarea label={t('Izoh (ixtiyoriy)')} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} hint={t('{n} / 2000', { n: notes.length })} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="qs-page__actions" style={{ justifyContent: 'space-between' }}>
                <strong>{t('Tanlangan: {n} / {max}', { n: shopIds.length, max })}</strong>
                <input className="qs-input-sm" style={{ minWidth: 220 }} placeholder={t('Do‘kon nomi')} aria-label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {shopIds.length >= max && <small className="qs-muted">{t('Ko‘pi bilan {n} ta do‘kon tanlash mumkin — boshqasini tanlash uchun birini olib tashlang.', { n: max })}</small>}
              <div className="qs-pick-list">
                {shops.map((s) => {
                  const on = shopIds.includes(s.id);
                  return (
                    <div key={s.id} className={cx('qs-pick', on && 'is-on')}>
                      <div>
                        <strong>{s.name}</strong> {s.serving && <Badge tone="success">{t('Hududingizga xizmat qiladi')}</Badge>}
                        <small>
                          <Star size={12} /> {Number(s.ratingAvg).toFixed(1)} ({s.ratingCount}){s.distanceKm !== undefined ? ` · ${t('{n} km', { n: s.distanceKm })}` : ''}
                          {responseTime(s.avgResponseMinutes) ? ` · ${responseTime(s.avgResponseMinutes)}` : ''}
                        </small>
                      </div>
                      <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={!on && shopIds.length >= max} onClick={() => toggle(s.id)}>{on ? t('Olib tashlash') : t('Tanlash')}</Button>
                    </div>
                  );
                })}
                {!shops.length && <p className="qs-muted">{t('Do‘kon topilmadi')}</p>}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <dl className="qs-dl">
                <div><dt>{t('Asos')}</dt><dd>{basis?.title}</dd></div>
                <div><dt>{t('Tizim')}</dt><dd>{SYSTEM_TYPE[systemType].title}{capacity ? ` · ${capacity} ${t('kVt')}` : ''}</dd></div>
                <div><dt>{t('Ehtiyojlar')}</dt><dd>{[battery && t('akkumulyator'), installation && t('montaj'), financing && t('kredit')].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt>{t('Do‘konlar')}</dt><dd>{picked.map((s) => s.name).join(', ') || t('{n} ta', { n: shopIds.length })}</dd></div>
              </dl>
              <Alert tone="info" title={t('Do‘konlar nimani ko‘radi')}>
                <p style={{ margin: 0 }}>{t('Kontakt ochilmaguncha: tuman, tizim parametrlari, hisob xulosasi va ismingiz.')}</p>
                <p className="qs-lock" style={{ margin: '6px 0 0' }}><EyeOff size={14} /> {t('Telefon, aniq manzil va tom chizmasi ko‘rinmaydi.')}</p>
                <p className="qs-lock" style={{ margin: '4px 0 0' }}><Lock size={14} /> {t('Kontaktni o‘zingiz ochasiz — yoki o‘lchovni tasdiqlaganingizda / taklifni tanlaganingizda.')}</p>
              </Alert>
              {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
