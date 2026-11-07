import { AlertOctagon, RotateCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import { Button } from './Button';
import './system.css';

/** Xato holati: nima bo‘ldi + nima qilish kerak + «Qayta urinish». */
export function ErrorState({ error, onRetry, title }: { error?: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="gm-error-state" role="alert">
      <span className="gm-error-state__icon" aria-hidden="true"><AlertOctagon /></span>
      <p className="gm-error-state__title">{title ?? t('Ma’lumotni yuklab bo‘lmadi')}</p>
      <p className="gm-error-state__text">{error ? getErrorMessage(error) : t('Internet aloqasini tekshirib, qayta urinib ko‘ring.')}</p>
      {onRetry && <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={onRetry}>{t('Qayta urinish')}</Button>}
    </div>
  );
}
