import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { useCurrentShop } from '@/features/shop/current-shop';
import { useShopBranches, useShopMutation } from '@/features/shop/hooks';
import { shopService } from '@/features/shop/shop.service';
import { BranchForm } from '@/features/shop/components/BranchForm';
import { ServiceAreaEditor } from '@/features/shop/components/ServiceAreaEditor';
import { WEEKDAYS } from '@/features/shop/labels';
import type { Branch, BranchInput } from '@/features/shop/types';
import { getErrorMessage } from '@/lib/error-messages';
import { regionName } from '@/lib/regions';
import { t } from '@/i18n';
import '@/features/shop/shop.css';

function hoursSummary(branch: Branch) {
  const hours = branch.openingHoursJson ?? {};
  const open = WEEKDAYS.filter((day) => hours[day.key]?.length);
  const first = open[0] && hours[open[0].key]?.[0];
  if (!first) return t('Ish vaqti ko‘rsatilmagan');
  return `${open.map((day) => day.label.slice(0, 2)).join(', ')} · ${first[0]}–${first[1]}`;
}

/** U11.8: filiallar (manzil, ish vaqti). Xizmat hududi poligoni — M3 (PostGIS). */
export function ShopBranchesPage() {
  const { shopId, can } = useCurrentShop();
  const branches = useShopBranches(shopId);
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Branch | null>(null);
  const [areaFor, setAreaFor] = useState<Branch | null>(null);
  const create = useShopMutation(shopId, shopService.createBranch, { success: t('Filial qo‘shildi') });
  const update = useShopMutation(shopId, (id, vars: { branch: Branch; input: BranchInput }) => shopService.updateBranch(id, vars.branch.id, { ...vars.input, version: vars.branch.version }), { success: t('Saqlandi') });
  const archive = useShopMutation(shopId, (id, branchId: string) => shopService.archiveBranch(id, branchId), { success: t('Filial arxivlandi') });
  const writable = can('branches.write');

  if (branches.isLoading) return <PageLoader />;
  if (branches.isError) return <Alert tone="danger">{getErrorMessage(branches.error)}</Alert>;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div><h1>{t('Filiallar va hudud')}</h1><p>{t('Mijozlar sizni filial manzili va ish vaqti bo‘yicha topadi.')}</p></div>
        {writable && <Button onClick={() => setEditing('new')}><Plus size={18} /> {t('Filial qo‘shish')}</Button>}
      </div>
      {!branches.data?.length ? (
        <EmptyState icon={<MapPin size={32} />} title={t('Hali filial yo‘q')} description={t('Birinchi filialni qo‘shing — manzil va ish vaqti.')} action={writable && <Button onClick={() => setEditing('new')}>{t('Filial qo‘shish')}</Button>} />
      ) : (
        <ul className="qs-list">
          {branches.data.map((branch) => (
            <li key={branch.id}>
              <div>
                <strong>{branch.name}</strong>
                <small>{[regionName(branch.regionCode), branch.address].filter(Boolean).join(' · ')}</small>
                <small>{hoursSummary(branch)}{branch.phone ? ` · ${branch.phone}` : ''}</small>
              </div>
              <Badge tone={branch.status === 'ACTIVE' ? 'success' : 'neutral'}>{branch.status === 'ACTIVE' ? t('Faol') : t('Nofaol')}</Badge>
              {branch.lat == null ? <Badge tone="warning">{t('Xaritada yo‘q')}</Badge> : branch.hasServiceArea ? <Badge tone="success">{t('Hudud bor')}</Badge> : <Badge tone="warning">{t('Hudud yo‘q')}</Badge>}
              {writable && (
                <span className="qs-page__actions">
                  <Button size="sm" variant="secondary" onClick={() => setAreaFor(branch)}>{t('Xizmat hududi')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(branch)}>{t('Tahrirlash')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setArchiving(branch)}>{t('Arxivlash')}</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('Yangi filial') : t('Filialni tahrirlash')} wide>
        {editing && (
          <BranchForm
            key={editing === 'new' ? 'new' : `${editing.id}-${editing.version}`}
            initial={editing === 'new' ? undefined : editing}
            loading={create.isPending || update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              editing === 'new'
                ? create.mutate(input, { onSuccess: () => setEditing(null) })
                : update.mutate({ branch: editing, input }, { onSuccess: () => setEditing(null), onError: () => void branches.refetch() })
            }
          />
        )}
      </Modal>
      <Modal open={!!areaFor} onClose={() => setAreaFor(null)} title={areaFor ? t('Xizmat hududi: {name}', { name: areaFor.name }) : ''} large>
        {areaFor && shopId && <ServiceAreaEditor shopId={shopId} branch={areaFor} onDone={() => setAreaFor(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!archiving}
        title={t('Filialni arxivlash')}
        description={t('«{name}» filiali mijozlarga ko‘rinmaydi. Davom etasizmi?', { name: archiving?.name ?? '' })}
        confirmLabel={t('Arxivlash')}
        tone="danger"
        showCancel
        cancelLabel={t('Bekor qilish')}
        loading={archive.isPending}
        onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })}
        onCancel={() => setArchiving(null)}
      />
    </div>
  );
}
