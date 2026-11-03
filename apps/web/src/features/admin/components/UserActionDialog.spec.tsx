import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../types';

const setStatus = vi.fn();
const deleteUser = vi.fn();
const regBlock = vi.fn();
vi.mock('../hooks/useAdmin', () => ({
  useSetUserStatus: () => ({ mutate: setStatus, isPending: false, error: null }),
  useDeleteUser: () => ({ mutate: deleteUser, isPending: false, error: null }),
  useSetRegistrationBlock: () => ({ mutate: regBlock, isPending: false, error: null }),
}));

import { UserActionDialog } from './UserActionDialog';

const user: AdminUser = {
  accountNumber: 571,
  id: 'u1',
  phone: '+998901112233',
  email: null,
  firstName: 'Ali',
  lastName: 'Valiyev',
  status: 'ACTIVE',
  createdAt: '2026-09-23T17:08:00Z',
  deletedAt: null,
  roles: ['CUSTOMER'],
  shopMemberships: [],
};

describe('UserActionDialog', () => {
  beforeEach(() => {
    setStatus.mockClear();
    deleteUser.mockClear();
    regBlock.mockClear();
  });

  it('names the account and explains what freezing does', () => {
    render(<UserActionDialog user={user} action="SUSPEND" onClose={() => undefined} />);
    expect(screen.getByText('Akkauntni muzlatish')).toBeInTheDocument();
    expect(screen.getByText('Ali Valiyev')).toBeInTheDocument();
    expect(screen.getByText(/darhol tizimdan chiqariladi/)).toBeInTheDocument();
  });

  it('will not freeze without a reason of at least 3 characters', async () => {
    render(<UserActionDialog user={user} action="SUSPEND" onClose={() => undefined} />);
    const confirm = screen.getByRole('button', { name: 'Muzlatish' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Sabab/), 'ab');
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Sabab/), 'c');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(setStatus).toHaveBeenCalledWith({ id: 'u1', status: 'SUSPENDED', reason: 'abc' }, expect.anything());
  });

  it('blocks with status BLOCKED and deletes through the delete endpoint', async () => {
    const { unmount } = render(<UserActionDialog user={user} action="BLOCK" onClose={() => undefined} />);
    await userEvent.type(screen.getByLabelText(/Sabab/), 'Qoidabuzarlik');
    await userEvent.click(screen.getByRole('button', { name: 'Bloklash' }));
    expect(setStatus).toHaveBeenCalledWith({ id: 'u1', status: 'BLOCKED', reason: 'Qoidabuzarlik' }, expect.anything());
    unmount();

    render(<UserActionDialog user={user} action="DELETE" onClose={() => undefined} />);
    expect(screen.getByText(/bekor qilib bo‘lmaydi/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Sabab/), 'So‘rov bo‘yicha');
    await userEvent.click(screen.getByRole('button', { name: 'O‘chirish' }));
    expect(deleteUser).toHaveBeenCalledWith({ id: 'u1', reason: 'So‘rov bo‘yicha' }, expect.anything());
  });

  it('reactivates without asking for a reason', async () => {
    render(<UserActionDialog user={{ ...user, status: 'SUSPENDED' }} action="ACTIVATE" onClose={() => undefined} />);
    expect(screen.queryByLabelText(/Sabab/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Faollashtirish' }));
    expect(setStatus).toHaveBeenCalledWith({ id: 'u1', status: 'ACTIVE' }, expect.anything());
  });
});
