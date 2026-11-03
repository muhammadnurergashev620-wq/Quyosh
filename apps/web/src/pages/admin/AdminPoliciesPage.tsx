import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useAdminPolicies, useCreatePolicy, usePublishPolicy } from '@/features/legal/hooks/useLegal';
import { POLICY_TYPE_LABEL } from '@/features/legal/types';
import type { PolicyType } from '@/features/legal/types';
import { t } from '@/i18n';

const TYPE_OPTIONS = (Object.keys(POLICY_TYPE_LABEL) as PolicyType[]).map((value) => ({ value, label: POLICY_TYPE_LABEL[value] }));
const STATUS_TONE = { DRAFT: 'warning', PUBLISHED: 'success', ARCHIVED: 'neutral' } as const;

export function AdminPoliciesPage() {
  const policies = useAdminPolicies();
  const create = useCreatePolicy();
  const publish = usePublishPolicy();
  const [type, setType] = useState<PolicyType>('TERMS');
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { type, version: version.trim(), title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          setVersion('');
          setTitle('');
          setContent('');
        },
      },
    );
  }

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Siyosatlar va shartlar')}</h1>
          <p className="gm-page-lead">{t('Foydalanuvchilar qabul qiladigan shartlar.')}</p>
        </div>
      </div>
      <form className="gm-form" onSubmit={handleSubmit}>
        <h2>{t('Yangi versiya (qoralama)')}</h2>
        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
        <Select label={t('Turi')} options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value as PolicyType)} />
        <Input label={t('Versiya')} required maxLength={50} placeholder="1.1" value={version} onChange={(e) => setVersion(e.target.value)} />
        <Input label={t('Sarlavha')} required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label={t('Matn')} required rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
        <div>
          <Button type="submit" loading={create.isPending} disabled={!version.trim() || !title.trim() || !content.trim()}>{t('Qoralama yaratish')}</Button>
        </div>
      </form>

      <section className="gm-detail-section">
        <h2>{t('Mavjud versiyalar')}</h2>
        {publish.isError && <Alert tone="danger">{getErrorMessage(publish.error)}</Alert>}
        {policies.isLoading && <PageLoader />}
        {policies.isError && <Alert tone="danger">{getErrorMessage(policies.error)}</Alert>}
        {policies.data && policies.data.length === 0 && <EmptyState title={t('Siyosatlar yo‘q')} />}
        <div className="gm-list">
          {(policies.data ?? []).map((policy) => (
            <div key={policy.id} className="gm-card">
              <div className="gm-card__header">
                <h3>
                  {policy.title} <small>v{policy.version}</small>
                </h3>
                <Badge tone={STATUS_TONE[policy.status]}>{policy.status}</Badge>
              </div>
              <p className="gm-card__meta">
                {POLICY_TYPE_LABEL[policy.type]}
                {policy.publishedAt && t(' · E’lon qilingan: {date}', { date: formatDate(policy.publishedAt) })}
              </p>
              {policy.status === 'DRAFT' && (
                <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate(policy.id)}>{t('E’lon qilish')}</Button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
