import { Check, Globe } from 'lucide-react';
import { LANGUAGES, lang, setLanguage, t } from '@/i18n';
import './LanguageSettings.css';

/** Ilova tilini tanlash (Sozlamalar). Tanlanganda sahifa yangi tilda qayta yuklanadi. */
export function LanguageSettings() {
  return (
    <section className="gm-detail-section gm-langset" aria-labelledby="gm-langset-title">
      <h2 id="gm-langset-title" className="gm-langset__title">
        <Globe size={20} aria-hidden="true" /> {t('Ilova tili')}
      </h2>
      <p className="gm-langset__lead">{t('Ilova matnlari tanlangan tilda ko‘rsatiladi.')}</p>
      <div className="gm-langset__grid" role="radiogroup" aria-label={t('Ilova tili')}>
        {LANGUAGES.map((item) => {
          const active = item.code === lang;
          return (
            <button key={item.code} type="button" role="radio" aria-checked={active} className={active ? 'gm-langset__item gm-langset__item--active' : 'gm-langset__item'} onClick={() => setLanguage(item.code)}>
              <span className="gm-langset__code">{item.short}</span>
              <span className="gm-langset__name">{item.label}</span>
              {active && <Check size={18} aria-hidden="true" className="gm-langset__check" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
