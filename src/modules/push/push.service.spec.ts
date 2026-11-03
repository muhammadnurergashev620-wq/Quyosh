import { describe, expect, it, vi } from 'vitest';
import { PushService, toPushData } from './push.service';
import type { PushTransport } from './push.transport';

function fakeDb(tokens: string[]) {
  const removed: string[][] = [];
  const db = {
    pushToken: {
      findMany: vi.fn().mockResolvedValue(tokens.map((token) => ({ token }))),
      count: vi.fn().mockResolvedValue(tokens.length),
      deleteMany: vi.fn().mockImplementation(({ where }: { where: { token?: { in: string[] } } }) => {
        if (where.token?.in) removed.push(where.token.in);
        return Promise.resolve({ count: where.token?.in.length ?? 0 });
      }),
    },
  };
  return { db, removed };
}

describe('PushService', () => {
  it('does nothing and never throws when push is disabled', async () => {
    const { db } = fakeDb(['a']);
    const service = new PushService(db as never, null);
    expect(service.enabled).toBe(false);
    expect(await service.hasTokens('u1')).toBe(false);
    await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toBeUndefined();
    expect(db.pushToken.findMany).not.toHaveBeenCalled();
  });

  it('sends to every device of the user and removes tokens FCM reports as invalid', async () => {
    const { db, removed } = fakeDb(['good', 'dead']);
    const transport: PushTransport = { send: vi.fn().mockResolvedValue({ sent: 1, invalidTokens: ['dead'] }) };
    const service = new PushService(db as never, transport);
    await service.sendToUser('u1', { title: 'Salom', body: 'Xabar', data: { type: 'chat.message' } });
    expect(transport.send).toHaveBeenCalledWith(['good', 'dead'], { title: 'Salom', body: 'Xabar', data: { type: 'chat.message' } });
    expect(removed).toEqual([['dead']]);
  });

  it('swallows transport failures so the main flow is never interrupted', async () => {
    const { db } = fakeDb(['t']);
    const transport: PushTransport = { send: vi.fn().mockRejectedValue(new Error('network down')) };
    await expect(new PushService(db as never, transport).sendToUser('u1', { title: 't', body: 'b' })).resolves.toBeUndefined();
  });

  it('flattens notification data to strings only', () => {
    expect(toPushData('order.booked', { orderId: 'o1', n: 3, ok: true, nested: { a: 1 }, nothing: null })).toEqual({ type: 'order.booked', orderId: 'o1', n: '3', ok: 'true' });
    expect(toPushData(null, undefined)).toEqual({});
  });
});
