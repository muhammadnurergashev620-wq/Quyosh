import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquareQuote, Send, Star } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Stars } from '@/features/deals/components/QuoteDetails';
import { dealsService } from '@/features/deals/deals.service';
import { num } from '@/features/deals/labels';
import { useCurrentShop } from '@/features/shop/current-shop';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate, formatRating } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/deals/deals.css';
import { Tab, TabBar } from '@/components/ui/Tabs';

/** U11.11: sharhlar — yangi/javobsiz filtri, reyting taqsimoti, bitta ommaviy javob. */
export function ShopReviewsPage() {
  const { shopId, shop, can } = useCurrentShop();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['shop-reviews', shopId], queryFn: () => dealsService.shopReviews(shopId!), enabled: !!shopId });
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const reply = useMutation({ mutationFn: (id: string) => dealsService.replyReview(shopId!, id, drafts[id]!.trim()), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shop-reviews', shopId] }) });
  if (!shopId || list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const rows = (list.data ?? []).filter((r) => filter === 'all' || !r.reply);
  const total = list.data?.length ?? 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: (list.data ?? []).filter((r) => r.rating === n).length }));
  const avg = total ? (list.data ?? []).reduce((s, r) => s + r.rating, 0) / total : 0;
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Sharhlar')}</h1><p>{t('Faqat tasdiqlangan montajlardan keyingi sharhlar. Moderatsiyadagilar bu yerda ko‘rinmaydi.')}</p></div></div>
      <div className="qs-grid-3">
        <div className="qs-card"><h2>{t('Reyting')}</h2><p className="qs-quote-card__total" style={{ margin: 0 }}>{formatRating(avg)} <Star size={20} fill="currentColor" color="var(--qs-color-accent)" /></p><small className="qs-muted">{t('{n} ta tasdiqlangan montaj asosida', { n: total })}</small></div>
        <div className="qs-card" style={{ gridColumn: 'span 2' }}>
          <h2>{t('Taqsimot')}</h2>
          {dist.map((d) => (
            <div key={d.n} className="qs-progress" style={{ marginBottom: 4 }}>
              <span className="qs-num" style={{ width: 28 }}>{d.n}★</span>
              <div className="qs-progress__bar"><span style={{ width: `${total ? (d.c / total) * 100 : 0}%`, background: 'var(--qs-color-accent)' }} /></div>
              <span className="qs-num" style={{ width: 28, textAlign: 'right' }}>{d.c}</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar variant="tabs" role="tablist">
        <Tab role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')} selected={filter === 'all'}>{t('Barchasi')}</Tab>
        <Tab role="tab" aria-selected={filter === 'unanswered'} onClick={() => setFilter('unanswered')} selected={filter === 'unanswered'}>{t('Javobsiz')}</Tab>
      </TabBar>
      {!rows.length ? (
        <EmptyState icon={<MessageSquareQuote size={30} />} title={t('Sharh yo‘q')} description={t('Montaj qabul qilingach, mijoz sharh qoldirishi mumkin.')} />
      ) : (
        <div className="qs-card">
          {rows.map((r) => (
            <div key={r.id} className="qs-review">
              <div className="qs-page__actions"><Stars value={r.rating} /><strong>{r.user.firstName ?? t('Mijoz')}</strong><small className="qs-muted">{formatDate(r.createdAt)}</small></div>
              {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
              {r.reply ? (
                <div className="qs-review__reply"><strong>{shop?.name}:</strong> {r.reply.body}</div>
              ) : can('reviews.reply') ? (
                <div className="qs-form">
                  <Textarea label={t('Ommaviy javob')} value={drafts[r.id] ?? ''} maxLength={2000} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))} />
                  <div className="qs-form__actions"><Button size="sm" disabled={!(drafts[r.id] ?? '').trim()} loading={reply.isPending && reply.variables === r.id} onClick={() => reply.mutate(r.id)}><Send size={14} /> {t('Javob berish')}</Button></div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {reply.isError && <Alert tone="danger">{getErrorMessage(reply.error)}</Alert>}
    </div>
  );
}

/** Sevimlilar (U10, TZ 7.7): do‘konlar va mahsulotlar. */
export function FavoritesPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['favorites'], queryFn: dealsService.favorites });
  const remove = useMutation({ mutationFn: (target: { shopId?: string; productModelId?: string }) => dealsService.removeFavorite(target), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }) });
  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const shops = (list.data ?? []).filter((f) => f.shop);
  const products = (list.data ?? []).filter((f) => f.productModel);
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Sevimlilar')}</h1><p>{t('Saqlangan do‘konlar va mahsulotlar.')}</p></div></div>
      {!list.data?.length ? (
        <EmptyState icon={<Heart size={30} />} title={t('Hali hech narsa saqlanmagan')} description={t('Do‘kon yoki mahsulot sahifasida yurakcha tugmasini bosing.')} action={<Link className="gm-button gm-button--primary gm-button--md" to="/mijoz/dokonlar">{t('Do‘konlar')}</Link>} />
      ) : (
        <div className="qs-grid-2">
          <div className="qs-card">
            <h2>{t('Do‘konlar')}</h2>
            {!shops.length && <p className="qs-muted">—</p>}
            {shops.map((f) => (
              <div key={f.id} className="qs-pick">
                <div><Link to={`/mijoz/dokonlar/${f.shop!.slug}`}><strong>{f.shop!.name}</strong></Link><small><Star size={12} /> {formatRating(f.shop!.ratingAvg)} ({f.shop!.ratingCount})</small></div>
                <div className="qs-page__actions">
                  <Link className="gm-button gm-button--secondary gm-button--sm" to={`/mijoz/sorovlar?yangi=1&dokon=${f.shop!.id}`}>{t('Taklif so‘rash')}</Link>
                  <Button size="sm" variant="ghost" aria-label={t('Sevimlilardan olib tashlash')} onClick={() => remove.mutate({ shopId: f.shop!.id })}><Heart size={15} fill="currentColor" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="qs-card">
            <h2>{t('Mahsulotlar')}</h2>
            {!products.length && <p className="qs-muted">—</p>}
            {products.map((f) => (
              <div key={f.id} className="qs-pick">
                <div><Link to={`/mijoz/mahsulotlar/${f.productModel!.slug}`}><strong>{f.productModel!.brand} {f.productModel!.model}</strong></Link>{f.productModel!.nominalPowerW && <small>{f.productModel!.nominalPowerW} W</small>}</div>
                <Button size="sm" variant="ghost" aria-label={t('Sevimlilardan olib tashlash')} onClick={() => remove.mutate({ productModelId: f.productModel!.id })}><Heart size={15} fill="currentColor" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sevimli tugmasi (do‘kon profili, mahsulot sahifasi). */
export function FavoriteButton({ shopId, productModelId }: { shopId?: string; productModelId?: string }) {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['favorites'], queryFn: dealsService.favorites, retry: false });
  const on = !!list.data?.some((f) => (shopId ? f.shop?.id === shopId : f.productModel?.id === productModelId));
  const toggle = useMutation({
    mutationFn: () => (on ? dealsService.removeFavorite({ shopId, productModelId }) : dealsService.addFavorite({ shopId, productModelId })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
  if (list.isError) return null;
  return (
    <Button variant="secondary" aria-pressed={on} loading={toggle.isPending} onClick={() => toggle.mutate()}>
      <Heart size={16} fill={on ? 'currentColor' : 'none'} /> {on ? t('Sevimlilarda') : t('Sevimlilarga')}
    </Button>
  );
}

/** Do‘kon profilida ommaviy sharhlar (TZ 13.4: "N ta tasdiqlangan montaj asosida"). */
export function PublicShopReviews({ slug, shopName }: { slug: string; shopName: string }) {
  const data = useQuery({ queryKey: ['public-reviews', slug], queryFn: () => dealsService.publicReviews(slug) });
  if (!data.data || !data.data.ratingCount) return null;
  const d = data.data;
  return (
    <section className="qs-card">
      <header><h2>{t('Sharhlar')}</h2><span className="qs-muted">{formatRating(d.ratingAvg)} ★ · {t('{n} ta tasdiqlangan montaj asosida', { n: d.ratingCount })}</span></header>
      {d.items.map((r) => (
        <div key={r.id} className="qs-review">
          <div className="qs-page__actions"><Stars value={r.rating} /><strong>{r.author ?? t('Mijoz')}</strong><small className="qs-muted">{formatDate(r.createdAt)}{r.systemPowerKw ? ` · ${num(r.systemPowerKw)} ${t('kVt')}` : ''}</small></div>
          {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
          {r.reply && <div className="qs-review__reply"><strong>{shopName}:</strong> {r.reply.body}</div>}
        </div>
      ))}
    </section>
  );
}
