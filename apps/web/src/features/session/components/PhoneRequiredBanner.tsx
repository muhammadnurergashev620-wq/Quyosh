import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useMe } from '../hooks/useMe';
import { PhoneVerifyDialog } from './PhoneVerifyDialog';
import { t } from '@/i18n';

/** Mijozda tasdiqlangan telefon yo‘q bo‘lsa: akkauntdan foydalanish mumkin, lekin buyurtma berish uchun raqamni tasdiqlash kerak. */
export function PhoneRequiredBanner() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const user = me.data;
  if (!user || !user.roles.includes('CUSTOMER') || user.roles.includes('ADMIN') || (user.phone && user.phoneVerifiedAt)) return null;
  return (
    <>
      <div className="gm-phone-banner">
      <Alert tone="warning" title={t('Buyurtma berish uchun telefon raqamingizni tasdiqlang.')}>
        <p style={{ margin: '0 0 10px' }}>
          {user.phone ? t('Raqamingiz hali tasdiqlanmagan.') : t('Akkauntingizda telefon raqami yo‘q.')} {t('Tasdiqlamaguncha buyurtma yaratib bo‘lmaydi.')}
        </p>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          {t('Raqamni kiritish va tasdiqlash')}
        </Button>
      </Alert>
      </div>
      <PhoneVerifyDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
