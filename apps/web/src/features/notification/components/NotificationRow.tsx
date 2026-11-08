import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { notificationMeta, notificationText } from '../notification-meta';
import { notificationColor } from '../notification-ui';
import type { AppNotification } from '../types';
import './NotificationRow.css';

/**
 * Bildirishnoma qatori (panel va sahifa uchun bitta): turiga qarab rangli ikonka-doira, qalin sarlavha + nuqta (o‘qilmagan),
 * 2 qatorgacha matn, nisbiy vaqt (aniq sana tooltipda), hover’da «O‘qilgan qilish».
 */
export function NotificationRow({ item, base, admin, onOpen, onMarkRead, leading, compact = false }: {
  item: AppNotification;
  base: '/mijoz' | '/dokon';
  admin: boolean;
  onOpen: (item: AppNotification) => void;
  onMarkRead: (id: string) => void;
  /** Masalan, ommaviy tanlash uchun checkbox. */
  leading?: ReactNode;
  compact?: boolean;
}) {
  const meta = notificationMeta(item, base, admin);
  const text = notificationText(item, base);
  const color = notificationColor(item, base, admin);
  const Icon = meta.icon;
  const unread = item.status !== 'READ';
  return (
    <li className={cx('gm-nrow', unread && 'is-unread', compact && 'gm-nrow--compact')}>
      {leading && <span className="gm-nrow__lead">{leading}</span>}
      <button type="button" className="gm-nrow__main" onClick={() => onOpen(item)}>
        <span className={cx('gm-nrow__icon', `gm-nrow__icon--${color}`)} aria-hidden="true">
          <Icon strokeWidth={1.9} />
        </span>
        <span className="gm-nrow__body">
          <span className="gm-nrow__title">
            {unread && <span className="gm-nrow__dot" aria-hidden="true" />}
            <strong>{text.title}</strong>
            {unread && <span className="gm-visually-hidden">{t('O‘qilmagan')}</span>}
          </span>
          {text.body && <span className="gm-nrow__text">{text.body}</span>}
        </span>
      </button>
      <span className="gm-nrow__side">
        <Tooltip content={formatDateTime(item.createdAt)} side="bottom">
          <time className="gm-nrow__time" dateTime={item.createdAt} tabIndex={-1}>{formatRelativeTime(item.createdAt)}</time>
        </Tooltip>
        {unread && (
          <button type="button" className="gm-nrow__action" aria-label={t('O‘qilgan qilish')} title={t('O‘qilgan qilish')} onClick={() => onMarkRead(item.id)}>
            <Check aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  );
}
