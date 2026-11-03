import type { ReactNode } from 'react';
import { Modal } from './Modal';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer, className, icon }: DialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer} className={className} icon={icon}>
      {description && <p style={{ color: 'var(--qs-color-text-muted)', marginBottom: children ? 'var(--qs-space-4)' : 0 }}>{description}</p>}
      {children}
    </Modal>
  );
}
