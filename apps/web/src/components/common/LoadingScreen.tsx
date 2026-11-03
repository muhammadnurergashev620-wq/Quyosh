import { Spinner } from '@/components/ui/Spinner';
import './LoadingScreen.css';
import { t } from '@/i18n';

export function LoadingScreen() {
  return (
    <div className="gm-loading-screen" role="status" aria-live="polite">
      <Spinner size="lg" />
      <p>{t('Yuklanmoqda…')}</p>
    </div>
  );
}
