import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Copy, FileDown, RefreshCw, Save, Share2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/common/PageLoader';
import { calcService } from '@/features/calc/calc.service';
import { ResultView } from '@/features/calc/ResultView';
import type { EstimateInput } from '@/features/calc/types';
import { getErrorMessage } from '@/lib/error-messages';
import { rememberReturnTo } from '@/lib/return-to';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { lang as currentLang, t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/calc/calc.css';
import { Tab, TabBar } from '@/components/ui/Tabs';

/** Saqlangan hisobdan — to‘g‘ridan-to‘g‘ri so‘rov wizard’iga (U9.1, asos avtomatik); saqlanmagan bo‘lsa — xarita. */
function OffersCta({ calculationId }: { calculationId?: string }) {
  return (
    <div className="qs-cta-card">
      <h3>{t('Yaqin do‘konlardan narx taklifi oling')}</h3>
      <p>{t('Hududingizga xizmat ko‘rsatadigan tasdiqlangan do‘konlar.')}</p>
      <ButtonLink to={calculationId ? `/mijoz/sorovlar?yangi=1&hisob=${calculationId}` : '/mijoz/xarita'}>{t('Do‘konlardan taklif olish')} <ArrowRight size={16} /></ButtonLink>
    </div>
  );
}

/** Batafsil hisob yakunida (saqlanmagan): natija serverda qayta hisoblanadi. */
export function UnsavedResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasSession = useAuthStore((s) => s.hasSession);
  const pushToast = useAppStore((s) => s.pushToast);
  const input = (location.state as { input?: EstimateInput } | null)?.input;
  const query = useQuery({ queryKey: ['calc', 'result', input], queryFn: () => calcService.estimate(input!, new AbortController().signal), enabled: !!input, staleTime: Infinity });
  const save = useMutation({ mutationFn: () => calcService.save(input!), onSuccess: (saved) => { void calcService.deleteDraft(); navigate(`/mijoz/natija/${saved.id}`, { replace: true }); }, onError: (error) => pushToast(getErrorMessage(error), 'error') });
  if (!input) return <Navigate to="/mijoz/kalkulyator/batafsil" replace />;
  if (query.isLoading) return <PageLoader />;
  if (query.isError || !query.data) return <Alert tone="danger">{getErrorMessage(query.error)}</Alert>;
  const requireLogin = () => { rememberReturnTo('/mijoz/kalkulyator/batafsil?qadam=6'); navigate('/login'); };
  return (
    <ResultView
      result={query.data}
      cta={<OffersCta />}
      actions={<>
        <Button loading={save.isPending} onClick={() => (hasSession ? save.mutate() : requireLogin())}><Save size={16} /> {t('Saqlash')}</Button>
        <Button variant="secondary" onClick={() => navigate('/mijoz/kalkulyator/batafsil?qadam=1')}>{t('Parametrlarni o‘zgartirish')}</Button>
      </>}
    />
  );
}

/** U8.14: PDF — til, QR (ulashish / kabinet / yo‘q), fon tayyorlash va yuklab olish. */
function PdfModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [lang, setLang] = useState<'uz' | 'oz' | 'ru' | 'en'>(currentLang === 'ru' ? 'ru' : currentLang === 'uz-Cyrl' ? 'oz' : currentLang === 'en' ? 'en' : 'uz');
  const [qr, setQr] = useState<'SHARE' | 'CABINET' | 'NONE'>('SHARE');
  const [jobId, setJobId] = useState<string | null>(null);
  const idem = useIdempotencyKey({ id, lang, qr });
  const create = useMutation({ mutationFn: () => calcService.report(id, lang, qr, idem.key), onSuccess: (job) => { idem.rotate(); setJobId(job.id); } });
  const status = useQuery({
    queryKey: ['report', jobId],
    queryFn: () => calcService.reportStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data?.status === 'READY' || query.state.data?.status === 'FAILED' ? false : 1000),
  });
  const download = useMutation({ mutationFn: () => calcService.reportDownload(jobId!), onSuccess: (result) => { window.location.href = result.url; } });
  const close = () => { setJobId(null); create.reset(); onClose(); };
  const ready = status.data?.status === 'READY';
  return (
    <Modal open={open} onClose={close} title={t('PDF hisobot')}>
      <div className="qs-form">
        <Select label={t('Til')} value={lang} onChange={(e) => setLang(e.target.value as 'uz' | 'oz' | 'ru' | 'en')} options={[{ value: 'uz', label: 'O‘zbekcha' }, { value: 'oz', label: 'Ўзбекча' }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} />
        <TabBar variant="segmented" role="group" aria-label={t('QR-kod')}>
          {([['SHARE', t('QR: ulashish havolasi')], ['CABINET', t('QR: kabinetga')], ['NONE', t('QR yo‘q')]] as const).map(([value, label]) => <Tab key={value} onClick={() => setQr(value)} selected={qr === value}>{label}</Tab>)}
        </TabBar>
        {jobId && !ready && status.data?.status !== 'FAILED' && <div className="qs-sun-wait"><svg viewBox="0 0 42 22" aria-hidden="true"><path d="M2,20 A19,17 0 0 1 40,20" fill="none" stroke="var(--qs-color-border)" strokeWidth="1.5" /><circle r="3" /></svg>{t('PDF tayyorlanmoqda…')}</div>}
        {status.data?.status === 'FAILED' && <Alert tone="danger">{t('PDF tayyorlanmadi. Qayta urinib ko‘ring.')}</Alert>}
        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
        <div className="qs-form__actions">
          {ready ? <Button loading={download.isPending} onClick={() => download.mutate()}><FileDown size={16} /> {t('Yuklab olish')}</Button> : <Button loading={create.isPending || (!!jobId && !ready)} onClick={() => create.mutate()}>{t('Tayyorlash')}</Button>}
        </div>
      </div>
    </Modal>
  );
}

function ShareModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const pushToast = useAppStore((s) => s.pushToast);
  const [days, setDays] = useState<7 | 30 | null>(30);
  const [link, setLink] = useState<string | null>(null);
  const share = useMutation({ mutationFn: () => calcService.share(id, days), onSuccess: (result) => setLink(`${window.location.origin}/mijoz/ulashish/${result.token}`) });
  const revoke = useMutation({ mutationFn: () => calcService.revokeShare(id), onSuccess: () => { setLink(null); pushToast(t('Havolalar bekor qilindi'), 'success'); } });
  return (
    <Modal open={open} onClose={onClose} title={t('Hisobni ulashish')}>
      <div className="qs-form">
        <Alert tone="info">{t('Havolada aniq manzil va tom chizmasi ko‘rinmaydi.')}</Alert>
        <TabBar variant="segmented" role="group">
          {([7, 30, null] as const).map((value) => <Tab key={String(value)} onClick={() => setDays(value)} selected={days === value}>{value ? t('{n} kun', { n: value }) : t('Muddatsiz')}</Tab>)}
        </TabBar>
        {link && (
          <div className="qs-inline-price qs-wrap">
            <code className="qs-break">{link}</code>
            <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(link).then(() => pushToast(t('Nusxa olindi'), 'success'))}><Copy size={14} /> {t('Nusxa')}</Button>
          </div>
        )}
        {share.isError && <Alert tone="danger">{getErrorMessage(share.error)}</Alert>}
        <div className="qs-form__actions">
          <Button variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate()}>{t('Havolalarni bekor qilish')}</Button>
          <Button loading={share.isPending} onClick={() => share.mutate()}>{t('Havola yaratish')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Saqlangan hisob (snapshot o‘zgarmaydi; eski versiya — «Qayta hisoblash»). */
export function SavedResultPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [sharing, setSharing] = useState(false);
  const [pdf, setPdf] = useState(false);
  const saved = useQuery({ queryKey: ['calculations', id], queryFn: () => calcService.get(id) });
  const recalc = useMutation({ mutationFn: () => calcService.recalculate(id), onSuccess: (created) => { void queryClient.invalidateQueries({ queryKey: ['calculations'] }); pushToast(t('Yangi hisob yaratildi; eskisi o‘zgarmadi'), 'success'); navigate(`/mijoz/natija/${created.id}`); } });
  if (saved.isLoading) return <PageLoader />;
  if (saved.isError || !saved.data) return <Alert tone="danger">{getErrorMessage(saved.error)}</Alert>;
  const views = saved.data.shares.reduce((sum, s) => sum + s.viewCount, 0);
  return (
    <>
      {saved.data.outdated && <Alert tone="warning" title={t('Eski tarif/model bilan')}>{t('Bu hisob oldingi tarif yoki sozlamalar bilan qilingan.')} <Button variant="link" onClick={() => recalc.mutate()}>{t('Qayta hisoblash')}</Button></Alert>}
      <ResultView
        result={saved.data.result}
        cta={<OffersCta calculationId={id} />}
        actions={<>
          <Button variant="secondary" onClick={() => setSharing(true)}><Share2 size={16} /> {t('Ulashish')}{views ? ` · ${t('{n} marta ko‘rildi', { n: views })}` : ''}</Button>
          <Button variant="secondary" onClick={() => setPdf(true)}><FileDown size={16} /> PDF</Button>
          <Button variant="ghost" loading={recalc.isPending} onClick={() => recalc.mutate()}><RefreshCw size={16} /> {t('Qayta hisoblash')}</Button>
        </>}
      />
      <ShareModal id={id} open={sharing} onClose={() => setSharing(false)} />
      <PdfModal id={id} open={pdf} onClose={() => setPdf(false)} />
    </>
  );
}

/** Ulashilgan hisob (ochiq): yengil ko‘rinish, manzilsiz. */
export function SharedResultPage() {
  const { token = '' } = useParams();
  const shared = useQuery({ queryKey: ['shared', token], queryFn: () => calcService.shared(token), retry: false });
  if (shared.isLoading) return <PageLoader />;
  if (shared.isError || !shared.data) return <Alert tone="danger">{getErrorMessage(shared.error)}</Alert>;
  return (
    <>
      <Alert tone="info" title={t('Bu ulashilgan hisob')}>{t('O‘z uyingiz uchun hisoblang — 3 daqiqa.')} <Link to="/mijoz/kalkulyator">{t('O‘z hisobingizni qiling')}</Link></Alert>
      <ResultView result={shared.data.result} shared cta={<div className="qs-cta-card"><h3>{t('O‘z hisobingizni qiling')}</h3><p>{t('Manzil, iste’mol va tomingiz bo‘yicha.')}</p><ButtonAnchor href={`${env.customerUrl.replace(/\/mijoz\/?$/, '')}/mijoz/kalkulyator`}>{t('Kalkulyator')} <ArrowRight size={16} /></ButtonAnchor></div>} />
    </>
  );
}
