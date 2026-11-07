import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import './StatusPage.css';

/** Tizim holati sahifasi (U21 SYS-01/02/06): illyustratsiya, kod, bitta jumla va bitta asosiy amal. */
export function StatusPage({ code, icon, title, description, action, secondary, inline = false }: {
  /** Panel qobig‘i ichida (sidebar bilan) — to‘liq ekran balandligisiz. */
  inline?: boolean;
  code: string;
  icon: ReactNode;
  title: string;
  description: string;
  action: { to: string; label: string };
  secondary?: ReactNode;
}) {
  // Panel ichida <main> allaqachon bor — ichma-ich <main> bo‘lmasligi uchun <section>.
  const Tag = inline ? 'section' : 'main';
  return (
    <Tag className={inline ? 'qs-status qs-status--inline' : 'qs-status'} aria-labelledby="qs-status-title">
      <div className="qs-status__card">
        <Logo />
        <div className="qs-status__art" aria-hidden="true">
          <span className="qs-status__sun" />
          <span className="qs-status__icon">{icon}</span>
        </div>
        <p className="qs-status__code">{code}</p>
        <h1 id="qs-status-title">{title}</h1>
        <p className="qs-status__text">{description}</p>
        <Link to={action.to} className="gm-button gm-button--primary gm-button--md qs-status__cta">{action.label}</Link>
        {secondary}
      </div>
    </Tag>
  );
}
