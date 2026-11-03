import { Check, Globe } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { LANGUAGES, lang, setLanguage, t } from '@/i18n';

/** Til tanlash menyusi (sarlavha va kirish sahifalarida). Til o‘zgartirilganda sahifa yangi tilda qayta yuklanadi. */
export function LanguageSwitcher() {
  const current = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0]!;
  return (
    <Dropdown
      trigger={
        <span className="gm-lang__trigger" title={t('Til')} aria-label={`${t('Til')}: ${current.label}`}>
          <Globe size={18} strokeWidth={2} aria-hidden="true" />
          <span>{current.short}</span>
        </span>
      }
      items={LANGUAGES.map((item) => ({
        label: item.label,
        icon: item.code === lang ? <Check size={16} /> : <span style={{ width: 16, display: 'inline-block' }} />,
        onSelect: () => setLanguage(item.code),
      }))}
    />
  );
}
