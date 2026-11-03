import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { env } from '@/lib/env';
import { splitFullName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useRegister } from '../hooks/useAuth';
import { formatLocalPhone, toLocalDigits, registerSchema, toFullPhone, type RegisterFormValues } from '../validation';
import { t } from '@/i18n';

export function RegisterForm() {
  const navigate = useNavigate();
  const register_ = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  function onSubmit(values: RegisterFormValues) {
    register_.mutate(
      {
        phone: toFullPhone(toLocalDigits(values.phoneLocal)),
        password: values.password,
        ...(splitFullName(values.fullName) ?? { firstName: values.fullName, lastName: '' }),
      },
      { onSuccess: (result) => navigate('/otp', { state: { flow: result.existingAccount ? 'login' : 'register' } }) },
    );
  }

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {register_.isError && <Alert tone="danger">{getErrorMessage(register_.error)}</Alert>}

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
      <Input label={t('To‘liq ism')} placeholder={t('Masalan: Kamronbek Ziyovuddinov')} autoComplete="name" maxLength={200} required {...register('fullName')} error={errors.fullName?.message} />
      <Input
        label={t('Parol')}
        type="password"
        autoComplete="new-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label={t('Parolni takrorlang')}
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Checkbox
        label={
          <>
            <Link to="/shartlar" target="_blank" rel="noopener" onClick={(event) => event.stopPropagation()}>
              {t('Foydalanish shartlari')}
            </Link>{' '}
            {t('ni o‘qib chiqdim va qabul qilaman')}
          </>
        }
        error={errors.acceptedTerms?.message}
        {...register('acceptedTerms')}
      />
      <Button type="submit" loading={register_.isPending} fullWidth>
        {env.appRole === 'SHOP' ? t('Do‘kon egasi sifatida ro‘yxatdan o‘tish') : t('Mijoz sifatida ro‘yxatdan o‘tish')}
      </Button>
    </form>
  );
}
