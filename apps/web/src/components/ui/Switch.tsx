import { useId } from 'react';
import './Toggle.css';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Nom faqat ekran o‘quvchi uchun (jadval ichida, ustun sarlavhasi bor joyda). */
  hideLabel?: boolean;
}

export function Switch({ label, checked, onChange, disabled, hideLabel = false }: SwitchProps) {
  const fieldId = useId();
  return (
    <label className="gm-switch" htmlFor={fieldId}>
      <span className={hideLabel ? 'gm-visually-hidden' : 'gm-toggle__label'}>{label}</span>
      <span className="gm-switch__track" data-checked={checked} aria-hidden="true">
        <span className="gm-switch__thumb" />
      </span>
      <input
        id={fieldId}
        type="checkbox"
        role="switch"
        className="gm-visually-hidden"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
