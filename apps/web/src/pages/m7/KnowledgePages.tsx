import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Clock, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { m7Service } from '@/features/m7/m7.service';
import { headingsOf, Markdown } from '@/features/m7/Markdown';
import { tr } from '@/features/m7/i18n-text';
import { useSeo } from '@/features/m7/seo';
import { track } from '@/features/m7/track';
import type { ArticleCard, ArticleType, CtaType } from '@/features/m7/types';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/m7/m7.css';
import '@/features/calc/calc.css';
import { safeExternalUrl } from '@/lib/return-to';
import { Tab, TabBar } from '@/components/ui/Tabs';

export const TYPE_LABEL: Record<ArticleType, string> = { GUIDE: t('Qo‘llanma'), ARTICLE: t('Maqola'), FAQ: 'FAQ', VIDEO: t('Video'), GLOSSARY: t('Atama') };
const CTA: Record<Exclude<CtaType, 'NONE'>, { title: string; text: string; to: string; button: string }> = {
  CALCULATOR: { title: t('Tizimingizni hisoblang'), text: t('Manzil va sarfingiz bo‘yicha quvvat, narx va tejash — 1–2 daqiqada.'), to: '/mijoz/kalkulyator', button: t('Kalkulyator') },
  OUTAGE: { title: t('Elektr o‘chganda nima ishlaydi'), text: t('Muhim jihozlar uchun zaxira soatini hisoblang.'), to: '/mijoz/uzilish', button: t('Hisoblash') },
  FINANCING: { title: t('Kredit bilan hisoblang'), text: t('Oylik to‘lov va «cho‘ntakdan» summani ko‘ring.'), to: '/mijoz/kredit', button: t('Kredit kalkulyatori') },
  SHOPS: { title: t('Do‘konlardan taklif oling'), text: t('Hududingizga xizmat ko‘rsatadigan tasdiqlangan do‘konlar.'), to: '/mijoz/dokonlar', button: t('Do‘konlar') },
};

export function ArticleCardView({ a }: { a: ArticleCard }) {
  return (
    <Link className="qs-kcard" to={`/mijoz/bilim/${a.category.slug}/${a.slug}`}>
      <Badge tone="neutral">{TYPE_LABEL[a.articleType]} · {tr(a.category.nameI18n)}</Badge>
      <h3>{tr(a.titleI18n)}</h3>
      <p>{tr(a.summaryI18n)}</p>
      <footer><Clock size={13} /> {t('{n} daq', { n: a.readingMinutes })}</footer>
    </Link>
  );
}

function SearchBox({ initial = '' }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [, setParams] = useSearchParams();
  return (
    <form className="qs-search-hero" role="search" onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); }}>
      <input aria-label={t('Qidirish')} placeholder={t('Masalan: akkumulyator, tarif, tozalash')} value={q} onChange={(e) => setQ(e.target.value)} />
      <Button type="submit"><Search size={16} /> {t('Qidirish')}</Button>
    </form>
  );
}

/** U7.6: bosh sahifa — qidiruv, kategoriyalar, «Boshlovchilar uchun» yo‘li, yangi materiallar. */
export function KnowledgeHomePage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const cats = useQuery({ queryKey: ['k-cats'], queryFn: m7Service.kCategories });
  const beginner = useQuery({ queryKey: ['k-beginner'], queryFn: m7Service.beginner });
  const list = useQuery({ queryKey: ['k-list', q], queryFn: () => m7Service.articles({ q: q || undefined, limit: q ? 30 : 9 }) });
  useSeo({ title: t('Bilimlar markazi'), description: t('Quyosh panellari bo‘yicha qo‘llanmalar, maqolalar, savol-javoblar va atamalar lug‘ati.'), path: '/mijoz/bilim' });
  useEffect(() => track({ eventType: 'knowledge_view' }, 'knowledge-home'), []);
  return (
    <div className="qs-page">
      <div className="qs-page__head"><div><h1>{t('Bilimlar markazi')}</h1><p>{t('Quyosh tizimini tanlash, o‘rnatish va undan foydalanish bo‘yicha tushunarli materiallar.')}</p></div></div>
      <SearchBox initial={q} />
      {q ? (
        <section>
          <h2>{t('«{q}» bo‘yicha natijalar', { q })}</h2>
          {list.isLoading ? <PageLoader /> : !list.data?.items.length ? <EmptyState icon={<Search size={28} />} title={t('Hech narsa topilmadi')} description={t('Boshqa so‘z bilan qidiring yoki yordam markaziga yozing.')} action={<ButtonLink to="/mijoz/yordam">{t('Yordam markazi')}</ButtonLink>} /> : <div className="qs-kcards">{list.data.items.map((a) => <ArticleCardView key={a.id} a={a} />)}</div>}
        </section>
      ) : (
        <>
          <div className="qs-kcats">
            {cats.data?.map((c) => <Link key={c.id} className="qs-kcat" to={`/mijoz/bilim/${c.slug}`}><strong>{tr(c.nameI18n)}</strong><small>{t('{n} ta material', { n: c.count })}</small></Link>)}
          </div>
          {!!beginner.data?.length && (
            <section className="qs-card">
              <h2>{t('Boshlovchilar uchun')}</h2>
              <ol className="qs-path">{beginner.data.map((a) => <li key={a.id}><Link to={`/mijoz/bilim/${a.category.slug}/${a.slug}`}><span><strong>{tr(a.titleI18n)}</strong><br /><small className="qs-muted">{tr(a.summaryI18n)}</small></span></Link></li>)}</ol>
            </section>
          )}
          <section>
            <h2>{t('Yangi materiallar')}</h2>
            {list.isLoading ? <PageLoader /> : <div className="qs-kcards">{list.data?.items.map((a) => <ArticleCardView key={a.id} a={a} />)}</div>}
          </section>
        </>
      )}
      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
    </div>
  );
}

