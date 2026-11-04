import { PERMISSION_GROUPS } from '@/features/shop/labels';

/** Do‘kon a’zosi ruxsatlari (guruhlangan checkbox’lar) — xodimlar sahifasi va admin "Xodim qo‘shish" oynasi uchun. */
export function PermissionPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  return (
    <div className="qs-perm-groups">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.items.map((item) => (
            <label key={item.key} className="qs-check">
              <input type="checkbox" checked={value.includes(item.key)} onChange={() => toggle(item.key)} /> {item.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
