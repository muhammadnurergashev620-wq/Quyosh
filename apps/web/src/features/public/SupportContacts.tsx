import { Mail, MessageCircle, Phone } from 'lucide-react';
import { cx } from '@/lib/utils';
import { env } from '@/lib/env';
import './SupportContacts.css';
import { t } from '@/i18n';

/** Qo‘llab-quvvatlash kontaktlari (telefon, Telegram, e-pochta): faqat berilganlari ko‘rsatiladi. */
export function SupportContacts({ title, compact = false, className }: { title?: string; compact?: boolean; className?: string }) {
  const { telegram, phone, email } = env.support;
  if (!telegram && !phone && !email) return null;
  return (
    <section className={cx('gm-support', compact && 'gm-support--compact', className)} aria-label={t('Qo‘llab-quvvatlash')}>
      {title && (
        <div className="gm-support__head">
          <h3>{title}</h3>
          <p>{t('Jamoamiz yordam berishga tayyor. Qulay usulda bog‘laning.')}</p>
        </div>
      )}
      <div className="gm-support__list">
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, '')}`}>
            <i className="gm-support__ico"><Phone size={18} aria-hidden="true" /></i>
            <span><small>{t('Telefon')}</small><strong>{phone}</strong></span>
          </a>
        )}
        {telegram && (
          <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer">
            <i className="gm-support__ico"><MessageCircle size={18} aria-hidden="true" /></i>
            <span><small>Telegram</small><strong>@{telegram}</strong></span>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`}>
            <i className="gm-support__ico"><Mail size={18} aria-hidden="true" /></i>
            <span><small>{t('E-pochta')}</small><strong>{email}</strong></span>
          </a>
        )}
      </div>
    </section>
  );
}
