import { describe, expect, it } from 'vitest';
import { entityPath, notificationMeta } from './notification-meta';
import type { AppNotification } from './types';

const id = '11111111-2222-4333-8444-555555555555';
const n = (template: string, data: Record<string, unknown> = {}): AppNotification =>
  ({ id: 'n', title: 't', body: 'b', template, data, status: 'SENT', readAt: null, createdAt: '2026-11-01T00:00:00Z' }) as AppNotification;

describe('notificationMeta', () => {
  it('routes Quyosh notifications by entity type and panel', () => {
    expect(notificationMeta(n('QUOTE_RECEIVED', { entityType: 'Quote', entityId: id })).to).toBe(`/mijoz/takliflar/${id}`);
    expect(notificationMeta(n('QUOTE_REQUEST_RECEIVED', { entityType: 'RequestShop', entityId: id }), '/dokon').to).toBe(`/dokon/sorovlar/${id}`);
    expect(notificationMeta(n('NEW_MESSAGE', { entityType: 'RequestShop', entityId: id })).to).toBe(`/mijoz/chat/${id}`);
    expect(notificationMeta(n('INSTALLATION_ISSUE_REPORTED', { entityId: id }), '/dokon').to).toBe(`/dokon/montajlar/${id}`);
    expect(notificationMeta(n('SUPPORT_REPLY', { entityId: id })).to).toBe(`/mijoz/murojaatlar/${id}`);
    expect(notificationMeta(n('CERTIFICATION_EXPIRING', {}), '/dokon').to).toBe('/dokon');
  });

  it('never builds a link from a malformed id or for admins; unknown types stay inert', () => {
    expect(entityPath('RequestShop', '../../evil', '/mijoz')).toBeUndefined();
    expect(notificationMeta(n('QUOTE_RECEIVED', { entityId: 'x/../y' })).to).toBeUndefined();
    expect(notificationMeta(n('QUOTE_RECEIVED', { entityId: id }), '/mijoz', true).to).toBeUndefined();
    expect(notificationMeta(n('SOMETHING_ELSE')).to).toBeUndefined();
    expect(notificationMeta(n('OPS_ALERT'), '/mijoz', true).to).toBe('/admin/devops');
  });
});
