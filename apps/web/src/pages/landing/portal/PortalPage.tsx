import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { track } from '@/features/m7/track';
import {
  ArrowRight,
  BadgeCheck,
  Battery,
  Calculator,
  Database,
  Droplets,
  Home,
  Lamp,
  Lock,
  MapPin,
  Receipt,
  ShieldCheck,
  Star,
  Store,
  Sun,
  Wrench,
  Zap,
} from 'lucide-react';
import { LogoLink } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Column, FAQ_PREVIEW } from '@/features/public/FaqSection';
import { DEFAULT_ORDER, fill, items, list, localize, str, useHomeData, type BlockFields, type BlockType, type Item, type Testimonial } from '@/features/site/home-content';
import { env } from '@/lib/env';
import { formatNumber } from '@/lib/utils';
import { hhmm, sunState } from '@/lib/sun';
import { t } from '@/i18n';
import { useSmoothScroll } from '../fx/useSmoothScroll';
import { ShaderBackground } from '../fx/ShaderBackground';
import { Marquee } from '../fx/Marquee';
import { Statement } from '../fx/Statement';
import { ScrollFilm } from '../film/ScrollFilm';
import './portal.css';

/** Panel manzili: dev'da alohida port (VITE_DEV_*_URL), production'da shu domendagi yo‘l (TZ 5.2). */
const origin = (url: string) => (/^https?:\/\//.test(url) ? url.replace(/\/$/, '') : '');
const CUSTOMER_CALC = `${origin(env.customerUrl)}/mijoz/kalkulyator`;
const SHOP_PANEL = `${origin(env.shopUrl)}/dokon`;

interface PublicStats {
  verifiedShops: number;
  calculations: number;
  confirmedInstallations: number;
}

/** Hero ostidagi jonli qator (U1.3): Toshkent vaqti bo‘yicha quyosh holati. */
function sunLine(): string {
  const s = sunState();
  if (s.period === 'NIGHT') return t('Quyosh ertaga {time} da chiqadi', { time: hhmm(s.sunrise) });
  if (s.period === 'DAWN') return t('Toshkentda quyosh {time} da chiqdi', { time: hhmm(s.sunrise) });
  if (s.period === 'DUSK') return t('Quyosh {time} da botadi', { time: hhmm(s.sunset) });
  const h = Math.floor(s.daylight / 60);
  const m = Math.round(s.daylight % 60);
  return t('Bugun {h} soat {m} daqiqa quyosh', { h, m });
}

const SERVICES = [
  { icon: Zap, name: t('Tarmoqqa ulangan') },
  { icon: Battery, name: t('Gibrid') },
  { icon: Sun, name: t('Avtonom') },
  { icon: Battery, name: t('Akkumulyator') },
  { icon: Droplets, name: t('Suv isitgich') },
  { icon: Lamp, name: t('Ko‘cha chirog‘i') },
];

const JOURNEY_ICONS = [MapPin, Home, Zap, Calculator, Receipt, Wrench];
const TRUST_ICONS = [BadgeCheck, Star, Database, Lock];

const JOURNEY = (): Item[] => [
  { title: t('Manzil'), text: t('Manzilni qidiring yoki xaritada pin qo‘ying.') },
  { title: t('Maydon'), text: t('Tomni sun’iy yo‘ldosh rasmi ustida chizing yoki taxminiy hajmni tanlang.') },
  { title: t('Sarf'), text: t('Oylik kWh, to‘lov summasi yoki maishiy texnika ro‘yxati.') },
  { title: t('Natija'), text: t('Quvvat, oylik tejash, narx va o‘zini oqlash — diapazon bilan.') },
  { title: t('Takliflar'), text: t('1–5 ta do‘kondan narx taklifi oling va solishtiring.') },
  { title: t('Montaj'), text: t('Montajni kuzating va chek-list bilan qabul qiling.') },
];

const TRUST = (): Item[] => [
  { title: t('Tasdiqlangan do‘konlar'), text: t('Hujjatlari platforma tomonidan tekshirilgan; rasmiy diler va sertifikat belgilari muddati bilan.') },
  { title: t('Faqat montajdan keyingi sharhlar'), text: t('Sharhni montaji tasdiqlangan mijoz yozadi; shubhali sharhlar moderatsiyadan o‘tadi.') },
  { title: t('Ochiq ma’lumot manbalari'), text: t('PVGIS quyosh ma’lumoti, manbasi va sanasi ko‘rsatilgan tariflar — hisob qanday qilingani doim ochiq.') },
  { title: t('Ma’lumotlar O‘zbekistonda'), text: t('Shaxsiy ma’lumotlar O‘zbekiston hududidagi serverlarda saqlanadi.') },
];

/** Blok maydonlari (joriy tilda) yoki null — null bo‘lsa komponent o‘zining standart matnini ishlatadi. */
type F = { f: BlockFields | null };

function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const film = document.querySelector<HTMLElement>('.gm-film');
    // A15: film tugagach (yoki 80 px dan keyin, film bo‘lmasa) header qattiq fonga o‘tadi.
    const onScroll = () => setSolid(window.scrollY > (film ? film.offsetHeight - window.innerHeight : 80));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={solid ? 'qs-portal__header is-solid' : 'qs-portal__header'}>
      <LogoLink />
      <nav aria-label={t('Bo‘limlar')}>
        <a href="#qanday">{t('Qanday ishlaydi')}</a>
        <a href="#mijozlar">{t('Mijozlar uchun')}</a>
        <a href="#dokonlar">{t('Do‘konlar uchun')}</a>
        <a href="#ishonch">{t('Ishonch')}</a>
      </nav>
      <div className="qs-portal__tools">
        <ThemeToggle />
        <LanguageSwitcher />
        <a className="gm-button gm-button--secondary gm-button--sm qs-portal__login" href={SHOP_PANEL}>
          {t('Do‘kon uchun kirish')}
        </a>
        <a className="gm-button gm-button--primary gm-button--sm" href={CUSTOMER_CALC}>
          {t('Hisoblab ko‘rish')}
        </a>
      </div>
    </header>
  );
}

