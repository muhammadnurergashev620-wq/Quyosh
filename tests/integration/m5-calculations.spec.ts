import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createUser, type Harness, type TestUser } from '../helpers/harness';

/** M5: hisobni saqlash, qayta hisoblash, solishtirish, ulashish (manzil yashirin), draft. */
describe('M5 calculations integration', () => {
  let h: Harness;
  let user: TestUser;
  const input = { mode: 'QUICK', lat: 41.3123, lon: 69.2811, areaPreset: 'SMALL', consumption: { monthlyKwh: 350 } };
  let id: string;

  beforeAll(async () => {
    h = await bootHarness();
    user = await createUser(h);
  });
  afterAll(async () => h?.close());

  it('requires login to save and recomputes on the server', async () => {
    expect((await h.post('/calculations', undefined, { input })).status).toBe(401);
    const saved = await h.post('/calculations', user.token, { input, title: 'Uy hisobi' });
    expect(saved.status).toBe(201);
    id = saved.data.id;
    expect(saved.data.result.systemPowerKw).toBeGreaterThan(0);
    const list = await h.get('/calculations', user.token);
    expect(list.data[0]).toMatchObject({ id, title: 'Uy hisobi', mode: 'QUICK' });
  });

  it('recalculate creates a new record and keeps the old snapshot', async () => {
    const again = await h.post(`/calculations/${id}/recalculate`, user.token);
    expect(again.data.id).not.toBe(id);
    expect((await h.get(`/calculations/${id}`, user.token)).status).toBe(200);
    const compare = await h.get(`/calculations/compare?ids=${id},${again.data.id}`, user.token);
    expect(compare.data).toHaveLength(2);
  });

  it('hides other users’ calculations', async () => {
    const other = await createUser(h);
    expect((await h.get(`/calculations/${id}`, other.token)).status).toBe(404);
    expect((await h.post(`/calculations/${id}/share`, other.token, {})).status).toBe(404);
  });

  it('shared view hides the exact location and counts views; revoke works', async () => {
    const share = await h.post(`/calculations/${id}/share`, user.token, { expiresDays: 7 });
    expect(share.data.token).toBeTruthy();
    const view = await h.get(`/shared/${share.data.token}`);
    expect(view.status).toBe(200);
    expect(view.data.result.meta.location).toBeNull();
    expect(JSON.stringify(view.data)).not.toContain('69.281');
    expect(view.data.result.meta.regionCode).toBe('toshkent-shahri');
    const owner = await h.get(`/calculations/${id}`, user.token);
    expect(owner.data.shares[0].viewCount).toBe(1);
    await h.del(`/calculations/${id}/share`, user.token);
    expect((await h.get(`/shared/${share.data.token}`)).status).toBe(404);
  });

  it('renders a PDF report in the background and serves a signed download link', async () => {
    const job = await h.post(`/calculations/${id}/report`, user.token, { lang: 'ru', qrMode: 'CABINET' });
    expect(job.status).toBe(201);
    let status = 'QUEUED';
    for (let i = 0; i < 40 && status !== 'READY' && status !== 'FAILED'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = (await h.get(`/reports/${job.data.id}`, user.token)).data.status;
    }
    expect(status).toBe('READY');
    const download = await h.get(`/reports/${job.data.id}/download`, user.token);
    const pdf = await fetch(download.data.url);
    expect(pdf.status).toBe(200);
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(10_000);
    const other = await createUser(h);
    expect((await h.get(`/reports/${job.data.id}/download`, other.token)).status).toBe(404);
  });

  it('stores a guest draft by cookie and attaches it to the user after login', async () => {
    const put = await h.api('PUT', '/calculations/draft', { body: { input: { step: 3, consumption: { monthlyKwh: 500 } } } });
    expect(put.status).toBe(200);
    const cookie = (put.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(cookie).toContain('qs_calc_draft=');
    const guest = await h.api('GET', '/calculations/draft', { cookie });
    expect(guest.data.input.step).toBe(3);
    const owner = await h.api('GET', '/calculations/draft', { cookie: `${cookie}; accessToken=${user.token}` });
    expect(owner.data.input.step).toBe(3);
    const later = await h.get('/calculations/draft', user.token);
    expect(later.data.input.step).toBe(3);
  });
});
