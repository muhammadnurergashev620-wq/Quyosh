import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/types/common';

const state: { role: Role | null; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void } = {
  role: null,
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => undefined,
};
vi.mock('@/features/session/hooks/useCurrentRole', () => ({ useCurrentRole: () => state }));

import { RoleGuard } from './RoleGuard';
import { ApiError } from '@/types/api';

function renderGuard(roles: Role[]) {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/secret" element={<RoleGuard roles={roles}>maxfiy</RoleGuard>} />
        <Route path="/login" element={<p>kirish</p>} />
        <Route path="/admin" element={<p>admin bosh sahifa</p>} />
        <Route path="/mijoz/bosh" element={<p>mijoz bosh sahifa</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleGuard', () => {
  beforeEach(() => {
    state.role = null;
    state.isLoading = false;
    state.isError = false;
    state.error = null;
  });

  it('shows a loader while the role is unknown', () => {
    state.isLoading = true;
    renderGuard(['ADMIN']);
    expect(screen.getAllByText('Yuklanmoqda…').length).toBeGreaterThan(0);
    expect(screen.queryByText('maxfiy')).not.toBeInTheDocument();
  });

  it('renders children for an allowed role', () => {
    state.role = 'ADMIN';
    renderGuard(['ADMIN']);
    expect(screen.getByText('maxfiy')).toBeInTheDocument();
  });

  it('sends a wrong role to its own home page', () => {
    state.role = 'CUSTOMER';
    renderGuard(['ADMIN']);
    expect(screen.getByText('mijoz bosh sahifa')).toBeInTheDocument();
  });

  it('sends admins away from customer-only pages', () => {
    state.role = 'ADMIN';
    renderGuard(['CUSTOMER']);
    expect(screen.getByText('admin bosh sahifa')).toBeInTheDocument();
  });

  it('sends users without a resolvable role to login', () => {
    state.isError = true;
    renderGuard(['ADMIN']);
    expect(screen.getByText('kirish')).toBeInTheDocument();
  });

  it('shows a retry screen (no redirect loop) on network errors and keeps the session', () => {
    state.isError = true;
    state.error = new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'x', requestId: null });
    renderGuard(['ADMIN']);
    expect(screen.getByText('Serverga ulanib bo‘lmadi')).toBeInTheDocument();
    expect(screen.queryByText('kirish')).not.toBeInTheDocument();
  });
});
