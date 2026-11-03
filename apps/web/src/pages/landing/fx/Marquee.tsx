import type { LucideIcon } from 'lucide-react';

/** Cheksiz yuguruvchi qator: yirik «konturli» so‘zlar, ustiga kelganda to‘xtaydi. */
export function Marquee({ items, reverse = false }: { items: Array<{ icon: LucideIcon; name: string }>; reverse?: boolean }) {
  const row = (key: string, hidden: boolean) => (
    <ul key={key} className="gm-marquee__row" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={`${key}-${item.name}`}>
          <item.icon size={34} strokeWidth={1.6} />
          <span>{item.name}</span>
          <i aria-hidden="true">✦</i>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={reverse ? 'gm-marquee gm-marquee--reverse' : 'gm-marquee'}>
      <div className="gm-marquee__track">
        {row('a', false)}
        {row('b', true)}
        {row('c', true)}
      </div>
    </div>
  );
}
