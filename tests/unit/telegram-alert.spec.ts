import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { TelegramAlertService } from '../../src/infrastructure/telegram/telegram-alert.service';

function makeService(values: Record<string, unknown>) {
  const config = { get: (key: string, fallback?: unknown) => values[key] ?? fallback } as unknown as ConfigService;
  const service = new TelegramAlertService(config);
  service.onModuleInit();
  return service;
}

const ENABLED = { 'telegram.botToken': '123:SECRET', 'telegram.chatId': '-100', 'app.environment': 'test', 'telegram.retryDelayMs': 0 };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TelegramAlertService', () => {
  it('does nothing when token or chat id is missing', async () => {
    const service = makeService({ 'telegram.botToken': '123:SECRET' });
    expect(service.isEnabled()).toBe(false);
    service.notifyError({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores errors below the minimum status', async () => {
    const service = makeService(ENABLED);
    service.notifyError({ status: 404, code: 'NOT_FOUND', message: 'nope' });
    service.notifyError({ status: 401, code: 'UNAUTHORIZED', message: 'nope' });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('can be configured to include 4xx errors', async () => {
    const service = makeService({ ...ENABLED, 'telegram.minStatus': 400 });
    service.notifyError({ status: 404, code: 'NOT_FOUND', message: 'nope' });
    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends a 5xx to the Telegram Bot API with escaped HTML and no query string', async () => {
    const service = makeService(ENABLED);
    service.notifyError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: '<script>alert(1)</script>',
      method: 'GET',
      path: '/api/v1/orders?token=super-secret',
      requestId: 'req-1',
      stack: 'Error: x\n    at a (file.ts:1:1)',
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.telegram.org/bot123:SECRET/sendMessage');
    const body = JSON.parse(init.body) as { chat_id: string; text: string; parse_mode: string };
    expect(body).toMatchObject({ chat_id: '-100', parse_mode: 'HTML' });
    expect(body.text).toContain('&lt;script&gt;');
    expect(body.text).not.toContain('<script>');
    expect(body.text).toContain('/api/v1/orders');
    expect(body.text).not.toContain('super-secret');
    expect(body.text).toContain('req-1');
  });

  it('suppresses identical errors within the dedupe window but not different ones', async () => {
    const service = makeService(ENABLED);
    const alert = { status: 500, code: 'INTERNAL_ERROR', message: 'same', method: 'GET', path: '/x' };
    service.notifyError(alert);
    service.notifyError(alert);
    service.notifyError({ ...alert, message: 'different' });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('truncates very long messages', async () => {
    const service = makeService(ENABLED);
    service.notifyError({ status: 500, code: 'X', message: 'a'.repeat(10_000) });
    await flush();
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body).text.length).toBeLessThanOrEqual(3801);
  });

  it('never throws when Telegram is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down with SECRET'));
    const service = makeService(ENABLED);
    expect(() => service.notifyError({ status: 500, code: 'X', message: 'boom' })).not.toThrow();
    await flush();
  });
});

describe('TelegramAlertService.sendOtp', () => {
  const OTP = { 'telegram.botToken': '123:SECRET', 'telegram.otpChatId': '-500', 'app.environment': 'test', 'telegram.retryDelayMs': 0 };
  const input = { phone: '+998901112233', code: '123456', purposeLabel: 'Ro‘yxatdan o‘tish', ttlMinutes: 5 };

  it('posts the code to the OTP group, not to the error chat', async () => {
    const service = makeService({ ...OTP, 'telegram.chatId': '-100' });
    await expect(service.sendOtp(input)).resolves.toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as { chat_id: string; text: string };
    expect(body.chat_id).toBe('-500');
    expect(body.text).toContain('123456');
    expect(body.text).toContain('+998901112233');
    expect(body.text).toContain('Ro‘yxatdan o‘tish');
  });

  it('does not dedupe: two codes for the same phone are both delivered', async () => {
    const service = makeService(OTP);
    await service.sendOtp(input);
    await service.sendOtp({ ...input, code: '654321' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is disabled without an OTP chat id and reports not delivered', async () => {
    const service = makeService({ 'telegram.botToken': '123:SECRET', 'telegram.chatId': '-100' });
    expect(service.isOtpEnabled()).toBe(false);
    await expect(service.sendOtp(input)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure (without throwing) when Telegram rejects or is unreachable', async () => {
    const service = makeService(OTP);
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(service.sendOtp(input)).resolves.toBe(false);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(service.sendOtp(input)).resolves.toBe(false);
  });

  it('retries transient failures (network error, 429, 5xx) and delivers on a later attempt', async () => {
    const service = makeService(OTP);
    fetchMock
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(service.sendOtp(input)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 attempts, and never retries a permanent 4xx error', async () => {
    const service = makeService(OTP);
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(service.sendOtp(input)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    await expect(service.sendOtp(input)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('AllExceptionsFilter → notifier', () => {
  function run(exception: unknown, notifier: { notifyError: ReturnType<typeof vi.fn> }) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const req = { method: 'POST', url: '/api/v1/x?y=1', headers: { 'x-request-id': 'rid' } };
    const host = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) };
    new AllExceptionsFilter(notifier).catch(exception, host as never);
    return res;
  }

  it('reports unexpected errors with request context and still answers the client', () => {
    const notifier = { notifyError: vi.fn() };
    const res = run(new Error('db exploded'), notifier);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(notifier.notifyError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, code: 'INTERNAL_ERROR', method: 'POST', requestId: 'rid' }),
    );
    expect(JSON.stringify(res.json.mock.calls[0])).not.toContain('db exploded');
  });

  it('survives a notifier that throws', () => {
    const notifier = {
      notifyError: vi.fn(() => {
        throw new Error('alert failed');
      }),
    };
    const res = run(new Error('x'), notifier);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
