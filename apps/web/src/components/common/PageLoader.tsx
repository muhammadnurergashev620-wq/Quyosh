import { Spinner } from '@/components/ui/Spinner';
import './PageLoader.css';
import { t } from '@/i18n';

export function PageLoader({ label = t('Yuklanmoqda…') }: { label?: string }) {
  return (
    <div className="gm-page-loader" role="status" aria-live="polite">
      <Spinner size="md" />
      <span>{label}</span>
    </div>
  );
}
