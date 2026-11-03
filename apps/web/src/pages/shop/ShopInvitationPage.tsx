import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/common/PageLoader';
import { shopService } from '@/features/shop/shop.service';
import { MEMBER_ROLE } from '@/features/shop/labels';
import { myShopsKey, useShopSelection } from '@/features/shop/current-shop';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { rememberReturnTo } from '@/lib/return-to';
import { useAuthStore } from '@/store/auth.store';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

/** TZ 3.7.1: do‘kon taklifini qabul qilish. Faqat taklif yuborilgan tasdiqlangan telefon/email egasi qabul qiladi. */
export function ShopInvitationPage() {
  const { token = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasSession = useAuthStore((s) => s.hasSession);
  const setShopId = useShopSelection((s) => s.setShopId);
  const pushToast = useAppStore((s) => s.pushToast);
  const preview = useQuery({ queryKey: ['shop-invitation', token], queryFn: () => shopService.previewInvitation(token), retry: false });
  const accept = useMutation({
    mutationFn: () => shopService.acceptInvitation(token),
    onSuccess: async (result) => {
      setShopId(result.shopId);
      await Promise.all([queryClient.invalidateQueries({ queryKey: myShopsKey }), queryClient.invalidateQueries({ queryKey: ['users', 'me'] })]);
      pushToast(t('Taklif qabul qilindi'), 'success');
      navigate('/dokon', { replace: true });
    },
  });

  if (preview.isLoading) return <PageLoader />;
  return (
    <div className="qs-page" style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
      <section className="qs-card">
        <header><Store size={22} aria-hidden="true" /><h2>{t('Do‘konga taklif')}</h2></header>
        {preview.isError || !preview.data ? (
          <Alert tone="danger">{getErrorMessage(preview.error)}</Alert>
        ) : (
          <div className="qs-form">
            <dl className="qs-dl">
              <dt>{t('Do‘kon')}</dt><dd><strong>{preview.data.shop.name}</strong></dd>
              <dt>{t('Rol')}</dt><dd>{MEMBER_ROLE[preview.data.memberRole]}</dd>
              <dt>{t('Kimga')}</dt><dd>{preview.data.target}</dd>
              <dt>{t('Amal qiladi')}</dt><dd>{t('{date} gacha', { date: formatDate(preview.data.expiresAt) })}</dd>
            </dl>
            {preview.data.expired ? (
              <Alert tone="warning">{t('Taklif muddati tugagan. Yangi taklif so‘rang.')}</Alert>
            ) : hasSession ? (
              <>
                {accept.isError && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
                <Button loading={accept.isPending} onClick={() => accept.mutate()}>{t('Taklifni qabul qilish')}</Button>
              </>
            ) : (
              <>
                <Alert tone="info">{t('Qabul qilish uchun taklif yuborilgan telefon yoki email bilan kiring yoki ro‘yxatdan o‘ting.')}</Alert>
                <div className="qs-form__actions">
                  <Link className="gm-button gm-button--secondary gm-button--md" to="/register" onClick={() => rememberReturnTo(location.pathname)}>{t('Ro‘yxatdan o‘tish')}</Link>
                  <Link className="gm-button gm-button--primary gm-button--md" to="/login" onClick={() => rememberReturnTo(location.pathname)}>{t('Kirish')}</Link>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
