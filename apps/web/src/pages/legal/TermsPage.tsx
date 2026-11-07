import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FileText, Lock, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoLink } from '@/components/common/Logo';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/format';
import { usePolicies, usePolicy } from '@/features/legal/hooks/useLegal';
import { POLICY_TYPE_LABEL } from '@/features/legal/types';
import type { PolicyType } from '@/features/legal/types';
import { renderContent } from '@/features/legal/render-content';
import './TermsPage.css';
import { t } from '@/i18n';

const ICONS: Partial<Record<PolicyType, LucideIcon>> = { TERMS: FileText, PRIVACY: Lock, PLATFORM_RULES: ScrollText };

function PolicyBody({ id, fallback }: { id: string; fallback?: string }) {
  const detail = usePolicy(id);
  if (detail.isLoading) return <PageLoader />;
  if (detail.isError) return <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>;
  return <div className="gm-terms__prose">{renderContent(detail.data?.content ?? fallback ?? 'Matn mavjud emas.')}</div>;
}

/** Hammaga ochiq sahifa: kirmasdan ham foydalanish shartlari va siyosatlarni o‘qish mumkin. */
export function TermsPage() {
  const policies = usePolicies();
  const navigate = useNavigate();
  const location = useLocation();
  // Oldingi oynaga qaytadi; sahifa to‘g‘ridan-to‘g‘ri ochilgan bo‘lsa (tarix yo‘q) — bosh sahifaga.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/', { replace: true }));
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const items = (policies.data ?? []).filter((policy) => policy.status === 'PUBLISHED');
  // Birinchi hujjat dastlab ochiq turadi.
  const current = openId === undefined ? (items[0]?.id ?? null) : openId;

  return (
    <div className="gm-terms">
      <header className="gm-terms__bar">
        <button type="button" className="gm-terms__back" onClick={goBack}>
          <ArrowLeft size={18} aria-hidden="true" />{' '}{t('Orqaga')}</button>
        <LogoLink />
      </header>

      <main className="gm-terms__main">
        <section className="gm-terms__hero">
          <span className="gm-terms__hero-icon" aria-hidden="true">
            <ScrollText size={26} />
          </span>
          <h1>{t('Foydalanish shartlari va siyosatlar')}</h1>
          <p className="gm-terms__lead">{t('Ro‘yxatdan o‘tishdan oldin hujjatlar bilan tanishib chiqing. Ularni kirmasdan ham o‘qish mumkin.')}</p>
          {items.length > 0 && <span className="gm-terms__count">{items.length}{' '}{t('ta hujjat')}</span>}
        </section>

        {policies.isLoading && <PageLoader label={t('Hujjatlar yuklanmoqda…')} />}
        {policies.isError && <Alert tone="danger">{getErrorMessage(policies.error)}</Alert>}
        {!policies.isLoading && !policies.isError && items.length === 0 && <EmptyState title={t('Hozircha hujjatlar e’lon qilinmagan')} />}

        <ul className="gm-terms__list">
          {items.map((policy) => {
            const open = current === policy.id;
            const Icon = ICONS[policy.type] ?? FileText;
            return (
              <li key={policy.id} className={open ? 'gm-terms__item gm-terms__item--open' : 'gm-terms__item'}>
                <button type="button" className="gm-terms__head" aria-expanded={open} onClick={() => setOpenId(open ? null : policy.id)}>
                  <span className="gm-terms__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="gm-terms__title">
                    <strong>{policy.title}</strong>
                    <span className="gm-terms__chips">
                      <span>{POLICY_TYPE_LABEL[policy.type]}</span>
                      <span>v{policy.version}</span>
                      {policy.publishedAt && <span>{formatDate(policy.publishedAt)}</span>}
                    </span>
                  </span>
                  <ChevronDown size={20} className="gm-terms__chevron" aria-hidden="true" />
                </button>
                {open && (
                  <div className="gm-terms__body">
                    <PolicyBody id={policy.id} fallback={policy.content} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <footer className="gm-terms__foot">
          <p>{t('© {getFullYear} Quyosh. Savollar bo‘lsa, ilovadagi «Shikoyatlar» bo‘limi orqali murojaat qiling.', { getFullYear: new Date().getFullYear() })}</p>
        </footer>
      </main>
    </div>
  );
}
