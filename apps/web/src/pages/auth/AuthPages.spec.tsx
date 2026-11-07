import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/store/auth.store';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('admin has no self-registration', () => {
  beforeEach(() => useAuthStore.setState({ preferredRole: null, hasSession: false }));

  it('shows the registration link on the customer login page (shop panel hides it by env role)', () => {
    for (const role of ['CUSTOMER', 'SHOP'] as const) {
      useAuthStore.setState({ preferredRole: role });
      const { unmount } = renderAt('/login');
      expect(screen.getByRole('link', { name: 'Ro‘yxatdan o‘tish' })).toBeInTheDocument();
      unmount();
    }
  });

  it('hides the registration link on the admin login page', () => {
    useAuthStore.setState({ preferredRole: 'ADMIN' });
    renderAt('/login');
    expect(screen.queryByRole('link', { name: 'Ro‘yxatdan o‘tish' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Akkauntingiz yo‘qmi/)).not.toBeInTheDocument();
  });

  it('redirects /register back to login for admins', () => {
    useAuthStore.setState({ preferredRole: 'ADMIN' });
    renderAt('/register');
    expect(screen.getByRole('heading', { name: 'Administrator kirishi' })).toBeInTheDocument();
  });
});
