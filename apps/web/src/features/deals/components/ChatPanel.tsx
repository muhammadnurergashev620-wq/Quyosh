import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCheck, FileText, Info, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { apiGet } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { formatDateTime, formatTime } from '@/lib/format';
import { t } from '@/i18n';
import { dealsService } from '../deals.service';
import type { Attachment, ChatMessage, Side, SiteVisit } from '../types';
import { ProposeVisitModal, SiteVisitCard } from './SiteVisitCard';

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** Yuklangan ilova: rasm — kichik ko‘rinish, PDF — havola. Imzolangan URL faqat qatnashchiga beriladi. */
function AttachmentView({ file }: { file: Attachment }) {
  const isImage = file.mime?.startsWith('image/');
  const ready = file.status === 'READY';
  const url = useQuery({
    queryKey: ['media-url', file.id, isImage ? 'thumbnail' : 'original'],
    queryFn: () => apiGet<{ url: string }>(`/media/${file.id}/${isImage ? 'thumbnail' : 'original'}`),
    enabled: ready,
    staleTime: 5 * 60_000,
  });
  if (!ready) return <span><Spinner size="sm" /> {file.status === 'REJECTED' || file.status === 'FAILED' ? t('Fayl rad etildi') : t('Tekshirilmoqda…')}</span>;
  if (!url.data) return <span><FileText size={14} /> {file.name ?? t('Fayl')}</span>;
  return isImage ? (
    <a href={url.data.url} target="_blank" rel="noreferrer"><img src={url.data.url} alt={file.name ?? t('Rasm')} loading="lazy" /></a>
  ) : (
    <a href={url.data.url} target="_blank" rel="noreferrer"><FileText size={14} /> {file.name ?? 'PDF'}</a>
  );
}

interface PendingMessage {
  clientId: string;
  body: string;
  attachmentIds: string[];
  files: string[];
  asClarification: boolean;
  state: 'sending' | 'failed';
  error?: string;
  createdAt: string;
}

type StreamItem = { kind: 'msg'; at: string; msg: ChatMessage } | { kind: 'visit'; at: string; visit: SiteVisit } | { kind: 'pending'; at: string; p: PendingMessage };

const SYSTEM_ICON: Record<string, ReactNode> = { SITE_VISIT: <CalendarClock size={13} />, FIX_REQUEST: <AlertTriangle size={13} /> };

/**
 * U9.3: yozishma — xabarlar, tizim xabarlari (markazda), ilovalar (5 × 10 MB, rasm/PDF), holat (yuborilmoqda / yuborildi / o‘qildi),
 * xato bo‘lsa xabar qizil chegara bilan qoladi va "Qayta yuborish"; pastda bo‘lmasa "N ta yangi xabar ↓" chipi.
 */
