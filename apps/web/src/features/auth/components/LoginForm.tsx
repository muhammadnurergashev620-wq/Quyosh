import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getNavItems } from '@/components/layout/nav-items';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/error-messages';
import { useLogin } from '../hooks/useAuth';
import { formatLocalPhone, toLocalDigits, loginNameSchema, loginSchema, toFullPhone, type LoginFormValues } from '../validation';
import { env } from '@/lib/env';
import { ApiError } from '@/types/api';
import { t } from '@/i18n';
import { consumeReturnTo } from '@/lib/return-to';

export function LoginForm() {
  const navigate = useNavigate();
  const login = useLogin();
  // Do‘kon va admin panellari: administrator bergan login + parol; mijoz paneli: telefon + parol.
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const byLogin = env.appRole === 'SHOP' || env.appRole === 'ADMIN' || preferredRole === 'ADMIN';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(byLogin ? loginNameSchema : loginSchema) as never });

  function onSubmit(values: LoginFormValues) {
    login.mutate(
      byLogin ? { login: values.login.trim(), password: values.password } : { phone: toFullPhone(toLocalDigits(values.phoneLocal)), password: values.password },
      {
        onSuccess: (result) => {
          if (result.verificationRequired) {
            navigate('/otp', { state: { flow: 'login' } });
            return;
          }
          const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
          navigate(consumeReturnTo() ?? firstItem?.to ?? '/', { replace: true });
        },
      },
    );
  }

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {login.isError && (
        <Alert tone="danger">
          {byLogin && login.error instanceof ApiError && login.error.statusCode === 401 ? t('Login yoki parol noto‘g‘ri.') : getErrorMessage(login.error)}
        </Alert>
      )}

      {byLogin ? (
        <Input
          label={t('Login')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          placeholder={t('Administrator bergan login')}
          required
          error={errors.login?.message}
          {...register('login')}
        />
      ) : (
        <Input
          label={t('Telefon raqami')}
          prefix="+998"
          inputMode="numeric"
          placeholder="90 123 45 67"
          autoComplete="tel-national"
          maxLength={12}
          formatValue={formatLocalPhone}
          required
          error={errors.phoneLocal?.message}
          {...register('phoneLocal')}
        />
      )}
      <Input label={t('Parol')} type="password" required error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={login.isPending} fullWidth className="gm-auth-submit">
        {t('Kirish')} <ArrowRight size={18} />
      </Button>
    </form>
  );
}
