import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { hasSession: boolean; me: { isLoading: boolean; data: { mustPasswordChange?: boolean } | undefined } } = { hasSession: true, me: { isLoading: false, data: {} } };
vi.mock('@/store/auth.store', () => ({ useAuthStore: (selector: (s: { hasSession: boolean }) => unknown) => selector({ hasSession: state.hasSession }) }));
vi.mock('@/features/session/hooks/useMe', () => ({ useMe: () => state.me }));

import { FIRST_PASSWORD_PATH, ProtectedRoute } from './ProtectedRoute';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dokon/*" element={<ProtectedRoute>panel</ProtectedRoute>} />
        <Route path="/login" element={<p>kirish</p>} />
        <Route path={FIRST_PASSWORD_PATH} element={<p>yangi parol o‘rnating</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute (vaqtincha parol, TZ 3.5)', () => {
  beforeEach(() => {
    state.hasSession = true;
    state.me = { isLoading: false, data: {} };
  });

  it('sends guests to login', () => {
    state.hasSession = false;
    renderAt('/dokon/sorovlar');
    expect(screen.getByText('kirish')).toBeInTheDocument();
  });

  it('shows the panel once the password is permanent', () => {
    renderAt('/dokon/sorovlar');
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('forces the first-password screen on any panel URL while mustPasswordChange is true', () => {
    state.me = { isLoading: false, data: { mustPasswordChange: true } };
    renderAt('/dokon/analitika');
    expect(screen.getByText('yangi parol o‘rnating')).toBeInTheDocument();
    expect(screen.queryByText('panel')).not.toBeInTheDocument();
  });

  it('does not render panel requests until the profile is known', () => {
    state.me = { isLoading: true, data: undefined };
    renderAt('/dokon');
    expect(screen.queryByText('panel')).not.toBeInTheDocument();
  });
});