export function ChatPanel({ rsId, side, visits, context, canWrite = true, canAsk = false, onActivity }: { rsId: string; side: Side; visits: SiteVisit[]; context: ReactNode; canWrite?: boolean; /** Do‘kon: savol sifatida yuborish mumkinmi (SENT/VIEWED). */ canAsk?: boolean; onActivity?: () => void }) {
  const queryClient = useQueryClient();
  const messages = useQuery({ queryKey: ['chat', rsId], queryFn: () => dealsService.messages(rsId), refetchInterval: 5000 });
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [text, setText] = useState('');
  const [asClarification, setAsClarification] = useState(false);
  const [uploads, setUploads] = useState<Array<{ key: string; name: string; id?: string; error?: string }>>([]);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const streamRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastSeen = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo<StreamItem[]>(() => {
    const list: StreamItem[] = [
      ...(messages.data?.items ?? []).map((msg) => ({ kind: 'msg' as const, at: msg.createdAt, msg })),
      ...visits.filter((v) => v.status !== 'CANCELLED' || (v.cancelReason && v.cancelReason !== 'REPLACED')).map((visit) => ({ kind: 'visit' as const, at: visit.createdAt, visit })),
      ...pending.map((p) => ({ kind: 'pending' as const, at: p.createdAt, p })),
    ];
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [messages.data, visits, pending]);

  // O‘qildi: boshqa tomonning o‘qilmagan xabari bo‘lsa.
  const hasUnread = (messages.data?.items ?? []).some((m) => !m.mine && m.senderSide !== 'SYSTEM' && !m.readAt);
  useEffect(() => {
    if (!hasUnread) return;
    void dealsService.markRead(rsId).then(() => onActivity?.());
  }, [hasUnread, rsId, onActivity]);

  // Pastga skroll faqat foydalanuvchi pastda bo‘lsa; aks holda yangi xabarlar chipi.
  const newest = messages.data?.items[0]?.id ?? null;
  useLayoutEffect(() => {
    const el = streamRef.current;
    if (!el || !newest) return;
    if (lastSeen.current === null || atBottom.current) {
      el.scrollTop = el.scrollHeight;
      setNewCount(0);
    } else if (newest !== lastSeen.current) {
      const fresh = (messages.data?.items ?? []).findIndex((m) => m.id === lastSeen.current);
      setNewCount((n) => n + (fresh === -1 ? 1 : fresh));
    }
    lastSeen.current = newest;
  }, [newest, messages.data]);

  const onScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom.current) setNewCount(0);
  };
  const toBottom = () => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewCount(0);
  };

  async function pickFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).slice(0, MAX_FILES - uploads.length);
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      if (file.size > MAX_BYTES) {
        setUploads((u) => [...u, { key, name: file.name, error: t('10 MB dan katta') }]);
        continue;
      }
      setUploads((u) => [...u, { key, name: file.name }]);
      try {
        const res = await dealsService.upload('RequestShop', rsId, file);
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, id: res.id } : x)));
      } catch (error) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: getErrorMessage(error) } : x)));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deliver(p: PendingMessage) {
    setPending((all) => all.map((x) => (x.clientId === p.clientId ? { ...x, state: 'sending', error: undefined } : x)));
    try {
      await dealsService.send(rsId, { body: p.body || undefined, attachmentIds: p.attachmentIds, clientId: p.clientId, asClarification: p.asClarification || undefined });
      await queryClient.invalidateQueries({ queryKey: ['chat', rsId] });
      setPending((all) => all.filter((x) => x.clientId !== p.clientId));
      atBottom.current = true;
      onActivity?.();
    } catch (error) {
      setPending((all) => all.map((x) => (x.clientId === p.clientId ? { ...x, state: 'failed', error: getErrorMessage(error) } : x)));
    }
  }

  function submit() {
    const body = text.trim();
    const ready = uploads.filter((u) => u.id);
    if ((!body && ready.length === 0) || uploads.some((u) => !u.id && !u.error)) return;
    const p: PendingMessage = { clientId: crypto.randomUUID(), body, attachmentIds: ready.map((u) => u.id!), files: ready.map((u) => u.name), asClarification, state: 'sending', createdAt: new Date().toISOString() };
    setPending((all) => [...all, p]);
    setText('');
    setUploads([]);
    setAsClarification(false);
    atBottom.current = true;
    void deliver(p);
  }

  const uploading = uploads.some((u) => !u.id && !u.error);
  return (
    <section className="qs-chat" aria-label={t('Yozishma')}>
      <div className="qs-chat__context">{context}</div>
      <div className="qs-chat__stream" ref={streamRef} onScroll={onScroll} aria-live="polite">
        {messages.isLoading && <Spinner />}
        {!messages.isLoading && items.length === 0 && <p className="qs-muted qs-text-center">{t('Hali xabar yo‘q. Savolingizni yozing.')}</p>}
        {items.map((item) => {
          if (item.kind === 'visit') return <SiteVisitCard key={`v-${item.visit.id}`} visit={item.visit} rsId={rsId} side={side} onChanged={() => { void queryClient.invalidateQueries({ queryKey: ['chat', rsId] }); onActivity?.(); }} />;
          if (item.kind === 'pending') {
            const p = item.p;
            return (
              <div key={p.clientId} className={cx('qs-msg', 'is-mine', p.state === 'failed' && 'is-failed')}>
                {p.body}
                {p.files.length > 0 && <div className="qs-msg__files">{p.files.map((f) => <span key={f}><Paperclip size={13} /> {f}</span>)}</div>}
                <div className="qs-msg__meta">
                  {p.state === 'sending' ? t('Yuborilmoqda…') : <>{p.error} · <Button variant="link" onClick={() => void deliver(p)}>{t('Qayta yuborish')}</Button></>}
                </div>
              </div>
            );
          }
          const m = item.msg;
          if (m.senderSide === 'SYSTEM') return <div key={m.id} className="qs-msg--system">{SYSTEM_ICON[m.systemKind ?? ''] ?? <Info size={13} />} {m.body} · {formatTime(m.createdAt)}</div>;
          return (
            <div key={m.id} className={cx('qs-msg', m.mine && 'is-mine')}>
              {m.systemKind === 'FIX_REQUEST' && <strong><AlertTriangle size={13} /> {t('Tuzatish so‘raldi')}</strong>}
              {m.body}
              {m.attachments.length > 0 && <div className="qs-msg__files">{m.attachments.map((f) => <AttachmentView key={f.id} file={f} />)}</div>}
              <div className="qs-msg__meta">
                <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>{formatTime(m.createdAt)}</time>
                {m.mine && (m.readAt ? <span title={t('O‘qildi')}><CheckCheck size={13} /> {t('O‘qildi')}</span> : <span>{t('Yuborildi')}</span>)}
              </div>
            </div>
          );
        })}
        {newCount > 0 && <button type="button" className="qs-chat__new" onClick={toBottom}>{t('{n} ta yangi xabar ↓', { n: newCount })}</button>}
      </div>
      {canWrite && (
        <div className="qs-chat__composer">
          {uploads.length > 0 && (
            <div className="qs-chat__pending">
              {uploads.map((u) => (
                <span key={u.key}>
                  {!u.id && !u.error ? <Spinner size="sm" /> : <Paperclip size={13} />} {u.name}{u.error ? ` — ${u.error}` : ''}
                  <button type="button" aria-label={t('Olib tashlash')} onClick={() => setUploads((all) => all.filter((x) => x.key !== u.key))}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="qs-chat__composer-row">
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
            <Button variant="ghost" size="sm" aria-label={t('Fayl biriktirish')} disabled={uploads.length >= MAX_FILES} onClick={() => fileRef.current?.click()}><Paperclip size={17} /></Button>
            <textarea
              aria-label={t('Xabar')}
              placeholder={t('Xabar yozing…')}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button aria-label={t('Yuborish')} disabled={uploading || (!text.trim() && !uploads.some((u) => u.id))} onClick={submit}><Send size={17} /></Button>
          </div>
          {side === 'SHOP' && (
            <div className="qs-page__actions">
              {canAsk && <label className="qs-check"><input type="checkbox" checked={asClarification} onChange={(e) => setAsClarification(e.target.checked)} /> {t('Savol sifatida (javob kutiladi)')}</label>}
              <Button size="sm" variant="secondary" onClick={() => setProposeOpen(true)}><CalendarClock size={15} /> {t('O‘lchov vaqtini taklif qilish')}</Button>
            </div>
          )}
        </div>
      )}
      {side === 'SHOP' && <ProposeVisitModal open={proposeOpen} rsId={rsId} onClose={() => setProposeOpen(false)} onDone={() => onActivity?.()} />}
    </section>
  );
}
