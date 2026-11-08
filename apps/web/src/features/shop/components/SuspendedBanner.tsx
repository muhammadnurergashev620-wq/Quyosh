import { MessageCircle, Phone, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { ButtonAnchor } from '@/components/ui/Button';
import { useCurrentShop } from '@/features/shop/current-shop';
import { env } from '@/lib/env';
import { t } from '@/i18n';

/** Admin bilan bog‘lanish havolasi (Telegram → telefon → e-pochta; qaysi biri berilgan bo‘lsa). */
function contactLink(): { href: string; external: boolean; phone: boolean } | null {
  const { telegram, phone, email } = env.support;
  if (telegram) return { href: `https://t.me/${telegram}`, external: true, phone: false };
  if (phone) return { href: `tel:${phone.replace(/\s+/g, '')}`, external: false, phone: true };
  if (email) return { href: `mailto:${email}`, external: false, phone: false };
  return null;
}

/** TZ 3.7.3: to‘xtatilgan do‘kon — har bir kabinet sahifasida “faqat o‘qish” banneri (yozish amallari serverda 423). */
export function SuspendedBanner() {
  const { shop } = useCurrentShop();
  if (shop?.status !== 'SUSPENDED') return null;
  const contact = contactLink();
  return (
    <Alert
      tone="danger"
      icon={<ShieldAlert />}
      title={t('Do‘kon vaqtincha to‘xtatilgan')}
      action={contact && (
        <ButtonAnchor href={contact.href} target={contact.external ? '_blank' : undefined} rel={contact.external ? 'noreferrer' : undefined} variant="danger" size="sm" leftIcon={contact.phone ? <Phone /> : <MessageCircle />}>
          {t('Administratorga yozish')}
        </ButtonAnchor>
      )}
    >
      {t('Faqat ko‘rish mumkin: o‘zgartirish, taklif yuborish va yangi so‘rov qabul qilish yopiq. Sabab: {reason}', { reason: shop.suspendReason ?? '—' })}{' '}
      {!contact && t('Savollar bo‘yicha administratorga murojaat qiling.')}
    </Alert>
  );
}
