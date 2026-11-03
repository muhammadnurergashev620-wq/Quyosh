import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, EyeOff, History, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PageLoader } from '@/components/common/PageLoader';
import { BLOCK_LABEL, type BlockContent, type BlockFields, type BlockLang, type BlockType, type Item } from '@/features/site/home-content';
import { toUzbekCyrillic } from '@/i18n/translit';
import { apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime } from '@/lib/utils';
import { t } from '@/i18n';
import '@/features/shop/shop.css';
import '@/features/m7/m7.css';

interface AdminBlock {
  id: string;
  type: BlockType;
  sortOrder: number;
  hidden: boolean;
  fixed: boolean;
  content: BlockContent;
  draft: BlockContent | null;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface BlockVersion { id: string; version: number | null; content: BlockContent | null; publishedAt: string; by: string | null }

const api = {
  list: () => apiGet<AdminBlock[]>('/admin/site-blocks'),
  draft: (id: string, content: BlockContent) => apiPut<AdminBlock>(`/admin/site-blocks/${id}/draft`, { content }),
  discard: (id: string) => apiPost<AdminBlock>(`/admin/site-blocks/${id}/discard`, {}),
  publish: (id: string) => apiPost<AdminBlock>(`/admin/site-blocks/${id}/publish`, {}),
  update: (id: string, body: { hidden?: boolean }) => apiPatch<AdminBlock>(`/admin/site-blocks/${id}`, body),
  reorder: (ids: string[]) => apiPost<AdminBlock[]>('/admin/site-blocks/reorder', { ids }),
  versions: (id: string) => apiGet<BlockVersion[]>(`/admin/site-blocks/${id}/versions`),
  restore: (id: string, versionId: string) => apiPost<AdminBlock>(`/admin/site-blocks/${id}/versions/${versionId}/restore`, {}),
};

type FieldSpec =
  | { name: string; kind: 'text' | 'long'; label: () => string; max: number; required?: boolean }
  | { name: string; kind: 'list'; label: () => string; max: number }
  | { name: string; kind: 'items'; label: () => string; max: number; titleLabel: () => string; textLabel: () => string };

/** Backend `block-schema.ts` bilan bir xil maydonlar (chegaralar u yerda tekshiriladi). */
const FIELDS: Record<BlockType, FieldSpec[]> = {
  HERO: [
    { name: 'label', kind: 'text', label: () => t('Ustki yozuv'), max: 80 },
    { name: 'titleA', kind: 'text', label: () => t('Sarlavha (1-qism)'), max: 80, required: true },
    { name: 'titleB', kind: 'text', label: () => t('Sarlavha (ajratilgan qism)'), max: 80 },
    { name: 'text', kind: 'long', label: () => t('Matn'), max: 400 },
    { name: 'chips', kind: 'list', label: () => t('Belgilar (har qatorda bittasi)'), max: 6 },
    { name: 'ctaPrimary', kind: 'text', label: () => t('Asosiy tugma'), max: 40, required: true },
    { name: 'ctaSecondary', kind: 'text', label: () => t('Ikkinchi tugma'), max: 40 },
  ],
  STATS: [{ name: 'title', kind: 'text', label: () => t('Sarlavha (ekran o‘quvchi uchun)'), max: 80 }],
  STATEMENT: [
    { name: 'label', kind: 'text', label: () => t('Belgi'), max: 40 },
    { name: 'text', kind: 'long', label: () => t('Shior matni'), max: 300, required: true },
  ],
  PATHS: [
    { name: 'customerTitle', kind: 'text', label: () => t('Mijoz: sarlavha'), max: 80, required: true },
    { name: 'customerPoints', kind: 'list', label: () => t('Mijoz: afzalliklar (har qatorda bittasi)'), max: 5 },
    { name: 'customerCta', kind: 'text', label: () => t('Mijoz: tugma'), max: 40, required: true },
    { name: 'shopTitle', kind: 'text', label: () => t('Do‘kon: sarlavha'), max: 80, required: true },
    { name: 'shopPoints', kind: 'list', label: () => t('Do‘kon: afzalliklar (har qatorda bittasi)'), max: 5 },
    { name: 'shopCta', kind: 'text', label: () => t('Do‘kon: tugma'), max: 40, required: true },
  ],
  HOW_IT_WORKS: [
    { name: 'eyebrow', kind: 'text', label: () => t('Ustki yozuv'), max: 40 },
    { name: 'title', kind: 'text', label: () => t('Sarlavha'), max: 120, required: true },
    { name: 'items', kind: 'items', label: () => t('Qadamlar'), max: 8, titleLabel: () => t('Qadam nomi'), textLabel: () => t('Izoh') },
  ],
  TRUST: [
    { name: 'eyebrow', kind: 'text', label: () => t('Ustki yozuv'), max: 40 },
    { name: 'title', kind: 'text', label: () => t('Sarlavha'), max: 120, required: true },
    { name: 'items', kind: 'items', label: () => t('Kartochkalar'), max: 6, titleLabel: () => t('Sarlavha'), textLabel: () => t('Matn') },
  ],
  TESTIMONIALS: [
    { name: 'eyebrow', kind: 'text', label: () => t('Ustki yozuv'), max: 40 },
    { name: 'title', kind: 'text', label: () => t('Sarlavha'), max: 120, required: true },
  ],
  FAQ: [
    { name: 'eyebrow', kind: 'text', label: () => t('Ustki yozuv'), max: 40 },
    { name: 'title', kind: 'text', label: () => t('Sarlavha'), max: 120, required: true },
    { name: 'items', kind: 'items', label: () => t('Savollar'), max: 12, titleLabel: () => t('Savol'), textLabel: () => t('Javob') },
  ],
  FINALE: [
    { name: 'title', kind: 'long', label: () => t('Sarlavha ({h} va {m} — bugungi quyosh soati va daqiqasi)'), max: 200, required: true },
    { name: 'ctaPrimary', kind: 'text', label: () => t('Asosiy tugma'), max: 40, required: true },
    { name: 'ctaSecondary', kind: 'text', label: () => t('Ikkinchi tugma'), max: 40 },
  ],
};

const BLOCK_HINT: Partial<Record<BlockType, () => string>> = {
  STATS: () => t('Raqamlar bazadan avtomatik olinadi: tasdiqlangan do‘konlar, hisoblar va tasdiqlangan montajlar. Hammasi 0 bo‘lsa blok ko‘rinmaydi.'),
  TESTIMONIALS: () => t('Faqat moderatsiyadan o‘tgan (4–5 yulduzli, izohli) sharhlar ko‘rsatiladi; bitta do‘kondan ko‘pi bilan 2 ta. Sharh bo‘lmasa blok ko‘rinmaydi.'),
  HERO: () => t('Kino-scroll boshidagi ekran: joyi va ko‘rinishi o‘zgarmaydi.'),
  FINALE: () => t('Sahifa oxiridagi chaqiriq: joyi va ko‘rinishi o‘zgarmaydi.'),
};

const LANGS: Array<[BlockLang, string]> = [['uz', 'O‘zbekcha'], ['ru', 'Русский'], ['oz', 'Ўзбекча']];

/** Tarjima to‘liqligi: majburiy maydonlar to‘ldirilganmi (oz ixtiyoriy — bo‘sh bo‘lsa avtomatik o‘giriladi). */
function complete(type: BlockType, fields: BlockFields | undefined) {
  if (!fields) return false;
  return FIELDS[type].every((f) => !('required' in f && f.required) || (typeof fields[f.name] === 'string' && (fields[f.name] as string).trim()));
}

function equal(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** U12: bosh sahifa bloklari — 3 tilda tahrir, qoralama → ko‘rinish → nashr, versiyalar va tartib. */
export function AdminHomeBlocksPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['admin-site-blocks'], queryFn: api.list });
  const [selected, setSelected] = useState<string | null>(null);
  const blocks = list.data ?? [];
  const current = blocks.find((b) => b.id === selected) ?? blocks[0];
  const refresh = (data?: AdminBlock[] | AdminBlock) => {
    if (Array.isArray(data)) queryClient.setQueryData(['admin-site-blocks'], data);
    else if (data) queryClient.setQueryData<AdminBlock[]>(['admin-site-blocks'], (old) => old?.map((b) => (b.id === data.id ? data : b)));
    void queryClient.invalidateQueries({ queryKey: ['site-home'] });
  };
  const toggle = useMutation({ mutationFn: (b: AdminBlock) => api.update(b.id, { hidden: !b.hidden }), onSuccess: refresh });
  const reorder = useMutation({ mutationFn: api.reorder, onSuccess: refresh });
  const movable = blocks.filter((b) => !b.fixed);
  const move = (id: string, dir: -1 | 1) => {
    const ids = movable.map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  };

  if (list.isLoading) return <PageLoader />;
  if (list.isError) return <Alert tone="danger">{getErrorMessage(list.error)}</Alert>;
  const drafts = blocks.filter((b) => b.draft).length;

  return (
    <div className="qs-page">
      <div className="qs-page__head">
        <div>
          <h1>{t('Bosh sahifa')}</h1>
          <p>{t('Matnlar 3 tilda. O‘zgarish avval qoralama bo‘lib saqlanadi va «Nashr qilish»dan keyin saytda chiqadi.')}</p>
        </div>
        <div className="qs-page__actions">
          {drafts > 0 && <Badge tone="warning">{t('{n} ta qoralama', { n: drafts })}</Badge>}
          <a className="gm-button gm-button--secondary gm-button--md" href="/admin/bosh-sahifa/korinish" target="_blank" rel="noreferrer"><Eye size={16} /> {t('Ko‘rinish')}</a>
        </div>
      </div>
      {(toggle.isError || reorder.isError) && <Alert tone="danger">{getErrorMessage(toggle.error ?? reorder.error)}</Alert>}
      <div className="qs-cms">
        <nav className="qs-card qs-cms__list" aria-label={t('Bloklar')}>
          {blocks.map((b) => {
            const index = movable.findIndex((m) => m.id === b.id);
            return (
              <div key={b.id} className={cx('qs-cms__row', current?.id === b.id && 'is-on', b.hidden && 'is-hidden')}>
                <button type="button" className="qs-cms__pick" onClick={() => setSelected(b.id)} aria-current={current?.id === b.id}>
                  <strong>{BLOCK_LABEL[b.type]()}</strong>
                  <small>
                    v{b.version}
                    {b.draft && <> · <span className="qs-cms__draft">{t('qoralama')}</span></>}
                    {b.hidden && <> · {t('yashirin')}</>}
                  </small>
                </button>
                {!b.fixed && (
                  <span className="qs-cms__tools">
                    <Button size="sm" variant="ghost" aria-label={t('Yuqoriga')} disabled={index <= 0 || reorder.isPending} onClick={() => move(b.id, -1)}><ArrowUp size={14} /></Button>
                    <Button size="sm" variant="ghost" aria-label={t('Pastga')} disabled={index >= movable.length - 1 || reorder.isPending} onClick={() => move(b.id, 1)}><ArrowDown size={14} /></Button>
                    <Button size="sm" variant="ghost" aria-label={b.hidden ? t('Ko‘rsatish') : t('Yashirish')} aria-pressed={b.hidden} disabled={toggle.isPending} onClick={() => toggle.mutate(b)}>{b.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</Button>
                  </span>
                )}
              </div>
            );
          })}
        </nav>
        {current && <BlockEditor key={`${current.id}:${current.updatedAt}`} block={current} onSaved={refresh} />}
      </div>
    </div>
  );
}

