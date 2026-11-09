import { Checkbox } from '@/components/ui/Checkbox';
import { ADMIN_PERMISSION_OPTIONS } from "../permissions";
import { t } from '@/i18n';

const GROUPS = ["Boshqaruv", "Kontent", "Tizim"] as const;

/** Oddiy admin uchun ruxsat beriladigan bo‘limlarni tanlash (guruhlangan belgilash qutilari). */
export function PermissionPicker({
  value,
  onChange,
  disabled,
  allowed,
  title,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Berilsa, faqat shu huquqlar ko‘rsatiladi (vakolatli admin uchun). */
  allowed?: string[];
  title?: string;
}) {
  const options = allowed ? ADMIN_PERMISSION_OPTIONS.filter((option) => allowed.includes(option.value)) : ADMIN_PERMISSION_OPTIONS;
  const total = options.length;
  const all = value.length === total;
  const toggle = (key: string) =>
    onChange(
      value.includes(key)
        ? value.filter((item) => item !== key)
        : [...value, key],
    );

  return (
    <fieldset className="gm-perm" disabled={disabled}>
      <legend className="gm-perm__legend">
        <span>{title ?? t('Ruxsat beriladigan bo‘limlar')}<small
            className={
              value.length === 0
                ? "gm-perm__count gm-perm__count--empty"
                : "gm-perm__count"
            }
          >{t('{length} / {total} tanlandi', { length: value.length, total })}</small>
        </span>
        <button
          type="button"
          className="gm-perm__all"
          onClick={() =>
            onChange(
              all ? [] : options.map((option) => option.value),
            )
          }
        >
          {all ? t('Hammasini olib tashlash') : t('Hammasini tanlash')}
        </button>
      </legend>
      <div className="gm-perm__groups">
        {GROUPS.filter((group) => options.some((option) => option.group === group)).map((group) => (
          <div key={group} className="gm-perm__group">
            <p className="gm-perm__group-title">{group}</p>
            <div className="gm-perm__grid">
              {options.filter(
                (option) => option.group === group,
              ).map((option) => (
                <Checkbox key={option.value} inline labelClassName="gm-perm__item" label={<span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>} checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
