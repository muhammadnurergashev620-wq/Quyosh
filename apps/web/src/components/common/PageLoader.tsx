import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import './PageLoader.css';
import { t } from '@/i18n';

/**
 * Sahifa yuklanishi (U5, SYS-09): sarlavha va kartalar shaklidagi skeleton (shimmer).
 * `variant="list"` — sahifa sarlavhasi ostidagi ro‘yxat/blok uchun (qator skeletonlari); `inline` — karta yoki modal ichida (spinner + matn).
 */
export function PageLoader({ label = t('Yuklanmoqda…'), inline = false, variant = 'page' }: { label?: string; inline?: boolean; variant?: 'page' | 'list' }) {
  if (variant === 'list') {
    return (
      <div className="gm-page-loader gm-page-loader--list" role="status" aria-live="polite" aria-busy="true">
        <span className="gm-visually-hidden">{label}</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="gm-page-loader__row" aria-hidden="true">
            <Skeleton className="gm-page-loader__avatar" />
            <div><Skeleton className="gm-page-loader__line" /><Skeleton className="gm-page-loader__line gm-page-loader__line--short" /></div>
          </div>
        ))}
      </div>
    );
  }
  if (inline) {
    return (
      <div className="gm-page-loader gm-page-loader--inline" role="status" aria-live="polite">
        <Spinner size="md" />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="gm-page-loader gm-page-loader--skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="gm-visually-hidden">{label}</span>
      <div className="gm-page-loader__head" aria-hidden="true">
        <Skeleton className="gm-page-loader__title" />
        <Skeleton className="gm-page-loader__lead" />
      </div>
      <div className="gm-page-loader__grid" aria-hidden="true">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="gm-page-loader__card" />)}
      </div>
      <Skeleton className="gm-page-loader__block" />
    </div>
  );
}
