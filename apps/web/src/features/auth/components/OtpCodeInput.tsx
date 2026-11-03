import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cx } from '@/lib/utils';
import './OtpCodeInput.css';

export interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Kod kiritish: har bir raqam alohida katakda. Telefon/kompyuterda ham qulay:
 * raqamli klaviatura, SMS/emaildan avtomatik to‘ldirish (one-time-code), butun kodni qo‘yish (paste),
 * Backspace va strelkalar bilan yurish.
 */
export function OtpCodeInput({ value, onChange, label, length = 6, disabled = false, invalid = false, autoFocus = true }: OtpCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus();
  }, [autoFocus, disabled]);

  const focusAt = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  }

  function handleInput(index: number, raw: string) {
    const only = raw.replace(/\D/g, '');
    if (!only) {
      setDigit(index, '');
      return;
    }
    if (only.length > 1) {
      // Avtomatik to‘ldirish yoki bir nechta raqam birdan kiritilgan.
      const merged = (value.slice(0, index) + only).slice(0, length);
      onChange(merged);
      focusAt(Math.min(merged.length, length - 1));
      return;
    }
    setDigit(index, only);
    if (index < length - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, '');
      focusAt(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focusAt(Math.min(pasted.length, length - 1));
  }

  return (
    <div className={cx('gm-otpbox', invalid && 'gm-otpbox--invalid')} role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={cx('gm-otpbox__cell', digit && 'is-filled')}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={index === 0 ? length : 1}
          value={digit}
          disabled={disabled}
          aria-label={`${label}: ${index + 1}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
