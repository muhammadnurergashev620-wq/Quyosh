import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/common/PageLoader';
import { getNavItems } from '@/components/layout/nav-items';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { sessionService } from '@/features/session/services/session.service';
import { useMe } from '@/features/session/hooks/useMe';
import { getErrorMessage } from '@/lib/error-messages';
import { useAuthStore } from '@/store/auth.store';
import { t } from '@/i18n';

const schema = z
  .object({
    newPassword: z.string().min(8, t('Kamida 8 ta belgi')).max(128, t('Juda uzun')),
    confirmPassword: z.string().min(1, t('Parolni qayta kiriting')),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: t('Parollar bir xil emas') });
type Values = z.infer<typeof schema>;

/**
 * Birinchi kirish (TZ 3.5, U11.1): admin bergan vaqtincha parol almashtirilmaguncha boshqa sahifalar ochilmaydi
 * (`ProtectedRoute` shu yerga yo‘naltiradi; server ham boshqa so‘rovlarga 403 PASSWORD_CHANGE_REQUIRED qaytaradi).
 */
export function FirstPasswordPage() {
  const hasSession = useAuthStore((s) => s.hasSession);
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  const change = useMutation({
    mutationFn: (values: Values) => sessionService.firstPassword(values.newPassword),
    onSuccess: (updated) => {
      queryClient.setQueryData(['users', 'me'], updated);
      const [first] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: false });
      navigate(first?.to ?? '/', { replace: true });
    },
  });

  if (!hasSession) return <Navigate to="/login" replace />;
  if (me.isLoading) return <PageLoader />;
  if (!me.data?.mustPasswordChange) {
    const [first] = getNavItems(preferredRole, { superAdmin: false });
    return <Navigate to={first?.to ?? '/'} replace />;
  }

  return (
    <div className="gm-auth-page">
      <h1>{t('Yangi parol o‘rnating')}</h1>
      <p className="gm-auth-page__subtitle">{t('Administrator bergan vaqtincha parol bilan kirdingiz. Davom etish uchun o‘zingizga yangi parol o‘rnating.')}</p>
      <form className="gm-auth-form" onSubmit={(e) => void handleSubmit((values) => change.mutate(values))(e)} noValidate>
        {change.isError && <Alert tone="danger">{getErrorMessage(change.error)}</Alert>}
        <Input label={t('Yangi parol')} type="password" autoComplete="new-password" required error={errors.newPassword?.message} hint={t('Kamida 8 ta belgi')} {...register('newPassword')} />
        <Input label={t('Yangi parolni takrorlang')} type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" loading={change.isPending} fullWidth className="gm-auth-submit">{t('Parolni saqlash')}</Button>
      </form>
      <p className="gm-auth-page__switch">
        <Button type="button" variant="link" size="sm" leftIcon={<LogOut />} disabled={logout.isPending} onClick={() => logout.mutate(false)}>
          {t('Tizimdan chiqish')}
        </Button>
      </p>
    </div>
  );
}
