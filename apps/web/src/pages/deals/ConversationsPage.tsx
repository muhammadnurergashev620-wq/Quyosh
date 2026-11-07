import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { kw, SYSTEM_TYPE, sum } from '@/features/calc/labels';
import { ChatPanel } from '@/features/deals/components/ChatPanel';
import { dealsService } from '@/features/deals/deals.service';
import { num, QUOTE_STATUS, SHOP_REPLY_STATUS } from '@/features/deals/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import { StatusBadge } from '@/components/ui/StatusBadge';

/** U9.3 (mijoz): chapda suhbatlar, o‘ngda chat. Mobilda alohida ekranlar. */
export function CustomerConversationsPage() {
  const { rsId } = useParams();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['conversations'], queryFn: dealsService.conversations, refetchInterval: 15_000 });
  const active = useQuery({ queryKey: ['conversation', rsId], queryFn: () => dealsService.conversation(rsId!), enabled: !!rsId, refetchInterval: 20_000 });
  const onActivity = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['conversation', rsId] });
  }, [queryClient, rsId]);
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const conv = active.data?.side === 'CUSTOMER' ? active.data : null;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Chat')}</h1><p>{t('Do‘konlar bilan yozishmalar. Kontakt ochilmaguncha ham yozishish mumkin.')}</p></div></div>
      {!list.data?.length ? (
        <EmptyState icon={<MessageCircle size={30} />} title={t('Hali yozishma yo‘q')} description={t('Taklif so‘rovi yuborganingizdan keyin do‘konlar bilan shu yerda yozishasiz.')} action={<Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/sorovlar?yangi=1">{t('Taklif so‘rash')}</Link>} />
      ) : (
        <div className={cx('qs-chat-layout', rsId && 'has-active')}>
          <nav className="qs-convos" aria-label={t('Suhbatlar')}>
            {list.data.map((c) => (
              <Link key={c.id} to={`/mijoz/chat/${c.id}`} className={cx(c.id === rsId && 'is-active')} aria-current={c.id === rsId ? 'page' : undefined}>
                <strong>{c.shop.name}</strong>
                {c.unread > 0 ? <span className="qs-unread">{c.unread}</span> : <small style={{ gridColumn: 'auto' }}>{c.last ? formatRelativeTime(c.last.createdAt) : ''}</small>}
                <small>№{c.request.number} · {c.last ? (c.last.body || t('Fayl')) : SHOP_REPLY_STATUS[c.status].label}</small>
              </Link>
            ))}
          </nav>
          {rsId ? (
            conv ? (
              <ChatPanel
                rsId={conv.id}
                side="CUSTOMER"
                visits={conv.siteVisits}
                onActivity={onActivity}
                canWrite={!['NOT_SELECTED', 'DECLINED'].includes(conv.status) || conv.request.status === 'OPEN'}
                context={
                  <>
                    <Link to="/mijoz/chat" className="qs-hide-desktop" aria-label={t('Orqaga')}><ArrowLeft size={16} /></Link>
                    <strong>{conv.shop.name}</strong>
                    <span>{SYSTEM_TYPE[conv.request.systemType].title}{conv.request.requiredCapacityKw ? ` · ${kw(num(conv.request.requiredCapacityKw))}` : ''}</span>
                    <StatusBadge map={SHOP_REPLY_STATUS} status={conv.status} />
                    {conv.quote && <Link to={`/mijoz/takliflar/${conv.quote.id}`}>{t('Taklifni ko‘rish')} · {sum(num(conv.quote.total))} <StatusBadge map={QUOTE_STATUS} status={conv.quote.status} /></Link>}
                    <Link to={`/mijoz/sorovlar/${conv.request.id}`}>{t('So‘rov №{n}', { n: conv.request.number })}</Link>
                  </>
                }
              />
            ) : active.isError ? <Alert tone="danger">{getErrorMessage(active.error)}</Alert> : <PageLoader />
          ) : (
            <div className="qs-card qs-hide-mobile"><p className="qs-muted">{t('Chap tomondan suhbatni tanlang.')}</p></div>
          )}
        </div>
      )}
    </div>
  );
}
