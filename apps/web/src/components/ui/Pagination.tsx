import { Button } from './Button';
import './Pagination.css';
import { t } from '@/i18n';

export interface PaginationProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
}

export function Pagination({ hasMore, loading, onLoadMore }: PaginationProps) {
  if (!hasMore) return null;
  return (
    <div className="gm-pagination">
      <Button variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>{t('Ko‘proq yuklash')}</Button>
    </div>
  );
}