/** Kategoriya ro‘yxati; «atamalar» — alifbo bo‘yicha lug‘at (GLOSSARY). */
export function KnowledgeCategoryPage() {
  const { category = '' } = useParams();
  const [type, setType] = useState<ArticleType | ''>('');
  const cats = useQuery({ queryKey: ['k-cats'], queryFn: m7Service.kCategories });
  const cat = cats.data?.find((c) => c.slug === category);
  const glossaryMode = category === 'atamalar';
  const list = useQuery({ queryKey: ['k-list', category, type], queryFn: () => m7Service.articles({ category, type: type || undefined, limit: 50 }), enabled: !glossaryMode });
  const glossary = useQuery({ queryKey: ['k-glossary'], queryFn: m7Service.glossary, enabled: glossaryMode });
  useSeo(cat ? { title: tr(cat.nameI18n), path: `/mijoz/bilim/${category}` } : null);
  const sortedGlossary = useMemo(() => [...(glossary.data ?? [])].sort((a, b) => tr(a.titleI18n).localeCompare(tr(b.titleI18n))), [glossary.data]);
  return (
    <div className="qs-page">
      <p><Link to="/mijoz/bilim">← {t('Bilimlar markazi')}</Link></p>
      <div className="qs-page__head"><div><h1>{cat ? tr(cat.nameI18n) : t('Bilimlar markazi')}</h1></div></div>
      {glossaryMode ? (
        glossary.isLoading ? <PageLoader /> : (
          <dl className="qs-glossary qs-card">
            {sortedGlossary.map((g) => (
              <div key={g.id} id={g.slug}>
                <dt><Link to={`/mijoz/bilim/${g.category.slug}/${g.slug}`}>{tr(g.titleI18n)}</Link></dt>
                <dd>{tr(g.summaryI18n)}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <>
          <TabBar variant="tabs" role="tablist">
            {(['', 'GUIDE', 'ARTICLE', 'FAQ', 'VIDEO'] as Array<ArticleType | ''>).map((tp) => <Tab key={tp || 'all'} role="tab" aria-selected={type === tp} onClick={() => setType(tp)} selected={type === tp}>{tp ? TYPE_LABEL[tp] : t('Barchasi')}</Tab>)}
          </TabBar>
          {list.isLoading ? <PageLoader /> : !list.data?.items.length ? <EmptyState icon={<BookOpen size={28} />} title={t('Material yo‘q')} /> : <div className="qs-kcards">{list.data.items.map((a) => <ArticleCardView key={a.id} a={a} />)}</div>}
        </>
      )}
    </div>
  );
}

/** U7.6: maqola — 680 px, mundarija (sticky), o‘qish progressi, manbalar, tekshirilgan sana, CTA, tegishli maqolalar. */
export function ArticlePage() {
  const { category = '', slug = '' } = useParams();
  const a = useQuery({ queryKey: ['k-article', slug], queryFn: () => m7Service.article(slug) });
  const [progress, setProgress] = useState(0);
  const [voted, setVoted] = useState<boolean | null>(null);
  const vote = useMutation({ mutationFn: (v: boolean) => m7Service.helpful(slug, v), onSuccess: (_d, v) => setVoted(v) });
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      setProgress(Math.min(100, (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { if (a.data) track({ eventType: 'knowledge_view', entityId: a.data.id }, `k-${a.data.id}`); }, [a.data]);
  const body = a.data ? tr(a.data.bodyI18n) : '';
  const jsonLd = a.data
    ? a.data.articleType === 'FAQ'
      ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: tr(a.data.titleI18n), acceptedAnswer: { '@type': 'Answer', text: body } }] }
      : { '@context': 'https://schema.org', '@type': 'Article', headline: tr(a.data.titleI18n), description: tr(a.data.summaryI18n), datePublished: a.data.publishedAt, dateModified: a.data.verifiedAt ?? a.data.publishedAt, inLanguage: document.documentElement.lang }
    : undefined;
  useSeo(a.data ? { title: tr(a.data.seoTitleI18n) || tr(a.data.titleI18n), description: tr(a.data.seoDescriptionI18n) || tr(a.data.summaryI18n), path: `/mijoz/bilim/${category}/${slug}`, jsonLd } : null);
  if (a.isLoading) return <PageLoader />;
  if (a.isError || !a.data) return <Alert tone="danger">{getErrorMessage(a.error)}</Alert>;
  const art = a.data;
  const toc = headingsOf(body);
  const cta = art.ctaType !== 'NONE' ? CTA[art.ctaType] : null;
  return (
    <div className="qs-page">
      <div className="qs-progress-top" style={{ width: `${progress}%` }} aria-hidden />
      <p><Link to="/mijoz/bilim">{t('Bilimlar markazi')}</Link> / <Link to={`/mijoz/bilim/${art.category.slug}`}>{tr(art.category.nameI18n)}</Link></p>
      <div className="qs-article">
        <nav className="qs-article__toc" aria-label={t('Mundarija')}>
          {toc.length > 1 && <strong>{t('Mundarija')}</strong>}
          {toc.length > 1 && toc.map((h) => <a key={h.id} href={`#${h.id}`} className={cx(h.level === 3 && 'is-sub')}>{h.text}</a>)}
        </nav>
        <article>
          <Badge tone="neutral">{TYPE_LABEL[art.articleType]}</Badge>
          <h1 className="qs-my-2 qs-mx-0">{tr(art.titleI18n)}</h1>
          <div className="qs-article__meta">
            <span><Clock size={13} /> {t('{n} daqiqa o‘qish', { n: art.readingMinutes })}</span>
            {art.verifiedAt && <span>{t('Tekshirilgan: {d}', { d: formatDate(art.verifiedAt) })}</span>}
          </div>
          <p className="qs-muted" style={{ fontSize: 17 }}>{tr(art.summaryI18n)}</p>
          <Markdown source={body} />
          {art.sourceUrls.length > 0 && (
            <div className="qs-sources"><strong>{t('Manbalar')}</strong><ul>{art.sourceUrls.map((u) => <li key={u}>{safeExternalUrl(u) ? <a href={safeExternalUrl(u)} target="_blank" rel="noopener noreferrer">{u}</a> : u}</li>)}</ul></div>
          )}
          {cta && (
            <div className="qs-cta-card qs-mt-5">
              <h3>{cta.title}</h3><p>{cta.text}</p>
              <ButtonLink to={cta.to} onClick={() => track({ eventType: 'cta_click', entityId: art.id, properties: { cta: art.ctaType } })}>{cta.button} <ArrowRight size={16} /></ButtonLink>
            </div>
          )}
          <div className="qs-page__actions qs-mt-5">
            {voted === null ? (
              <>
                <span>{t('Bu material yordam berdimi?')}</span>
                <Button size="sm" variant="secondary" onClick={() => vote.mutate(true)}><ThumbsUp size={14} /> {t('Ha')}</Button>
                <Button size="sm" variant="secondary" onClick={() => vote.mutate(false)}><ThumbsDown size={14} /> {t('Yo‘q')}</Button>
              </>
            ) : voted ? <span>{t('Rahmat!')}</span> : <span>{t('Rahmat. Savolingiz qolgan bo‘lsa —')} <Link to="/mijoz/yordam">{t('yordam markaziga yozing')}</Link>.</span>}
          </div>
          {art.related.length > 0 && (
            <section className="qs-mt-6">
              <h2>{t('Tegishli materiallar')}</h2>
              <div className="qs-kcards">{art.related.map((r) => <ArticleCardView key={r.id} a={r} />)}</div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
