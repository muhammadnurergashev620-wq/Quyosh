import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import './InfoTip.css';

/** Kichik «i» belgisi: ustiga olib borilganda yoki fokus berilganda tushuntirish ko‘rinadi (klaviatura va sensorli ekranlar uchun ham). */
export function InfoTip({ text, label = 'Izoh' }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="gm-infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((v) => !v)}>
        <Info size={14} aria-hidden="true" />
      </button>
      {open && <span role="tooltip" id={id} className="gm-infotip__box">{text}</span>}
    </span>
  );
}
