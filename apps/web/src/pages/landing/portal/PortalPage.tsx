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
  Sun,
  Wrench,
  Zap,
} from 'lucide-react';
import { LogoLink } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Column } from '@/features/public/FaqSection';
import { FAQ_PREVIEW } from '@/features/public/FaqSection.helpers';
import { DEFAULT_ORDER, fill, items, list, localize, str, useHomeData, type BlockFields, type BlockType, type Item, type Testimonial } from '@/features/site/home-content';
import { env } from '@/lib/env';
import { formatNumber } from '@/lib/format';
import { hhmm, sunState } from '@/lib/sun';
import { t } from '@/i18n';
import { useSmoothScroll } from '../fx/useSmoothScroll';
import { ShaderBackground } from '../fx/ShaderBackground';
import { Marquee } from '../fx/Marquee';
import { Statement } from '../fx/Statement';
import { ScrollFilm } from '../film/ScrollFilm';
import { ButtonAnchor } from '@/components/ui/Button';
import './portal.css';

/** Panel manzili: dev'da alohida port (VITE_DEV_*_URL), production'da shu domendagi yo‘l (TZ 5.2). */
const origin = (url: string) => (/^https?:\/\//.test(url) ? url.replace(/\/$/, '') : '');
/** «Mijoz paneliga o‘tish»: dev’da mijoz panelining ildizi (guest — kalkulyatorga, kirgan — bosh panelga), production’da kalkulyator. */
const CUSTOMER_PANEL = /^https?:/.test(env.customerUrl) ? `${env.customerUrl.replace(/\/$/, '')}/` : '/mijoz/kalkulyator';
/** Kirish va ro‘yxatdan o‘tish — faqat mijoz paneliga (v3.1: bosh sayt faqat mijoz uchun, do‘kon paneli manzili ko‘rsatilmaydi). */
const CUSTOMER_LOGIN = `${origin(env.customerUrl)}/login`;
const CUSTOMER_REGISTER = `${origin(env.customerUrl)}/register`;

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
        <a href="#ishonch">{t('Ishonch')}</a>
      </nav>
      <div className="qs-portal__tools">
        <ThemeToggle />
        <LanguageSwitcher />
        <ButtonAnchor variant="secondary" size="sm" className="qs-portal__login" href={CUSTOMER_LOGIN}>
          {t('Kirish')}
        </ButtonAnchor>
        <ButtonAnchor variant="primary" size="sm" href={CUSTOMER_REGISTER}>
          {t('Ro‘yxatdan o‘tish')}
        </ButtonAnchor>
      </div>
    </header>
  );
}

function Hero({ f }: F) {
  const chips = list(f, 'chips', [t('Kalkulyator'), t('Do‘konlar xaritasi'), t('Narx takliflari'), t('Montaj kafolati')]);
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
        <ButtonAnchor href={CUSTOMER_PANEL} variant="accent" size="lg" rightIcon={<ArrowRight />}>
          {str(f, 'ctaPrimary', t('Mijoz paneliga o‘tish'))}
        </ButtonAnchor>
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
          <ButtonAnchor href={CUSTOMER_PANEL} variant="accent" size="lg" rightIcon={<ArrowRight />}>{str(f, 'ctaPrimary', t('Mijoz paneliga o‘tish'))}</ButtonAnchor>
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
        <Link to="/shartlar">{t('Foydalanish shartlari')}</Link>
        <Link to="/maxfiylik">{t('Maxfiylik siyosati')}</Link>
      </nav>
      {(env.support.phone || env.support.email) && (
        <p className="qs-portal__partner">
          {t('Hamkorlik uchun aloqa')}:{' '}
          {env.support.phone && <a href={`tel:${env.support.phone.replace(/\s+/g, '')}`}>{env.support.phone}</a>}
          {env.support.phone && env.support.email && ' · '}
          {env.support.email && <a href={`mailto:${env.support.email}`}>{env.support.email}</a>}
        </p>
      )}
      <small className="qs-portal__esri">
        <ShieldCheck size={12} aria-hidden="true" /> {t('Xarita ma’lumotlari:')}{' '}
        <a href="https://www.esri.com" target="_blank" rel="noreferrer">Powered by Esri</a> · © {new Date().getFullYear()} Quyosh.uz
      </small>
    </footer>
  );
}

/**
 * Bosh sayt (TZ U7.1, 5.6): faqat mijoz uchun, funksional qism yo‘q — tushuntirish va mijoz paneliga yo‘naltirish. Fotosurat/video ishlatilmaydi.
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
      case 'HOW_IT_WORKS': return <HowItWorks key={type} f={f} />;
      case 'TRUST': return <Trust key={type} f={f} />;
      case 'TESTIMONIALS': return <Testimonials key={type} f={f} reviews={home.data?.testimonials} />;
      case 'FAQ': return <Faq key={type} f={f} />;
      default: return null;
    }
  };
  const heroCta = str(fields('HERO'), 'ctaPrimary', t('Mijoz paneliga o‘tish'));
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
        <ScrollFilm hero={<Hero f={fields('HERO')} />} finalCta={<div className="gm-film__cta"><ButtonAnchor href={CUSTOMER_PANEL} variant="accent" size="lg" rightIcon={<ArrowRight />}>{heroCta}</ButtonAnchor></div>} />
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
