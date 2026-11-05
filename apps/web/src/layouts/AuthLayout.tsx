import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { BadgeCheck, Camera, ShieldCheck, Sparkles, Star, Wallet, ClipboardCheck, BarChart3, Lock, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ShaderBackground } from '@/pages/landing/fx/ShaderBackground';
import { Logo, SunMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { currentPanelLabel } from '@/lib/panel';
import type { Role } from '@/types/common';
import { t } from '@/i18n';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import '@/features/auth/auth.css';
import './AuthLayout.css';

interface Pitch {
  tagline: string;
  tiles: Array<{ icon: LucideIcon; text: string }>;
  title: string;
  text: string;
  points: Array<{ icon: LucideIcon; text: string }>;
}

const PITCH: Record<Role, Pitch> = {
  CUSTOMER: {
    tagline: t('Tomingiz uchun hisob, tasdiqlangan do‘konlar va narx takliflari — bir joyda'),
    tiles: [
      { icon: BadgeCheck, text: t('Tasdiqlangan do‘konlar') },
      { icon: Camera, text: t('Diapazonli hisob') },
      { icon: ShieldCheck, text: t('Montaj qabul chek-listi') },
    ],
    title: t('Tomingiz quyoshdan pul ishlab chiqaradi'),
    text: t('Manzilingizni belgilang — nechta panel sig‘ishi, oyiga qancha tejash va qaysi do‘konlar o‘rnatib berishini ko‘ring.'),
    points: [
      { icon: BadgeCheck, text: t('Hujjat bilan tasdiqlangan do‘konlar') },
      { icon: Camera, text: t('Past, standart va yuqori diapazon') },
      { icon: ShieldCheck, text: t('Montajni chek-list bilan qabul qiling') },
    ],
  },
  SHOP: {
    tagline: t('So‘rovlar o‘zi keladi — siz faqat o‘rnatasiz'),
    tiles: [
      { icon: ClipboardCheck, text: t('Tayyor hisobli so‘rovlar') },
      { icon: BadgeCheck, text: t('Tasdiqlangan do‘kon belgisi') },
      { icon: Star, text: t('Faqat montajdan keyingi sharhlar') },
    ],
    title: t('So‘rovlar o‘zi keladi — siz faqat o‘rnatasiz'),
    text: t('Hisobini qilgan mijozlar tayyor parametrlar bilan narx so‘raydi. Taklif yuboring, montajni kuzating, reyting yig‘ing.'),
    points: [
      { icon: ClipboardCheck, text: t('Platforma tasdiqlagan do‘kon belgisi') },
      { icon: Wallet, text: t('Tayyor hisobli so‘rovlar') },
      { icon: Star, text: t('Faqat montajdan keyingi sharhlar') },
    ],
  },
  ADMIN: {
    tagline: t('Platformani boshqarish paneli'),
    tiles: [
      { icon: BarChart3, text: t('Hisobotlar') },
      { icon: BadgeCheck, text: t('Tasdiqlash') },
      { icon: ScrollText, text: t('Audit') },
    ],
    title: t('Platformani boshqarish paneli'),
    text: t('Faqat vakolatli xodimlar uchun. Har bir harakat audit jurnaliga yoziladi.'),
    points: [
      { icon: BarChart3, text: t('Statistika va hisobotlar') },
      { icon: BadgeCheck, text: t('Do‘konlarni tasdiqlash va moderatsiya') },
      { icon: ScrollText, text: t('To‘liq audit jurnali') },
    ],
  },
};

export function AuthLayout() {
  const pitch = PITCH[env.appRole ?? 'CUSTOMER'];
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div className={isLogin ? 'gm-auth-layout gm-auth-layout--login' : 'gm-auth-layout'}>
      <aside className="gm-auth-layout__brand" aria-hidden={false}>
        <ShaderBackground variant="brand" />
        <Link to="/" className="gm-auth-layout__logo" aria-label={t('Quyosh — bosh sahifa')}>
          <Logo onDark />
        </Link>
        <div className="gm-auth-layout__pitch">
          <span className="gm-auth-layout__eyebrow">
            <Sparkles size={15} /> {currentPanelLabel ?? 'Quyosh'}
          </span>
          <h2 className="gm-auth-layout__headline" aria-label={pitch.title}>
            {pitch.title.split(' ').map((word, index) => (
              <span key={`${word}-${index}`} className="gm-auth-layout__word" style={{ ['--i' as string]: index }} aria-hidden="true">
                {word}
              </span>
            ))}
          </h2>
          <p>{pitch.text}</p>
          <ul>
            {pitch.points.map((point) => (
              <li key={point.text}>
                <span className="gm-auth-layout__point-icon">
                  <point.icon size={18} strokeWidth={2.2} />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="gm-auth-layout__foot">
          <Lock size={14} /> {t('Ma’lumotlaringiz himoyalangan')}
        </p>
      </aside>

      <main className="gm-auth-layout__main">
        <div className="gm-auth-layout__topbar">
          <Link to="/" className="gm-auth-layout__mobile-logo" aria-label={t('Quyosh — bosh sahifa')}>
            <Logo />
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="gm-auth-hero">
          <Link to="/" className="gm-auth-hero__mark" aria-label={t('Quyosh — bosh sahifa')}>
            <SunMark size={isLogin ? 46 : 34} />
          </Link>
          <div className="gm-auth-hero__name">Quyosh<b>.uz</b></div>
          {currentPanelLabel && <span className="gm-auth-hero__panel">{currentPanelLabel}</span>}
          <p className="gm-auth-hero__tagline">{pitch.tagline}</p>
        </div>
        <div className="gm-auth-layout__panel">
          {currentPanelLabel && <div className="gm-panel-badge">{currentPanelLabel}</div>}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
        {isLogin && (
          <>
            <ul className="gm-auth-tiles">
              {pitch.tiles.map((tile) => (
                <li key={tile.text}>
                  <tile.icon size={20} strokeWidth={2.1} />
                  <span>{tile.text}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
