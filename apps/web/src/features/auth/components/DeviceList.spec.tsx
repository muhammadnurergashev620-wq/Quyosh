import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceSession } from '../types';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const state: { data: DeviceSession[] | undefined; isLoading: boolean; isError: boolean } = { data: [], isLoading: false, isError: false };
const revoke = vi.fn();
const revokeOthers = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useSessions: () => state,
  useRevokeSession: () => ({ mutate: revoke, isPending: false, error: null }),
  useRevokeOtherSessions: () => ({ mutate: revokeOthers, isPending: false, error: null, isSuccess: false }),
}));

import { DeviceList } from './DeviceList';

const session = (over: Partial<DeviceSession>): DeviceSession => ({
  id: 's1',
  status: 'ACTIVE',
  userAgent: CHROME,
  ipAddress: '10.0.0.5',
  panel: 'CUSTOMER',
  createdAt: '2026-09-23T17:08:00Z',
  lastSeenAt: new Date().toISOString(),
  isCurrent: false,
  canRevoke: true,
  revokeLockedUntil: null,
  ...over,
});

describe('DeviceList', () => {
  beforeEach(() => {
    state.data = [];
    state.isLoading = false;
    state.isError = false;
    revoke.mockClear();
    revokeOthers.mockClear();
  });

  it('shows browser, OS, IP and panel for every device and marks the current one', () => {
    state.data = [
      session({ id: 'a', isCurrent: true }),
      session({ id: 'b', userAgent: IPHONE, panel: 'SHOP', ipAddress: '10.0.0.9' }),
    ];
    render(<DeviceList />);
    expect(screen.getByText('Chrome · Windows')).toBeInTheDocument();
    expect(screen.getByText('Safari · iOS')).toBeInTheDocument();
    expect(screen.getByText('Joriy qurilma')).toBeInTheDocument();
    expect(screen.getByText('Mijoz paneli')).toBeInTheDocument();
    expect(screen.getByText('Do‘kon paneli')).toBeInTheDocument();
    expect(screen.getByText(/IP: 10\.0\.0\.9/)).toBeInTheDocument();
  });

  it('offers “sign out” only for other devices, never for the current one', async () => {
    state.data = [session({ id: 'a', isCurrent: true }), session({ id: 'b', userAgent: IPHONE })];
    render(<DeviceList />);
    const buttons = screen.getAllByRole('button', { name: 'Chiqarish' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    expect(revoke).toHaveBeenCalledWith('b');
  });

  it('asks for confirmation before signing out all other devices', async () => {
    state.data = [session({ id: 'a', isCurrent: true }), session({ id: 'b' }), session({ id: 'c' })];
    render(<DeviceList />);
    await userEvent.click(screen.getByRole('button', { name: /Boshqa qurilmalardan chiqish/ }));
    expect(revokeOthers).not.toHaveBeenCalled();
    expect(screen.getByText(/2 ta qurilma tizimdan chiqariladi/)).toBeInTheDocument();
  });

  it('locks older devices while this device is new, with no sign-out button and a disabled bulk action', () => {
    state.data = [
      session({ id: 'a', isCurrent: true }),
      session({ id: 'b', canRevoke: false, revokeLockedUntil: '2026-09-25T18:00:00Z' }),
    ];
    render(<DeviceList />);
    expect(screen.queryByRole('button', { name: 'Chiqarish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boshqa qurilmalardan chiqish/ })).toBeDisabled();
    expect(screen.getByText(/yaqinda ulangan/)).toBeInTheDocument();
  });

  it('hides the bulk action when this is the only device', () => {
    state.data = [session({ id: 'a', isCurrent: true })];
    render(<DeviceList />);
    expect(screen.queryByRole('button', { name: /Boshqa qurilmalardan chiqish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chiqarish' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no active devices', () => {
    render(<DeviceList />);
    expect(screen.getByText('Faol qurilma topilmadi')).toBeInTheDocument();
  });
});
