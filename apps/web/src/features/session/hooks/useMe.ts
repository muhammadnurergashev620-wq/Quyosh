import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { sessionService } from '../services/session.service';

export function useMe() {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => sessionService.me(),
    enabled: hasSession,
    staleTime: 5 * 60_000,
  });
}
