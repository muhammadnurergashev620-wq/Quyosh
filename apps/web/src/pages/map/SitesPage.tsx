import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { MapView, useMapHandle } from '@/features/map/MapView';
import { usePointPicker } from '@/features/map/editors';
import { inUzbekistan, type LngLat } from '@/features/map/geometry';
import { useMapConfig } from '@/features/map/map-config';
import { mapService, type SiteType } from '@/features/map/map.service';
import { SITE_TYPE } from '@/features/map/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { formatNumber } from '@/lib/format';
import { lang, t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/map/map.css';

/** Manzil qidiruvi (Esri, forStorage=false). Mavjud bo‘lmasa — pin va koordinata (TZ 12.1 fallback). */
export function AddressSearch({ onPick }: { onPick: (point: LngLat, label: string) => void }) {
  const config = useMapConfig();
  const [q, setQ] = useState('');
  const search = useMutation({ mutationFn: () => mapService.geocode(q.trim(), lang === 'ru' ? 'ru' : 'uz') });
  if (!config.data?.geocodingAvailable) return <p className="qs-muted" style={{ margin: 0 }}>{t('Manzil qidiruvi hozircha mavjud emas — xaritada nuqta qo‘ying yoki «Mening joylashuvim»ni bosing.')}</p>;
  return (
    <div className="qs-form" style={{ gap: 8 }}>
      <form className="qs-toolbar" onSubmit={(e: FormEvent) => { e.preventDefault(); if (q.trim().length >= 2) search.mutate(); }}>
        <Input label={t('Manzilni qidirish')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Masalan: Yunusobod 4-kvartal')} />
        <Button type="submit" variant="secondary" loading={search.isPending}><Search size={16} /></Button>
      </form>
      {search.isError && <Alert tone="warning">{getErrorMessage(search.error)}</Alert>}
      {!!search.data?.length && (
        <ul className="qs-search-results">
          {search.data.map((item) => (
            <li key={`${item.lat},${item.lon}`}><button type="button" onClick={() => onPick([item.lon, item.lat], item.label)}><span>{item.label}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateSite({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { map, onStyleReady } = useMapHandle();
  const [point, setPoint] = useState<LngLat | null>(null);
  const [center, setCenter] = useState<LngLat | undefined>(undefined);
  const [title, setTitle] = useState(t('Uyim'));
  const [siteType, setSiteType] = useState<SiteType>('HOUSE');
  const [address, setAddress] = useState('');
  usePointPicker(map, point, setPoint);
  const create = useMutation({
    mutationFn: () => mapService.createSite({ title: title.trim(), siteType, address: address.trim() || undefined, lat: point![1], lon: point![0] }),
    onSuccess: (site) => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      navigate(`/mijoz/obyektlar/${site.id}`);
    },
  });
  return (
    <section className="qs-editor">
      <MapView center={center} onStyleReady={onStyleReady} onLocate={(p) => { setPoint(p); setCenter(p); }} ariaLabel={t('Obyekt joylashuvi')}>
        <div className="qs-map__overlay">{point ? t('Nuqta belgilandi — kerak bo‘lsa sudrab aniqlashtiring.') : t('Xaritada uyingiz joylashgan nuqtani bosing.')}</div>
      </MapView>
      <div className="qs-card qs-form">
        <h2 style={{ margin: 0 }}>{t('Yangi obyekt')}</h2>
        <AddressSearch onPick={(p, label) => { setPoint(p); setCenter(p); setAddress(label); }} />
        <Input label={t('Nomi')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Select label={t('Obyekt turi')} value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType)} options={(Object.keys(SITE_TYPE) as SiteType[]).map((value) => ({ value, label: SITE_TYPE[value] }))} />
        <Input label={t('Manzil (ixtiyoriy)')} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} hint={t('Manzil va nuqta faqat sizga ko‘rinadi')} />
        {point && !inUzbekistan(point) && <Alert tone="warning">{t('Nuqta O‘zbekiston hududidan tashqarida. Hisob natijalari noaniq bo‘lishi mumkin.')}</Alert>}
        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
        <div className="qs-form__actions">
          <Button variant="ghost" onClick={onCancel}>{t('Bekor qilish')}</Button>
          <Button disabled={!point || !title.trim()} loading={create.isPending} onClick={() => create.mutate()}>{t('Saqlash va maydon chizish')}</Button>
        </div>
      </div>
    </section>
  );
}

/** U8: mijoz obyektlari ro‘yxati. */
export function SitesPage() {
  const [creating, setCreating] = useState(false);
  const sites = useQuery({ queryKey: ['sites'], queryFn: mapService.sites });
  if (sites.isLoading) return <PageLoader />;
  if (sites.isError) return <Alert tone="danger">{getErrorMessage(sites.error)}</Alert>;
  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Obyektlarim')}</h1><p>{t('Uy, ofis yoki ombor — har birida o‘rnatish maydonlarini xaritada chizasiz.')}</p></div>
        {!creating && <Button onClick={() => setCreating(true)}><Plus size={18} /> {t('Obyekt qo‘shish')}</Button>}
      </div>
      {creating ? (
        <CreateSite onCancel={() => setCreating(false)} />
      ) : !sites.data?.length ? (
        <EmptyState icon={<Building2 size={30} />} title={t('Hali obyekt yo‘q')} description={t('Manzilni belgilang va tomingizni xaritada chizing — kalkulyator shu maydon bo‘yicha panel sonini hisoblaydi.')} action={<Button onClick={() => setCreating(true)}>{t('Obyekt qo‘shish')}</Button>} />
      ) : (
        <ul className="qs-list">
          {sites.data.map((site) => (
            <li key={site.id}>
              <div>
                <Link to={`/mijoz/obyektlar/${site.id}`}><strong>{site.title}</strong></Link>
                <small>{[SITE_TYPE[site.siteType], regionName(site.regionCode), site.address].filter(Boolean).join(' · ')}</small>
                <small>{t('{n} ta maydon · foydali {m} m²', { n: site.areaCount, m: formatNumber(Number(site.usableAreaM2)) })}</small>
              </div>
              <Link className="gm-button gm-button--secondary gm-button--sm" to={`/mijoz/obyektlar/${site.id}`}>{t('Ochish')}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
