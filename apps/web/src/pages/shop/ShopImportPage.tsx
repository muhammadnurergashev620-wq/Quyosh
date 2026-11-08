import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { STOCK_STATUS } from '@/features/shop/labels';
import { catalogService } from '@/features/catalog/catalog.service';
import type { ImportSummary } from '@/features/catalog/types';
import { apiDownload } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import { StatusBadge } from '@/components/ui/StatusBadge';

const MAX_BYTES = 5 * 1024 * 1024;
const IMPORT_STATUS: Record<ImportSummary['status'], { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  UPLOADED: { label: t('Yuklandi'), tone: 'neutral' },
  VALIDATED: { label: t('Tekshirildi'), tone: 'warning' },
  APPLIED: { label: t('Qo‘llandi'), tone: 'success' },
  FAILED: { label: t('Xato'), tone: 'danger' },
};

/** U11.7: shablon → yuklash → tekshirish (qator, ustun, sabab) → faqat to‘g‘ri qatorlarni qo‘llash. */
export function ShopImportPage() {
  const { shopId, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const history = useQuery({ queryKey: ['shop', shopId ?? '-', 'imports'], queryFn: () => catalogService.imports(shopId!), enabled: !!shopId });
  const upload = useMutation({ mutationFn: (file: File) => catalogService.uploadImport(shopId!, file), onSuccess: (result) => { setSummary(result); void history.refetch(); } });
  const apply = useMutation({
    mutationFn: () => catalogService.applyImport(shopId!, summary!.id),
    onSuccess: (result) => {
      pushToast(t('{n} ta qator qo‘llandi', { n: result.applied }), 'success');
      setSummary((current) => (current ? { ...current, status: 'APPLIED', appliedAt: new Date().toISOString() } : current));
      void queryClient.invalidateQueries({ queryKey: ['shop', shopId] });
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });

  function pick(file: File | undefined) {
    if (!file) return;
    setLocalError('');
    if (!/\.(csv|xlsx)$/i.test(file.name)) return setLocalError(t('Faqat CSV yoki XLSX fayl'));
    if (file.size > MAX_BYTES) return setLocalError(t('Fayl hajmi 5 MB dan oshmasligi kerak'));
    setSummary(null);
    upload.mutate(file);
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    pick(event.dataTransfer.files[0]);
  };
  const download = (path: string, name: string) => void apiDownload(`/manage/shops/${shopId}${path}`, name).catch((error: unknown) => pushToast(getErrorMessage(error), 'error'));

  if (!shopId) return <PageLoader />;
  if (!can('catalog.write')) return <Alert tone="info">{t('Import uchun «Mahsulot qo‘shish va import» ruxsati kerak.')}</Alert>;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Ommaviy import')}</h1><p>{t('CSV yoki XLSX: 5 MB gacha, 5 000 qatorgacha. Model katalogda tasdiqlangan bo‘lishi kerak.')}</p></div>
        <Button variant="secondary" onClick={() => download('/imports/template.csv', 'quyosh-import-shablon.csv')}><Download size={18} /> {t('Shablonni yuklab olish')}</Button>
      </div>

      <section className="qs-card">
        <header><h2>1. {t('Faylni yuklash')}</h2></header>
        <div
          className={cx('qs-dropzone', over && 'is-over')}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <FileSpreadsheet size={32} aria-hidden="true" />
          <strong>{upload.isPending ? t('Tekshirilmoqda…') : t('Faylni shu yerga tashlang yoki tanlang')}</strong>
          <span>{t('Ustunlar: brand, model, price, currency, vat_included, stock_status, quantity, branch, valid_from, valid_until, description')}</span>
        </div>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="gm-visually-hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {localError && <Alert tone="danger">{localError}</Alert>}
        {upload.isError && <Alert tone="danger">{getErrorMessage(upload.error)}</Alert>}
      </section>

      {summary && (
        <section className="qs-card">
          <header>
            <h2>2. {t('Tekshirish natijasi')}</h2>
            <StatusBadge map={IMPORT_STATUS} status={summary.status} />
          </header>
          <p className="qs-stat-line">
            <span>{t('Jami')}: <b>{formatNumber(summary.rowCount)}</b></span>
            <span className="qs-text-success">{t('To‘g‘ri')}: <b>{formatNumber(summary.validCount)}</b></span>
            <span className="qs-text-danger">{t('Xato')}: <b>{formatNumber(summary.errorCount)}</b></span>
          </p>
          {summary.errors.length > 0 && (
            <>
              <div className="qs-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="qs-table">
                  <thead><tr><th>{t('Qator')}</th><th>{t('Ustun')}</th><th>{t('Sabab')}</th></tr></thead>
                  <tbody>
                    {summary.errors.map((error, index) => (
                      <tr key={`${error.row}-${error.column}-${index}`}><td className="qs-num">{error.row}</td><td><code>{error.column}</code></td><td>{error.reason}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="qs-page__actions qs-mt-3">
                <Button variant="ghost" size="sm" onClick={() => download(`/imports/${summary.id}/errors.csv`, `import-xatolar.csv`)}><Download size={14} /> {t('Xatolar faylini yuklab olish')}</Button>
              </div>
            </>
          )}
          {summary.preview.length > 0 && (
            <details className="qs-mt-3">
              <summary>{t('To‘g‘ri qatorlar (dastlabki 20 ta)')}</summary>
              <ul className="qs-list qs-mt-2">
                {summary.preview.map((row) => (
                  <li key={row.row}><div><strong>{row.label}</strong><small>{t('{row}-qator', { row: row.row })} · {STOCK_STATUS[row.stockStatus].label}</small></div><span className="qs-num">{formatNumber(Number(row.price))} {row.currency === 'USD' ? '$' : t('so‘m')}</span></li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {summary && summary.status !== 'FAILED' && (
        <section className="qs-card">
          <header><h2>3. {t('Qo‘llash')}</h2></header>
          {summary.status === 'APPLIED' ? (
            <Alert tone="success" title={t('Import qo‘llandi')}><CheckCircle2 size={16} /> {t('Narxlar katalogda yangilandi.')}</Alert>
          ) : (
            <div className="qs-page__actions">
              <Button loading={apply.isPending} disabled={!summary.validCount} onClick={() => apply.mutate()}>{t('Faqat to‘g‘ri qatorlarni qo‘llash ({n})', { n: summary.validCount })}</Button>
              {summary.errorCount > 0 && <Button variant="ghost" onClick={() => inputRef.current?.click()}><RotateCcw size={16} /> {t('Xatolarni tuzatib qayta yuklash')}</Button>}
            </div>
          )}
        </section>
      )}

      <section className="qs-card">
        <header><h2>{t('Oxirgi importlar')}</h2></header>
        {history.isLoading ? <PageLoader /> : !history.data?.length ? <p className="qs-muted">{t('Hali import qilinmagan.')}</p> : (
          <ul className="qs-list">
            {history.data.map((job) => (
              <li key={job.id}>
                <div><strong>{job.fileName}</strong><small>{formatDateTime(job.createdAt)} · {t('{rows} qator, {errors} xato', { rows: job.rowCount, errors: job.errorCount })}</small></div>
                <StatusBadge map={IMPORT_STATUS} status={job.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
