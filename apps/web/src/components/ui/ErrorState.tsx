import { AlertOctagon, RotateCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import { Button } from './Button';
import './system.css';

/** Xato holati (U5): nima bo‘ldi + nima qilish kerak + «Qayta urinish». Ro‘yxat va tafsilot sahifalarining yagona xato ko‘rinishi. */
export function ErrorState({ error, onRetry, title }: { error?: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="gm-error-state" role="alert">
      <span className="gm-error-state__icon" aria-hidden="true"><AlertOctagon /></span>
      <p className="gm-error-state__title">{title ?? t('Ma’lumotni yuklab bo‘lmadi')}</p>
      {error !== undefined && error !== null && <p className="gm-error-state__text">{getErrorMessage(error)}</p>}
      <p className="gm-error-state__text">{t('Internet aloqasini tekshirib, qayta urinib ko‘ring. Muammo takrorlansa, birozdan keyin qayta kiring yoki yordam markaziga yozing.')}</p>
      {onRetry && <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={onRetry}>{t('Qayta urinish')}</Button>}
    </div>
  );
}
