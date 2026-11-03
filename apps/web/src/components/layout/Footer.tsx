import './Footer.css';
import { t } from '@/i18n';

export function Footer() {
  return (
    <footer className="gm-footer">
      <p>{t('© {getFullYear} Quyosh', { getFullYear: new Date().getFullYear() })}</p>
    </footer>
  );
}
