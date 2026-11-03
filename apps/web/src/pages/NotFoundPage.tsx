import { Link } from 'react-router-dom';
import { t } from '@/i18n';

export function NotFoundPage() {
  return (
    <div className="gm-empty-state">
      <p className="gm-empty-state__title">{t('404 — Sahifa topilmadi')}</p>
      <p className="gm-empty-state__description">{t('Bunday sahifa mavjud emas yoki ko‘chirilgan.')}</p>
      <Link to="/">{t('Bosh sahifaga qaytish')}</Link>
    </div>
  );
}