function BlockEditor({ block, onSaved }: { block: AdminBlock; onSaved: (b: AdminBlock) => void }) {
  const initial = useMemo(() => block.draft ?? block.content, [block]);
  const [value, setValue] = useState<BlockContent>(initial);
  const [lang, setLang] = useState<BlockLang>('uz');
  const [history, setHistory] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  const dirty = !equal(value, initial);
  const save = useMutation({ mutationFn: () => api.draft(block.id, value), onSuccess: onSaved });
  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await api.draft(block.id, value);
      return api.publish(block.id);
    },
    onSuccess: onSaved,
  });
  const discard = useMutation({ mutationFn: () => api.discard(block.id), onSuccess: onSaved });
  const fields = value[lang] ?? {};
  const set = (name: string, v: unknown) => setValue((cur) => ({ ...cur, [lang]: { ...(cur[lang] ?? {}), [name]: v } }));
  const error = save.error ?? publish.error ?? discard.error;
  const hint = BLOCK_HINT[block.type];

  return (
    <section className="qs-card qs-cms__editor">
      <header>
        <div>
          <h2>{BLOCK_LABEL[block.type]()}</h2>
          <small className="qs-muted">
            {t('Nashr: v{v}', { v: block.version })}{block.publishedAt ? ` · ${formatDateTime(block.publishedAt)}` : ''}{block.updatedBy ? ` · ${block.updatedBy}` : ''}
          </small>
        </div>
        <div className="qs-page__actions">
          {block.draft ? <Badge tone="warning">{t('Nashr qilinmagan qoralama')}</Badge> : <Badge tone="success">{t('Saytdagi bilan bir xil')}</Badge>}
          <Button size="sm" variant="ghost" onClick={() => setHistory(true)}><History size={14} /> {t('Versiyalar')}</Button>
        </div>
      </header>
      {hint && <p className="qs-muted" style={{ margin: 0 }}>{hint()}</p>}
      <div className="qs-tabs" role="tablist" aria-label={t('Til')}>
        {LANGS.map(([code, label]) => (
          <button key={code} type="button" role="tab" aria-selected={lang === code} className={cx(lang === code && 'is-on')} onClick={() => setLang(code)}>
            {label} {code === 'oz' ? (value.oz ? '✓' : '·') : complete(block.type, value[code]) ? '✓' : '!'}
          </button>
        ))}
      </div>
      {lang === 'oz' && <p className="qs-muted" style={{ margin: 0 }}>{t('Kirill matni ixtiyoriy: bo‘sh maydonlar o‘zbek lotinidan avtomatik o‘giriladi.')}</p>}
      <div className="qs-form">
        {FIELDS[block.type].map((spec) => (
          <FieldEditor key={`${lang}:${spec.name}`} spec={spec} value={fields[spec.name]} placeholder={lang === 'oz' ? (value.uz ?? {})[spec.name] : undefined} onChange={(v) => set(spec.name, v)} />
        ))}
      </div>
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <div className="qs-form__actions">
        {block.draft && <Button variant="ghost" loading={discard.isPending} onClick={() => discard.mutate()}><Undo2 size={15} /> {t('Qoralamani bekor qilish')}</Button>}
        <Button variant="secondary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}><Save size={15} /> {t('Qoralamani saqlash')}</Button>
        <Button disabled={!dirty && !block.draft} loading={publish.isPending} onClick={() => publish.mutate()}><Send size={15} /> {t('Nashr qilish')}</Button>
      </div>
      {history && <VersionsModal block={block} onClose={() => setHistory(false)} onRestored={(b) => { onSaved(b); setHistory(false); }} />}
    </section>
  );
}

