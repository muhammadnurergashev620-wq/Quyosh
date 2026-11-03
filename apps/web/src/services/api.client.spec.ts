import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, SESSION_EXPIRED_EVENT } from './api.client';
import { ApiError } from '@/types/api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('api.client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps a successful envelope to just its data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '1' }, requestId: 'r1' }));
    await expect(apiGet('/problem-requests/1')).resolves.toEqual({ id: '1' });
  });

  it('throws an ApiError carrying the backend error code on a failure envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        success: false,
        statusCode: 409, code: 'REQUEST_ALREADY_BOOKED', message: 'Already booked', requestId: 'r2',
      }),
    );
    await expect(apiGet('/problem-requests/1')).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_BOOKED',
      statusCode: 409,
      isConflict: true,
    });
  });

  it('wraps a transport failure as a NETWORK_ERROR ApiError instead of letting fetch throw raw', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await apiGet('/problem-requests/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
  });

  it('does not attempt a session refresh for a 401 from an /auth/ endpoint itself', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, {
        success: false,
        statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid phone number or password', requestId: null,
      }),
    );
    await expect(apiGet('/auth/sessions')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('on a 401 from a non-auth endpoint, refreshes once and retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required', requestId: null,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '1' }, requestId: 'r3' }));

    await expect(apiGet('/orders/1')).resolves.toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/auth/refresh');
  });

  it('when refresh itself fails, propagates the original 401 and announces session expiry', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required', requestId: null,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(apiGet('/orders/1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
