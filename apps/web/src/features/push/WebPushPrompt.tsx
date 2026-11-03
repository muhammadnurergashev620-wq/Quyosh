import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { dismissWebPush, enableWebPush, isWebPushSupported, webPushDismissed, webPushPermission } from './web-push';
import './WebPushPrompt.css';
import { t } from '@/i18n';

/** Brauzerda bildirishnomani yoqishni taklif qiladi (ruxsat faqat foydalanuvchi tugmani bosganda so‘raladi). */
export function WebPushPrompt() {
  const [visible, setVisible] = useState(() => isWebPushSupported() && webPushPermission() === 'default' && !webPushDismissed());
  const [busy, setBusy] = useState(false);
  if (!visible) return null;

  async function enable() {
    setBusy(true);
    await enableWebPush();
    setBusy(false);
    setVisible(false);
  }

  return (
    <section className="gm-webpush" aria-label={t('Bildirishnomalar')}>
      <span className="gm-webpush__icon" aria-hidden="true"><Bell size={20} /></span>
      <div className="gm-webpush__text">
        <strong>{t('Bildirishnomalarni yoqing')}</strong>
        <small>{t('Yangi xabar, taklif va qo‘ng‘iroqlar sayt yopiq bo‘lsa ham ko‘rinadi.')}</small>
      </div>
      <Button size="sm" loading={busy} onClick={() => void enable()}>{t('Yoqish')}</Button>
      <button type="button" className="gm-webpush__close" aria-label={t('Keyinroq')} onClick={() => { dismissWebPush(); setVisible(false); }}>
        <X size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
