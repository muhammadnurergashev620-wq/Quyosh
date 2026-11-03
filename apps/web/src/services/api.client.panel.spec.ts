import { afterEach, describe, expect, it, vi } from 'vitest';

async function requestHeaders(role?: string): Promise<Record<string, string>> {
  vi.resetModules();
  vi.stubEnv('VITE_APP_ROLE', role ?? '');
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {}, requestId: null })));
  vi.stubGlobal('fetch', fetchMock);
  const { apiGet } = await import('./api.client');
  await apiGet('/x');
  return (fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
}

describe('api.client panel header', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(['CUSTOMER', 'SHOP', 'ADMIN'])('identifies the %s panel to the backend', async (role) => {
    expect((await requestHeaders(role))['X-App-Panel']).toBe(role);
  });

  it('sends no panel header when the app is not bound to a role', async () => {
    expect((await requestHeaders())['X-App-Panel']).toBeUndefined();
  });
});
