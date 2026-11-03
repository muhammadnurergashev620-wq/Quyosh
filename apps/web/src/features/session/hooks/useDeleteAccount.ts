import { useMutation } from '@tanstack/react-query';
import { sessionService } from '../services/session.service';

/** Akkauntni o‘chirish (parolli akkauntda joriy parol kerak). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password?: string) => sessionService.deleteAccount(password),
    gcTime: 0,
  });
}
