import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Bell, FileText, Languages, LogOut, Lock, MonitorSmartphone, ScrollText, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { env } from '@/lib/env';
import { DeviceList } from '@/features/auth/components/DeviceList';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { TwoFactorSettings } from '@/features/session/components/TwoFactorSettings';
import { CodeEmailSettings } from '@/features/session/components/CodeEmailSettings';
import { DeleteAccountDialog } from '@/features/session/components/DeleteAccountDialog';
import { PolicyDocument } from '@/features/legal/components/PolicyDocument';
import type { PolicyType } from '@/features/legal/types';
import { LanguageSettings } from '@/features/session/components/LanguageSettings';
import { NotificationChannelSettings } from '@/features/session/components/NotificationChannelSettings';
import { ProfileMenuList, ProfileSubPage } from '@/features/profile/ProfileMenu';
import { LANGUAGES, lang } from '@/i18n';
import { UI_SIZES, getUiSize, setUiSize, type UiSize } from '@/lib/ui-size';
import '@/features/profile/Profile.css';
import './SettingsPage.css';
import { t } from '@/i18n';

const BASE = '/sozlamalar';

/** Hujjat bo‘limlari: manzil bo‘lagi → siyosat turi. */
const DOCUMENTS: Array<{ section: string; type: PolicyType; label: string; icon: typeof FileText }> = [
  { section: 'shartlar', type: 'TERMS', label: t('Foydalanish shartlari'), icon: FileText },
  { section: 'maxfiylik', type: 'PRIVACY', label: t('Maxfiylik siyosati'), icon: Lock },
  { section: 'qoidalar', type: 'PLATFORM_RULES', label: t('Platforma qoidalari'), icon: ScrollText },
];

/** Sozlamalar: profil kabi — asosiy sahifada menyu, har bir qator alohida ichki bo‘lim. */
export function SettingsPage() {
  const { section } = useParams();
  const [size, setSize] = useState<UiSize>(getUiSize);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function choose(next: UiSize) {
    setSize(next);
    setUiSize(next);
  }

  if (section === 'korinish') {
    return (
      <ProfileSubPage title={t('Tugmalar o‘lchami')} backTo={BASE}>
        <div className="gm-size-picker" role="radiogroup" aria-label={t('Tugmalar o‘lchami')}>
          {UI_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={size === option.value}
              className={size === option.value ? 'gm-size-picker__item gm-size-picker__item--active' : 'gm-size-picker__item'}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="gm-size-preview">
          <Button size="sm">{t('Kichik tugma')}</Button>
          <Button>{t('O‘rtacha tugma')}</Button>
          <Button size="lg">{t('Katta tugma')}</Button>
        </div>
      </ProfileSubPage>
    );
  }
  if (section === 'til') {
    return (
      <ProfileSubPage title={t('Til')} backTo={BASE}>
        <LanguageSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'bildirishnomalar') {
    return (
      <ProfileSubPage title={t('Bildirishnoma kanallari')} backTo={BASE}>
        <NotificationChannelSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'xavfsizlik') {
    return (
      <ProfileSubPage title={t('Ikki bosqichli himoya')} backTo={BASE}>
        <TwoFactorSettings />
        <CodeEmailSettings />
      </ProfileSubPage>
    );
  }
  const document = DOCUMENTS.find((item) => item.section === section);
  if (document) {
    return (
      <ProfileSubPage title={document.label} backTo={BASE}>
        <PolicyDocument type={document.type} />
      </ProfileSubPage>
    );
  }
  if (section === 'qurilmalar') {
    return (
      <ProfileSubPage title={t('Faol qurilmalar')} backTo={BASE}>
        <DeviceList />
      </ProfileSubPage>
    );
  }
  if (section) return <Navigate to={BASE} replace />;

  return (
    <div className="gm-pmenu-page">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Sozlamalar')}</h1>
      </div>
      <ProfileMenuList
        rows={[
          { key: 'lang', icon: Languages, label: t('Til'), value: LANGUAGES.find((item) => item.code === lang)?.label, to: `${BASE}/til` },
          { key: 'view', icon: SlidersHorizontal, label: t('Tugmalar o‘lchami'), value: UI_SIZES.find((item) => item.value === size)?.label, to: `${BASE}/korinish` },
          { key: 'notifications', icon: Bell, label: t('Bildirishnoma kanallari'), value: t('SMS, email'), to: `${BASE}/bildirishnomalar` },
          // Do‘kon paneli: kirish faqat login + parol (OTP yo‘q), ikki bosqichli himoya sozlamasi ko‘rsatilmaydi.
          ...(env.appRole === 'SHOP' ? [] : [{ key: 'security', icon: ShieldCheck, label: t('Ikki bosqichli himoya'), to: `${BASE}/xavfsizlik` }]),
          { key: 'devices', icon: MonitorSmartphone, label: t('Faol qurilmalar'), to: `${BASE}/qurilmalar` },
          ...DOCUMENTS.map((item) => ({ key: item.section, icon: item.icon, label: item.label, to: `${BASE}/${item.section}` })),
          { key: 'logout', icon: LogOut, label: t('Tizimdan chiqish'), danger: true, onClick: () => setLogoutOpen(true) },
          { key: 'delete', icon: Trash2, label: t('Hisobni o‘chirish'), danger: true, onClick: () => setDeleteOpen(true) },
        ]}
      />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
