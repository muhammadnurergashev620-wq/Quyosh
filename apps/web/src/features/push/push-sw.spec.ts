import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** `public/push-sw.js` ni soxta `self` bilan ishga tushiradi (brauzersiz tekshiruv). */
function loadServiceWorker(clients: Array<{ visibilityState: string; focused: boolean; postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const fakeSelf = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue(clients), openWindow },
    registration: { showNotification },
  };
  const source = readFileSync(resolve(__dirname, '../../../public/push-sw.js'), 'utf8');
  new Function('self', source)(fakeSelf);
  return { listeners, showNotification, openWindow };
}

const pushEvent = (payload: unknown) => {
  const waits: Array<Promise<unknown>> = [];
  return { event: { data: { json: () => payload }, waitUntil: (promise: Promise<unknown>) => waits.push(promise) }, done: () => Promise.all(waits) };
};

describe('push-sw.js', () => {
  it('shows the FCM notification when the site is not in front', async () => {
    const { listeners, showNotification } = loadServiceWorker([]);
    const { event, done } = pushEvent({ notification: { title: 'Yangi xabar', body: 'Salom' }, data: { type: 'chat.message', conversationId: 'c1' } });
    listeners.get('push')!(event);
    await done();
    expect(showNotification).toHaveBeenCalledWith('Yangi xabar', expect.objectContaining({ body: 'Salom', tag: 'c1', data: { type: 'chat.message', conversationId: 'c1' } }));
  });

  it('stays silent when the site is open and focused (the app shows it itself)', async () => {
    const { listeners, showNotification } = loadServiceWorker([{ visibilityState: 'visible', focused: true, postMessage: vi.fn(), focus: vi.fn() }]);
    const { event, done } = pushEvent({ notification: { title: 'x', body: 'y' } });
    listeners.get('push')!(event);
    await done();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('keeps incoming calls on screen until answered', async () => {
    const { listeners, showNotification } = loadServiceWorker([]);
    const { event, done } = pushEvent({ notification: { title: 'Ali', body: 'Video qo‘ng‘iroq qilmoqda' }, data: { kind: 'call', callId: 'k1' } });
    listeners.get('push')!(event);
    await done();
    expect(showNotification).toHaveBeenCalledWith('Ali', expect.objectContaining({ requireInteraction: true, tag: 'k1' }));
  });

  it('survives a broken payload', async () => {
    const { listeners, showNotification } = loadServiceWorker([]);
    const waits: Array<Promise<unknown>> = [];
    listeners.get('push')!({ data: { json: () => { throw new Error('bad'); } }, waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
    expect(showNotification).toHaveBeenCalledWith('Quyosh', expect.anything());
  });

  it('click: focuses an open tab and tells it where to go; opens a new tab with ?push= when closed', async () => {
    const open = { visibilityState: 'hidden', focused: false, postMessage: vi.fn(), focus: vi.fn().mockResolvedValue(undefined) };
    const first = loadServiceWorker([open]);
    const close = vi.fn();
    const click = (sw: ReturnType<typeof loadServiceWorker>) => {
      const waits: Array<Promise<unknown>> = [];
      sw.listeners.get('notificationclick')!({ notification: { close, data: { type: 'order.booked', orderId: 'o1' } }, waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
      return Promise.all(waits);
    };
    await click(first);
    expect(close).toHaveBeenCalled();
    expect(open.postMessage).toHaveBeenCalledWith({ source: 'gm-push', data: { type: 'order.booked', orderId: 'o1' } });
    expect(open.focus).toHaveBeenCalled();

    const second = loadServiceWorker([]);
    await click(second);
    expect(second.openWindow).toHaveBeenCalledWith(`/?push=${encodeURIComponent(JSON.stringify({ type: 'order.booked', orderId: 'o1' }))}`);
  });
});
