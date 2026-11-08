import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { Qa } from './FaqSection.helpers';

export function Column({ items }: { items: Qa[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="gm-faq__col">
      {items.map((item, index) => (
        <div key={index} className={cx('gm-faq__item', open === index && 'is-open')}>
          <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
            <span className="gm-faq__q">{item.q()}</span>
            <span className="gm-faq__plus" aria-hidden="true"><Plus size={16} strokeWidth={2.6} /></span>
          </button>
          {open === index && <p>{item.a()}</p>}
        </div>
      ))}
    </div>
  );
}
