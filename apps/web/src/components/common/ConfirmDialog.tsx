import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { t } from '@/i18n';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Faqat `showCancel` bilan ishlatiladi: ikkinchi (rad etish) tugmasi yozuvi. */
  cancelLabel?: string;
  /** Ikkita tugma ko‘rsatish (masalan, «Qolish» / «Tizimdan chiqish»). Odatda faqat bitta asosiy tugma bo‘ladi. */
  showCancel?: boolean;
  /** Tepadagi belgini almashtirish (standart: ogohlantirish yoki «i»). */
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = t('Tasdiqlash'),
  cancelLabel = t('Bekor qilish'),
  showCancel = false,
  icon,
  tone = 'default',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      icon={
        <span className="gm-confirm__icon" aria-hidden="true">
          {icon ?? (tone === 'danger' ? <AlertTriangle size={28} /> : <Info size={28} />)}
        </span>
      }
      className={`gm-modal--confirm gm-modal--confirm-${tone}`}
      footer={
        <>
          {showCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
          )}
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="gm-confirm__text">{description}</p>
      {children}
    </Dialog>
  );
}
