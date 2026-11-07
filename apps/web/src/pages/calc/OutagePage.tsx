import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { calcService } from '@/features/calc/calc.service';
import { kw, monthName, SYSTEM_TYPE } from '@/features/calc/labels';
import type { ApplianceRow, SystemType } from '@/features/calc/types';
import { i18nText } from '@/features/catalog/format';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/calc/calc.css';
import { formatDecimal } from '@/lib/format';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Tab, TabBar } from '@/components/ui/Tabs';

/** U8.13: elektr uzilishi kalkulyatori — default HYBRID; ON_GRID da raqam ko‘rsatilmaydi. */
export function OutagePage() {
  const reference = useQuery({ queryKey: ['calc', 'reference'], queryFn: calcService.reference, staleTime: 10 * 60_000 });
  const [systemType, setSystemType] = useState<SystemType>('HYBRID');
  const [hours, setHours] = useState('4');
  const [rows, setRows] = useState<ApplianceRow[]>([{ code: 'FRIDGE', powerW: 150, count: 1, hoursPerDay: 24 }, { code: 'LIGHTING_LED', powerW: 10, count: 8, hoursPerDay: 6 }, { code: 'ROUTER', powerW: 12, count: 1, hoursPerDay: 24 }]);
  const types = reference.data?.appliances ?? [];
  const nameOf = (code?: string) => { const type = types.find((x) => x.code === code); return type ? i18nText(type.nameI18n as { uz: string }) : t('Texnika'); };
  const run = useMutation({ mutationFn: () => calcService.outage({ systemType, criticalItems: rows, backupHours: Number(hours) || 4 }) });
  const result = run.data;
  const hoursText = (h: number | null) => (h === null ? '—' : t('{h} soat', { h: formatDecimal(h, 1) }));
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Elektr o‘chganda')}</h1><p>{t('Muhim texnika uzilishda qancha ishlashini hisoblang.')}</p></div></div>
      <section className="qs-card qs-form">
        <TabBar variant="segmented" role="group">{(Object.keys(SYSTEM_TYPE) as SystemType[]).map((type) => <Tab key={type} onClick={() => setSystemType(type)} selected={systemType === type}>{SYSTEM_TYPE[type].title}</Tab>)}</TabBar>
        <div className="qs-appliances">
          {rows.map((row, index) => (
            <div key={index} className="qs-appliance">
              <strong>{nameOf(row.code)}</strong>
              <label>{t('Soni')}<input className="qs-input-sm" inputMode="numeric" value={row.count} onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, count: Number(e.target.value.replace(/\D/g, '')) || 1 } : r)))} /></label>
              <label>{t('Quvvat, Vt')}<input className="qs-input-sm" inputMode="numeric" value={row.powerW} onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, powerW: Number(e.target.value.replace(/\D/g, '')) || 1 } : r)))} /></label>
              <span />
              <span />
              <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2 size={14} /></Button>
            </div>
          ))}
        </div>
        <SelectMenu className="qs-select" aria-label={t('Texnika qo‘shish')} value="" onChange={(e) => { const type = types.find((x) => x.code === e.target.value); if (type) setRows([...rows, { code: type.code, powerW: type.defaultPowerW, count: 1, hoursPerDay: Number(type.defaultHoursPerDay) }]); }}>
          <option value="">{t('+ Texnika qo‘shish…')}</option>
          {types.map((type) => <option key={type.code} value={type.code}>{i18nText(type.nameI18n as { uz: string })}</option>)}
        </SelectMenu>
        <Input label={t('Uzilish davomiyligi, soat')} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} />
        <div className="qs-form__actions"><Button loading={run.isPending} disabled={!rows.length} onClick={() => run.mutate()}><Plus size={14} /> {t('Hisoblash')}</Button></div>
        {run.isError && <Alert tone="danger">{getErrorMessage(run.error)}</Alert>}
      </section>
      {result && (!result.applicable ? (
        <Alert tone="warning" title={t('Zaxira yo‘q')}>{t('Tarmoqqa ulangan tizim elektr o‘chganda xavfsizlik uchun o‘chadi.')} <Button variant="link" onClick={() => { setSystemType('HYBRID'); }}>{t('Gibrid variantni hisoblash')}</Button></Alert>
      ) : (
        <section className="qs-card">
          <div className="qs-calc-kpis">
            <div><small>{t('Kritik yuklama')}</small><strong>{kw(result.criticalLoadKw)}</strong><span className="qs-muted">{t('ishga tushish {p}', { p: kw(result.peakStartKw) })}</span></div>
            <div><small>{t('Tunda zaxira')}</small><strong>{hoursText(result.backupHoursNight)}</strong><span className="qs-muted">{t('akkumulyator {b} kWh', { b: result.batteryKwh })}</span></div>
            <div><small>{t('Kunduzi')}</small><strong style={{ fontSize: 18 }}>{result.dayUnlimited ? t('Quyosh bor paytda cheklanmagan') : hoursText(result.backupHoursDay)}</strong></div>
            <div><small>{t('Invertor')}</small><strong>{result.inverterOk ? t('Yetarli') : t('Yetarli emas')}</strong><span className="qs-muted">{kw(result.inverterKw ?? 0)}</span></div>
          </div>
          {!!result.months.length && <p className="qs-muted">{[1, 7].map((m) => { const row = result.months[m - 1]; return row ? `${monthName(m)}: ${row.dayUnlimited ? t('kunduzi cheklanmagan') : hoursText(row.backupHoursDay)}` : ''; }).join(' · ')}</p>}
          <p className="qs-muted" style={{ marginBottom: 0 }}>{t('Aniq tizim uchun')} <Link to="/mijoz/kalkulyator/batafsil">{t('Batafsil hisob')}</Link>.</p>
        </section>
      ))}
    </div>
  );
}
