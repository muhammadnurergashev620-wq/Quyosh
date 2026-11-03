import { describe, expect, it } from 'vitest';
import { loginSchema, otpSchema, registerSchema, toFullPhone } from './validation';

describe('toFullPhone', () => {
  it('prefixes a 9-digit local number with +998, matching IsPhoneNumber(UZ)', () => {
    expect(toFullPhone('901234567')).toBe('+998901234567');
  });
});

describe('loginSchema', () => {
  it('rejects a phone that is not exactly 9 digits', () => {
    const result = loginSchema.safeParse({ phoneLocal: '12345', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid 9-digit phone and non-empty password', () => {
    const result = loginSchema.safeParse({ phoneLocal: '901234567', password: 'secret' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('rejects a password shorter than 8 characters (mirrors RegisterDto MinLength(8))', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'short',
      confirmPassword: 'short',
      acceptedTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when the policy checkbox was not ticked', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'longenoughpassword',
      confirmPassword: 'longenoughpassword',
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a minimal valid submission', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'longenoughpassword',
      confirmPassword: 'longenoughpassword',
      fullName: 'Ali Valiyev',
      acceptedTerms: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires first and last name', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'longenoughpassword',
      confirmPassword: 'longenoughpassword',
      acceptedTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when the repeated password differs, and reports it on the confirm field', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'longenoughpassword',
      confirmPassword: 'longenoughpassworD',
      fullName: 'Ali Valiyev',
      acceptedTerms: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((item) => item.path[0] === 'confirmPassword');
      expect(issue?.message).toBe('Parollar bir xil emas');
    }
  });

  it('rejects when the password was not repeated at all', () => {
    const result = registerSchema.safeParse({
      phoneLocal: '901234567',
      password: 'longenoughpassword',
      confirmPassword: '',
      acceptedTerms: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('rejects a code that is not exactly 6 digits (mirrors VerifyOTPDto Length(6,6))', () => {
    expect(otpSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(otpSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });

  it('accepts a valid 6-digit code', () => {
    expect(otpSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('requires the full name (first and last name together)', () => {
    const base = { phoneLocal: '90 123 45 67', password: 'Parol1234', confirmPassword: 'Parol1234', acceptedTerms: true as const };
    expect(registerSchema.safeParse({ ...base, fullName: 'Ali' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, fullName: 'Ali Valiyev' }).success).toBe(true);
  });
});
