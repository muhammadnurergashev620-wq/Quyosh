import { forwardRef } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from './Input';
import type { InputProps } from './Input';
import { groupAmount, sanitizeMoney } from '@/lib/utils';
import { t } from '@/i18n';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'formatValue' | 'min' | 'max'> {
  /** Faqat raqamlardan iborat qiymat (masalan, «30000000»). Ekranda «30 000 000» ko‘rinadi. */
  value: string;
  onValueChange: (digits: string) => void;
  /** Eng katta ruxsat etilgan summa: oshsa, xato matni ko‘rsatiladi (qiymat jimgina o‘zgartirilmaydi). */
  max?: number;
  min?: number;
}

/**
 * Pul kiritish maydoni: yozayotganda minglarga ajratadi («30 000 000»), kursor joyini saqlaydi, faqat raqam qabul qiladi,
 * o‘ngda birlik («so‘m») ko‘rsatadi. Saqlanadigan qiymat — toza raqamlar qatori.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(({ value, onValueChange, max, min, suffix, error, hint, placeholder, ...rest }, ref) => {
  const amount = value ? Number(value) : 0;
  const range = value && max !== undefined && amount > max ? t('Summa {max} dan oshmasligi kerak.', { max: groupAmount(String(max)) }) : value && min !== undefined && amount < min ? t('Summa kamida {min} bo‘lishi kerak.', { min: groupAmount(String(min)) }) : undefined;
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      suffix={suffix ?? t('so‘m')}
      placeholder={placeholder ?? '0'}
      value={groupAmount(value)}
      formatValue={groupAmount}
      error={error ?? range}
      hint={hint}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(sanitizeMoney(event.target.value))}
      {...rest}
    />
  );
});
MoneyInput.displayName = 'MoneyInput';
