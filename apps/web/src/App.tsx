import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ToastViewport } from '@/components/ui/Toast';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router/router';

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ToastViewport />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