function Hero({ f }: F) {
  const chips = list(f, 'chips', [t('Kalkulyator'), t('Do‘konlar xaritasi'), t('Narx takliflari'), t('Montaj kafolati')]);
  const secondary = str(f, 'ctaSecondary', f ? '' : t('Men do‘kon egasiman'));
  const titleB = str(f, 'titleB', f ? '' : t('pul ishlab chiqaradi'));
  return (
    <>
      <p className="gm-film__label">{str(f, 'label', t('Quyosh energiyasi · O‘zbekiston'))}</p>
      <h1>
        <span>{str(f, 'titleA', t('Tomingiz quyoshdan'))}</span>{titleB && <> <em>{titleB}</em></>}
      </h1>
      <p className="gm-film__text">
        {str(f, 'text', t('Manzilingizni belgilang — nechta panel sig‘ishi, oyiga qancha tejashingiz va qaysi tasdiqlangan do‘konlar o‘rnatib berishini ko‘rasiz.'))}
      </p>
      {chips.length > 0 && (
        <ul className="gm-film__chips" aria-label={t('Imkoniyatlar')}>
          {chips.map((chip) => <li key={chip}>{chip}</li>)}
        </ul>
      )}
      <div className="gm-film__cta">
        <a href={CUSTOMER_CALC} className="gm-button gm-button--primary gm-button--md">
          {str(f, 'ctaPrimary', t('Hisoblab ko‘rish'))} <ArrowRight size={16} aria-hidden="true" />
        </a>
        {secondary && (
          <a href={SHOP_PANEL} className="gm-button gm-button--secondary gm-button--md">
            {secondary}
          </a>
        )}
      </div>
      <p className="gm-film__sunline">{sunLine()}</p>
    </>
  );
}

