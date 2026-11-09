import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { formatDate } from '@/lib/format';
import { usePolicies, usePolicy } from '../hooks/useLegal';
import { renderContent } from '../render-content';
import type { PolicyType } from '../types';
import './PolicyDocument.css';
import { t } from '@/i18n';

function Body({ id, fallback }: { id: string; fallback?: string }) {
  const detail = usePolicy(id);
  if (detail.isLoading) return <PageLoader />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  return <div className="gm-policydoc__prose">{renderContent(detail.data?.content ?? fallback ?? '')}</div>;
}

/** E’lon qilingan hujjatning (shartlar, maxfiylik, oferta) o‘qiladigan ko‘rinishi. */
export function PolicyDocument({ type }: { type: PolicyType }) {
  const policies = usePolicies();
  if (policies.isLoading) return <PageLoader label={t('Hujjatlar yuklanmoqda…')} />;
  if (policies.isError) return <ErrorState error={policies.error} onRetry={() => void policies.refetch()} />;
  const policy = (policies.data ?? []).find((item) => item.type === type && item.status === 'PUBLISHED');
  if (!policy) return <EmptyState title={t('Hozircha hujjatlar e’lon qilinmagan')} />;
  return (
    <article className="gm-policydoc">
      <header className="gm-policydoc__head">
        <h2>{policy.title}</h2>
        <p>
          v{policy.version}
          {policy.publishedAt ? ` · ${formatDate(policy.publishedAt)}` : ''}
        </p>
      </header>
      <Body id={policy.id} fallback={policy.content} />
    </article>
  );
}
