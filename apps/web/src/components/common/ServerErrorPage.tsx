import { ServerCrash } from 'lucide-react';
import { ButtonAnchor } from '@/components/ui/Button';
import { t } from '@/i18n';
import { StatusPage } from './StatusPage';

/** 500: kutilmagan interfeys xatosi (ErrorBoundary va marshrut xatosi). Router tashqarisida ham ishlaydi — oddiy <a>. */
export function ServerErrorPage() {
  return (
    <StatusPage
      code="500"
      icon={<ServerCrash size={32} />}
      title={t('Nimadir noto‘g‘ri ketdi')}
      description={t('Sahifani qayta yuklab ko‘ring. Muammo davom etsa, keyinroq qaytadan urinib ko‘ring.')}
      action={{ onClick: () => window.location.reload(), label: t('Sahifani qayta yuklash') }}
      secondary={<ButtonAnchor href="/" variant="ghost" className="qs-status__secondary">{t('Bosh sahifaga qaytish')}</ButtonAnchor>}
    />
  );
}
