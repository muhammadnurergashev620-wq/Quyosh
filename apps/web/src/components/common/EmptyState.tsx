import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

export interface EmptyStep {
  icon?: ReactNode;
  title: string;
  text: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  steps,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  /** Berilsa — kengaytirilgan, qadamlar bilan bo‘sh holat ko‘rsatiladi. */
  steps?: EmptyStep[];
}) {
  if (steps) {
    return (
      <section className="gm-mempty">
        <span className="gm-mempty__icon" aria-hidden="true">
          {icon ?? <Inbox size={34} strokeWidth={1.8} />}
        </span>
        <div className="gm-mempty__text">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {(
          <ol className="gm-mempty__steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="gm-mempty__num">{step.icon ?? index + 1}</span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        )}
        {action && <div className="gm-mempty__cta">{action}</div>}
      </section>
    );
  }
  return (
    <div className="gm-empty-state">
      <span className="gm-empty-state__icon" aria-hidden="true">
        {icon ?? <Inbox size={28} strokeWidth={1.75} />}
      </span>
      <p className="gm-empty-state__title">{title}</p>
      {description && <p className="gm-empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