function Stats({ f, stats }: F & { stats: PublicStats | null | undefined }) {
  // Ma’lumot kelmasa blok yashiriladi (U7.1.1, 3-bo‘lim); raqamlar qo‘lda yozilmaydi.
  if (!stats || stats.verifiedShops + stats.calculations + stats.confirmedInstallations === 0) return null;
  const items = [
    { value: stats.verifiedShops, label: t('Tasdiqlangan do‘konlar') },
    { value: stats.calculations, label: t('Bajarilgan hisoblar') },
    { value: stats.confirmedInstallations, label: t('Tasdiqlangan montajlar') },
  ];
  return (
    <section className="qs-portal__stats" aria-label={str(f, 'title', t('Platforma raqamlarda'))}>
      {items.map((item) => (
        <div key={item.label}>
          <strong>{formatNumber(item.value)}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </section>
  );
}

function Paths({ f }: F) {
  const customerPoints = list(f, 'customerPoints', [t('3 daqiqada dastlabki hisob — ro‘yxatdan o‘tmasdan'), t('Naqd va kredit variantlarini solishtirish'), t('Bir nechta do‘kondan narx taklifi')]);
  const shopPoints = list(f, 'shopPoints', [t('Tayyor hisobli so‘rovlar: tizim parametrlari va iste’mol bilan'), t('Katalog, filiallar va xizmat hududi bir joyda'), t('Tasdiqlangan do‘kon belgisi va montajdan keyingi sharhlar')]);
  return (
    <section className="qs-portal__paths">
      <article id="mijozlar" className="qs-path">
        <span className="qs-path__icon" aria-hidden="true"><Sun size={26} /></span>
        <h2>{str(f, 'customerTitle', t('Men mijozman'))}</h2>
        <ul>{customerPoints.map((point) => <li key={point}>{point}</li>)}</ul>
        <a href={CUSTOMER_CALC} className="gm-button gm-button--primary gm-button--md">{str(f, 'customerCta', t('Hisoblab ko‘rish'))} <ArrowRight size={16} aria-hidden="true" /></a>
      </article>
      <article id="dokonlar" className="qs-path qs-path--shop">
        <span className="qs-path__icon" aria-hidden="true"><Store size={26} /></span>
        <h2>{str(f, 'shopTitle', t('Men do‘kon egasiman'))}</h2>
        <ul>{shopPoints.map((point) => <li key={point}>{point}</li>)}</ul>
        <a href={SHOP_PANEL} className="gm-button gm-button--secondary gm-button--md">{str(f, 'shopCta', t('Do‘kon ochish'))} <ArrowRight size={16} aria-hidden="true" /></a>
      </article>
    </section>
  );
}

function HowItWorks({ f }: F) {
  return (
    <section className="qs-portal__how" id="qanday">
      <p className="qs-eyebrow">{str(f, 'eyebrow', t('Qanday ishlaydi'))}</p>
      <h2>{str(f, 'title', t('Manzildan montajgacha — olti qadam'))}</h2>
      <ol>
        {items(f, 'items', JOURNEY()).map((step, i) => {
          const Icon = JOURNEY_ICONS[i % JOURNEY_ICONS.length]!;
          return (
          <li key={i}>
            <span className="qs-how__num">{String(i + 1).padStart(2, '0')}</span>
            <Icon size={22} aria-hidden="true" />
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </li>
          );
        })}
      </ol>
    </section>
  );
}

function Trust({ f }: F) {
  return (
    <section className="qs-portal__trust" id="ishonch">
      <p className="qs-eyebrow">{str(f, 'eyebrow', t('Ishonch'))}</p>
      <h2>{str(f, 'title', t('Nimaga ishonsa bo‘ladi'))}</h2>
      <div className="qs-trust__grid">
        {items(f, 'items', TRUST()).map((item, i) => {
          const Icon = TRUST_ICONS[i % TRUST_ICONS.length]!;
          return (
            <article key={i}>
              <Icon size={22} aria-hidden="true" />
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Mijozlar sharhlari: faqat moderatsiyadan o‘tgan (PUBLISHED) sharhlar; yo‘q bo‘lsa blok chiqmaydi. */
function Testimonials({ f, reviews }: F & { reviews: Testimonial[] | undefined }) {
  if (!reviews?.length) return null;
  return (
    <section className="qs-portal__trust qs-portal__reviews" id="sharhlar">
      <p className="qs-eyebrow">{str(f, 'eyebrow', t('Sharhlar'))}</p>
      <h2>{str(f, 'title', t('Montajdan keyin mijozlar nima deydi'))}</h2>
      <div className="qs-trust__grid">
        {reviews.map((r) => (
          <article key={r.id}>
            <span className="qs-reviews__stars" aria-label={t('{n} yulduz', { n: r.rating })}>{'★'.repeat(r.rating)}<i>{'★'.repeat(5 - r.rating)}</i></span>
            <p>«{r.comment}»</p>
            <small>
              {r.author ?? t('Mijoz')} · <a href={`${origin(env.customerUrl)}/mijoz/dokonlar/${r.shop.slug}`}>{r.shop.name}</a>
              {r.systemPowerKw ? ` · ${formatNumber(Number(r.systemPowerKw))} ${t('kVt')}` : ''}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Faq({ f }: F) {
  const custom = f ? items(f, 'items', []) : [];
  const qa = custom.length ? custom.map((x) => ({ q: () => x.title, a: () => x.text })) : FAQ_PREVIEW;
  return (
    <section className="qs-portal__faq" id="savollar">
      <p className="qs-eyebrow">{str(f, 'eyebrow', 'FAQ')}</p>
      <h2>{str(f, 'title', t('Ko‘p beriladigan savollar'))}</h2>
      <div className="gm-faq gm-faq--single">
        <Column items={qa} />
      </div>
    </section>
  );
}

function Finale({ f }: F) {
  const s = sunState();
  const h = Math.floor(s.daylight / 60);
  const m = Math.round(s.daylight % 60);
  return (
    <section className="qs-portal__finale">
      <ShaderBackground variant="brand" />
      <div className="qs-finale__inner">
        <h2>{f ? fill(str(f, 'title', ''), { h, m }) : t('Bugun quyosh {h} soat {m} daqiqa porlaydi. Uning qancha qismi sizniki?', { h, m })}</h2>
        <div className="gm-film__cta">
          <a href={CUSTOMER_CALC} className="gm-button gm-button--primary gm-button--md">{str(f, 'ctaPrimary', t('Hisoblab ko‘rish'))} <ArrowRight size={16} aria-hidden="true" /></a>
          {str(f, 'ctaSecondary', f ? '' : t('Men do‘kon egasiman')) && <a href={SHOP_PANEL} className="gm-button gm-button--secondary gm-button--md">{str(f, 'ctaSecondary', t('Men do‘kon egasiman'))}</a>}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="qs-portal__footer">
      <div>
        <LogoLink />
        <p>{t('Natijalar prognoz. Haqiqiy ishlab chiqarish ob-havo, soya, uskuna va montaj sifatiga bog‘liq.')}</p>
      </div>
      <nav aria-label={t('Pastki menyu')}>
        <a href="#qanday">{t('Qanday ishlaydi')}</a>
        <a href={SHOP_PANEL}>{t('Do‘kon ochish')}</a>
        <Link to="/shartlar">{t('Foydalanish shartlari')}</Link>
        <Link to="/maxfiylik">{t('Maxfiylik siyosati')}</Link>
      </nav>
      <small className="qs-portal__esri">
        <ShieldCheck size={12} aria-hidden="true" /> {t('Xarita ma’lumotlari:')}{' '}
        <a href="https://www.esri.com" target="_blank" rel="noreferrer">Powered by Esri</a> · © {new Date().getFullYear()} Quyosh.uz
      </small>
    </footer>
  );
}

/**
 * Bosh sayt (TZ U7.1, 5.6): funksional qism yo‘q — tushuntirish va panelga yo‘naltirish. Fotosurat/video ishlatilmaydi.
 * Matn, tartib va ko‘rinish admin "Bosh sahifa" bo‘limidan (SiteBlock); API javob bermasa — standart matn.
 * `preview` — admin ko‘rinishi: nashr qilinmagan qoralamalar bilan.
 */
export function PortalPage({ preview = false }: { preview?: boolean }) {
  useSmoothScroll();
  useEffect(() => { if (!preview) track({ eventType: 'home_view' }, 'home'); }, [preview]);
  const home = useHomeData(preview);
  const loaded = home.data?.blocks;
  const order: BlockType[] = loaded ? loaded.map((b) => b.type) : DEFAULT_ORDER;
  const fields = (type: BlockType) => localize(loaded?.find((b) => b.type === type)?.content);
  const shown = (type: BlockType) => order.includes(type);
  const section = (type: BlockType) => {
    const f = fields(type);
    switch (type) {
      case 'STATS': return <Stats key={type} f={f} stats={home.data?.stats} />;
      case 'STATEMENT': return <Statement key={type} label={str(f, 'label', t('Quyosh'))} text={str(f, 'text', t('Quyosh har kuni tomingizga tushadi. Biz faqat uni hisoblaymiz.'))} />;
      case 'PATHS': return <Paths key={type} f={f} />;
      case 'HOW_IT_WORKS': return <HowItWorks key={type} f={f} />;
      case 'TRUST': return <Trust key={type} f={f} />;
      case 'TESTIMONIALS': return <Testimonials key={type} f={f} reviews={home.data?.testimonials} />;
      case 'FAQ': return <Faq key={type} f={f} />;
      default: return null;
    }
  };
  const heroCta = str(fields('HERO'), 'ctaPrimary', t('Hisoblab ko‘rish'));
  return (
    <div className="qs-portal">
      {preview && (
        <div className="qs-portal__preview" role="status">
          {home.isError ? t('Ko‘rinishni yuklab bo‘lmadi') : t('Ko‘rinish: nashr qilinmagan qoralamalar bilan')} · <a href="/admin/bosh-sahifa">{t('Muharrirga qaytish')}</a>
        </div>
      )}
      <Header />
      <main>
        {/* Kino-scroll (HERO) bloklar yuklanguncha ham ko‘rinadi — matn standart, keyin CMS matni. */}
        <ScrollFilm hero={<Hero f={fields('HERO')} />} finalCta={<div className="gm-film__cta"><a href={CUSTOMER_CALC} className="gm-button gm-button--primary gm-button--md">{heroCta} <ArrowRight size={16} aria-hidden="true" /></a></div>} />
        {order.filter((type) => type === 'STATS').map(section)}
        <section className="qs-portal__belt" aria-label={t('Tizim turlari')}>
          <Marquee items={SERVICES} />
        </section>
        {order.filter((type) => !['HERO', 'STATS', 'FINALE'].includes(type)).map(section)}
        {shown('FINALE') && <Finale f={fields('FINALE')} />}
      </main>
      <Footer />
    </div>
  );
}
