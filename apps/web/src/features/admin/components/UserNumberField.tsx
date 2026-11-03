import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { adminService } from '../services/admin.service';
import { t } from '@/i18n';

/**
 * Foydalanuvchini raqamli ID (masalan, 584) bilan tanlash. Topilsa ismi ko‘rsatiladi,
 * ichki identifikator faqat serverga uzatiladi.
 */
export function UserNumberField({ label, onResolve }: { label: string; onResolve: (userId: string | null) => void }) {
  const [text, setText] = useState('');
  const debounced = useDebounce(text.trim(), 350);
  const number = /^\d{1,9}$/.test(debounced) ? Number(debounced) : null;
  const user = useQuery({ queryKey: ['admin', 'user-number', number], queryFn: () => adminService.userByNumber(number as number), enabled: number !== null, retry: false });

  useEffect(() => {
    onResolve(number !== null && user.data ? user.data.id : null);
  }, [number, user.data, onResolve]);

  const invalid = text.trim() !== '' && !/^\d{1,9}$/.test(text.trim());
  return (
    <Input
      label={label}
      required
      inputMode="numeric"
      placeholder={t('Masalan, 584')}
      value={text}
      onChange={(event) => setText(event.target.value.replace(/\s/g, ''))}
      error={invalid ? t('Faqat raqam kiriting') : user.isError ? getErrorMessage(user.error) : undefined}
      hint={user.data ? `${accountName(user.data)} · ${user.data.phone}` : t('Foydalanuvchining raqamli ID si')}
    />
  );
}
