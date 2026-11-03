import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { t } from '@/i18n';
import './OfflineBanner.css';

/** Internet uzilganda ekran tepasida ko‘rinadi (ekran o‘qiydigan dasturlarga ham e’lon qilinadi), qaytganda o‘zi yo‘qoladi. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="gm-offline" role="status" aria-live="polite">
      <WifiOff size={16} aria-hidden="true" />
      <span>{t('Internet aloqasi yo‘q. Ulanish tiklanganda ilova o‘zi davom etadi.')}</span>
    </div>
  );
}
