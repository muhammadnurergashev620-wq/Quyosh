import { SearchX } from 'lucide-react';
import { StatusPage } from '@/components/common/StatusPage';
import { getNavItems } from '@/components/layout/nav-items';
import { env } from '@/lib/env';
import { t } from '@/i18n';

/** Panelning bosh sahifasi (rol bo‘yicha); asosiy saytda — «/». */
function homePath(): string {
  return env.appRole ? (getNavItems(env.appRole, { superAdmin: true })[0]?.to ?? '/') : '/';
}

export function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      icon={<SearchX size={32} />}
      title={t('Sahifa topilmadi')}
      description={t('Bunday sahifa mavjud emas yoki ko‘chirilgan. Manzilni tekshiring yoki bosh sahifaga qayting.')}
      action={{ to: homePath(), label: t('Bosh sahifaga qaytish') }}
    />
  );
}
