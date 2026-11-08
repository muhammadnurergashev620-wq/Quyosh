import { describe, expect, it } from 'vitest';
import { groupByDate, matchesFilter, notificationColor, notificationGroup } from './notification-ui';
import type { AppNotification } from './types';

const make = (template: string, createdAt: string, status: AppNotification['status'] = 'SENT'): AppNotification =>
  ({ id: `${template}-${createdAt}`, title: 't', body: 'b', template, data: {}, status, readAt: null, createdAt }) as AppNotification;

describe('notification-ui', () => {
  it('groups notifications by tab', () => {
    expect(notificationGroup(make('QUOTE_RECEIVED', '2026-11-07T08:00:00Z'))).toBe('offers');
    expect(notificationGroup(make('NEW_MESSAGE', '2026-11-07T08:00:00Z'))).toBe('offers');
    expect(notificationGroup(make('INSTALLATION_STATUS_CHANGED', '2026-11-07T08:00:00Z'))).toBe('install');
    expect(notificationGroup(make('OPS_ALERT', '2026-11-07T08:00:00Z'))).toBe('system');
  });

  it('colors by type', () => {
    expect(notificationColor(make('NEW_MESSAGE', '2026-11-07T08:00:00Z'), '/mijoz', false)).toBe('violet');
    expect(notificationColor(make('QUOTE_EXPIRING', '2026-11-07T08:00:00Z'), '/mijoz', false)).toBe('yellow');
    expect(notificationColor(make('OPS_ALERT', '2026-11-07T08:00:00Z'), '/mijoz', true)).toBe('red');
    expect(notificationColor(make('INSTALLATION_STATUS_CHANGED', '2026-11-07T08:00:00Z'), '/mijoz', false)).toBe('green');
  });

  it('filters unread', () => {
    expect(matchesFilter(make('QUOTE_RECEIVED', '2026-11-07T08:00:00Z', 'READ'), 'unread')).toBe(false);
    expect(matchesFilter(make('QUOTE_RECEIVED', '2026-11-07T08:00:00Z'), 'unread')).toBe(true);
  });

  it('buckets by date: today, yesterday, this week, earlier', () => {
    const now = new Date('2026-11-07T10:00:00Z');
    const groups = groupByDate([
      make('A', '2026-11-07T09:00:00Z'),
      make('B', '2026-11-06T09:00:00Z'),
      make('C', '2026-11-03T09:00:00Z'),
      make('D', '2026-10-20T09:00:00Z'),
    ], now);
    expect(groups.map((g) => g.key)).toEqual(['today', 'yesterday', 'week', 'older']);
  });
});