function FieldEditor({ spec, value, placeholder, onChange }: { spec: FieldSpec; value: unknown; placeholder?: unknown; onChange: (v: unknown) => void }) {
  const ph = (v: unknown) => (typeof v === 'string' ? toUzbekCyrillic(v) : undefined);
  if (spec.kind === 'text' || spec.kind === 'long') {
    const props = { label: `${spec.label()}${spec.required ? ' *' : ''}`, value: typeof value === 'string' ? value : '', maxLength: spec.max, placeholder: ph(placeholder), onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
    return spec.kind === 'long' ? <Textarea rows={3} {...props} /> : <Input {...props} />;
  }
  if (spec.kind === 'list') {
    const lines = Array.isArray(value) ? (value as string[]) : [];
    const phLines = Array.isArray(placeholder) ? (placeholder as string[]).map((x) => toUzbekCyrillic(x)).join('\n') : undefined;
    return <Textarea label={spec.label()} rows={Math.min(6, Math.max(3, lines.length + 1))} value={lines.join('\n')} placeholder={phLines} hint={t('Ko‘pi bilan {n} qator', { n: spec.max })} onChange={(e) => onChange(e.target.value.split('\n').slice(0, spec.max))} />;
  }
  const itemSpec = spec as Extract<FieldSpec, { kind: 'items' }>;
  const rows = Array.isArray(value) ? (value as Item[]) : [];
  const phRows = Array.isArray(placeholder) ? (placeholder as Item[]) : [];
  const update = (i: number, patch: Partial<Item>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="qs-cms__items">
      <legend>{spec.label()} <small className="qs-muted">({rows.length}/{spec.max})</small></legend>
      {rows.map((row, i) => (
        <div key={i} className="qs-cms__item">
          <span className="qs-num qs-muted">{i + 1}</span>
          <div className="qs-form">
            <Input label={itemSpec.titleLabel()} value={row.title} placeholder={ph(phRows[i]?.title)} onChange={(e) => update(i, { title: e.target.value })} />
            <Textarea label={itemSpec.textLabel()} rows={2} value={row.text} placeholder={ph(phRows[i]?.text)} onChange={(e) => update(i, { text: e.target.value })} />
          </div>
          <span className="qs-cms__tools">
            <Button size="sm" variant="ghost" aria-label={t('Yuqoriga')} disabled={i === 0} onClick={() => { const next = [...rows]; [next[i - 1], next[i]] = [next[i]!, next[i - 1]!]; onChange(next); }}><ArrowUp size={14} /></Button>
            <Button size="sm" variant="ghost" aria-label={t('O‘chirish')} onClick={() => onChange(rows.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>
          </span>
        </div>
      ))}
      {rows.length < spec.max && <Button size="sm" variant="secondary" onClick={() => onChange([...rows, { title: '', text: '' }])}><Plus size={14} /> {t('Qo‘shish')}</Button>}
    </fieldset>
  );
}

function VersionsModal({ block, onClose, onRestored }: { block: AdminBlock; onClose: () => void; onRestored: (b: AdminBlock) => void }) {
  const list = useQuery({ queryKey: ['site-block-versions', block.id, block.version], queryFn: () => api.versions(block.id) });
  const restore = useMutation({ mutationFn: (versionId: string) => api.restore(block.id, versionId), onSuccess: onRestored });
  return (
    <Modal open title={t('Versiyalar: {name}', { name: BLOCK_LABEL[block.type]() })} onClose={onClose}>
      {list.isLoading ? <PageLoader /> : !list.data?.length ? (
        <p className="qs-muted">{t('Hali admin tomonidan nashr qilingan versiya yo‘q (v1 — standart matn).')}</p>
      ) : (
        <div className="qs-ticket-thread">
          {list.data.map((v) => (
            <div key={v.id} className="qs-pick">
              <div><strong>v{v.version ?? '?'}</strong><small>{formatDateTime(v.publishedAt)}{v.by ? ` · ${v.by}` : ''}</small></div>
              {v.version === block.version && !block.draft ? <Badge tone="success">{t('Saytda')}</Badge> : (
                <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables === v.id} onClick={() => restore.mutate(v.id)}><Undo2 size={14} /> {t('Qoralamaga tiklash')}</Button>
              )}
            </div>
          ))}
        </div>
      )}
      {restore.isError && <Alert tone="danger">{getErrorMessage(restore.error)}</Alert>}
    </Modal>
  );
}
