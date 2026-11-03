import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import { getErrorMessage } from './error-messages';

const error = (code: string, message: string, statusCode = 429) => new ApiError({ statusCode, code, message, requestId: null });

describe('getErrorMessage', () => {
  it('shows the server’s specific rate-limit message (how long to wait) instead of a generic one', () => {
    expect(getErrorMessage(error('RATE_LIMITED', 'Kod so‘rash limiti tugadi. 4 daqiqadan so‘ng qayta urinib ko‘ring'))).toBe(
      'Kod so‘rash limiti tugadi. 4 daqiqadan so‘ng qayta urinib ko‘ring',
    );
    expect(getErrorMessage(error('LOGIN_LOCKED', 'Noto‘g‘ri urinishlar ko‘p bo‘ldi. 120 soniyadan so‘ng qayta urinib ko‘ring'))).toContain('120 soniya');
  });

  it('keeps friendly fixed texts for wrong credentials and network failures', () => {
    expect(getErrorMessage(error('UNAUTHORIZED', 'x', 401))).toBe('Telefon raqami yoki parol noto‘g‘ri.');
    expect(getErrorMessage(error('NETWORK_ERROR', 'x', 0))).toMatch(/Internet/);
  });

  it('shows validation field names in the user’s language, not as raw code names', () => {
    const e = new ApiError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'x', requestId: null, details: ['experienceYears: 70 dan katta bo‘lmasligi kerak', 'serviceAreas.0: juda uzun', 'unknownField: x'] });
    expect(getErrorMessage(e)).toBe('Tajriba (yil): 70 dan katta bo‘lmasligi kerak\nIsh hududlari: juda uzun\nunknownField: x');
  });

  it('joins validation details and handles non-API errors', () => {
    expect(getErrorMessage(new ApiError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'x', requestId: null, details: ['a', 'b'] }))).toBe('a\nb');
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(null)).toBe('Kutilmagan xatolik yuz berdi.');
  });
});
