import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Switch } from '@/components/ui/Switch';
import { PageLoader } from '@/components/common/PageLoader';
import { apiGet, apiPut } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { t } from '@/i18n';
import './NotificationChannelSettings.css';

type Channel = 'SMS' | 'EMAIL';

interface Preferences {
  contacts: { phone: boolean; email: boolean; smsAvailable: boolean };
  items: Array<{ type: string; allowed: Channel[]; locked: boolean; channels: Channel[]; isDefault: boolean }>;
}

const TYPE_LABEL: Record<string, () => string> = {
  QUOTE_REQUEST_RECEIVED: () => t('Yangi narx so‘rovi'),
  NEW_MESSAGE: () => t('Yangi xabar'),
  QUOTE_RECEIVED: () => t('Yangi narx taklifi'),
  QUOTE_REVISED: () => t('Taklif yangilandi'),
  QUOTE_ACCEPTED: () => t('Taklifingiz qabul qilindi'),
  QUOTE_NOT_SELECTED: () => t('Taklif tanlanmadi'),
  QUOTE_EXPIRING: () => t('Taklif muddati tugayapti'),
  SITE_VISIT_PROPOSED: () => t('O‘lchov uchrashuvi taklif qilindi'),
  SITE_VISIT_CONFIRMED: () => t('O‘lchov uchrashuvi tasdiqlandi'),
  INSTALLATION_STATUS_CHANGED: () => t('Montaj holati o‘zgardi'),
  INSTALLATION_CONFIRM_REMINDER: () => t('Montajni qabul qilish eslatmasi'),
  INSTALLATION_ISSUE_REPORTED: () => t('Mijoz montajda muammo bildirdi'),
  REVIEW_PUBLISHED: () => t('Yangi sharh'),
  REVIEW_REPLY: () => t('Sharhingizga javob'),
  MAINTENANCE_REMINDER: () => t('Texnik xizmat eslatmasi'),
  WARRANTY_EXPIRING: () => t('Kafolat muddati tugayapti'),
  SUPPORT_REPLY: () => t('Murojaatga javob'),
  SUPPORT_RESOLVED: () => t('Murojaat hal qilindi'),
  CERTIFICATION_RESULT: () => t('Sertifikat tekshiruvi natijasi'),
  CERTIFICATION_EXPIRING: () => t('Sertifikat muddati tugayapti'),
  SECURITY_ALERT: () => t('Xavfsizlik ogohlantirishi'),
};

const KEY = ['notification-preferences'];

/** Bildirishnoma kanallari: ilova ichida — har doim; SMS va email — tur bo‘yicha tanlanadi (TZ 14). */
export function NotificationChannelSettings() {
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: KEY, queryFn: () => apiGet<Preferences>('/me/notification-preferences') });
  const save = useMutation({
    mutationFn: (body: { type: string; channels: Channel[] }) => apiPut<Preferences>('/me/notification-preferences', body),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
  if (prefs.isLoading) return <PageLoader />;
  if (prefs.isError || !prefs.data) return <Alert tone="danger">{getErrorMessage(prefs.error)}</Alert>;
  const { contacts, items } = prefs.data;
  const usable = (c: Channel) => (c === 'SMS' ? contacts.phone : contacts.email);
  const toggle = (type: string, channels: Channel[], c: Channel, on: boolean) => save.mutate({ type, channels: on ? [...channels, c] : channels.filter((x) => x !== c) });

  return (
    <div className="gm-notif-prefs">
      <p className="gm-notif-prefs__lead">
        {t('Ilova ichidagi bildirishnomalar har doim keladi. SMS 22:00–08:00 oralig‘ida yuborilmaydi (xavfsizlik xabarlaridan tashqari) — ertalab 08:00 da keladi.')}
      </p>
      {!contacts.email && <Alert tone="info">{t('Email bildirishnomalari uchun profilda email manzilini tasdiqlang.')}</Alert>}
      {!contacts.smsAvailable && <Alert tone="info">{t('SMS xizmati hozircha ulanmagan — tanlovingiz saqlanadi va xizmat ulanganda ishlaydi.')}</Alert>}
      <table className="gm-notif-prefs__table">
        <thead>
          <tr><th>{t('Bildirishnoma')}</th><th>SMS</th><th>Email</th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.type}>
              <td>{TYPE_LABEL[item.type]?.() ?? item.type}{item.locked && <small>{t('Har doim yuboriladi')}</small>}</td>
              {(['SMS', 'EMAIL'] as const).map((c) => (
                <td key={c}>
                  {item.allowed.includes(c) ? (
                    <Switch
                      hideLabel
                      label={`${TYPE_LABEL[item.type]?.() ?? item.type}: ${c === 'SMS' ? 'SMS' : 'Email'}`}
                      checked={item.channels.includes(c)}
                      disabled={item.locked || !usable(c) || save.isPending}
                      onChange={(on) => toggle(item.type, item.channels, c, on)}
                    />
                  ) : <span aria-hidden="true">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
    </div>
  );
}
