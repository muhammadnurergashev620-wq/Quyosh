import { useState } from 'react';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatTime } from '@/lib/format';
import { t } from '@/i18n';
import { dealsService } from '../deals.service';
import type { Side, SiteVisit } from '../types';

const STATUS: Record<SiteVisit['status'], { label: string; tone: 'primary' | 'success' | 'neutral' }> = {
  PROPOSED: { label: t('Vaqt taklif qilindi'), tone: 'primary' },
  CONFIRMED: { label: t('Tasdiqlangan'), tone: 'success' },
  DONE: { label: t('Bajarildi'), tone: 'success' },
  CANCELLED: { label: t('Bekor qilingan'), tone: 'neutral' },
};

export const slotText = (slot: { start: string; end: string }) => `${formatDateTime(slot.start)}–${formatTime(slot.end)}`;

/** U9.4: o‘lchov uchrashuvi kartasi (chatda). Mijoz vaqt tanlaydi — tasdiqlash kontaktni ochadi. */
export function SiteVisitCard({ visit, rsId, side, onChanged }: { visit: SiteVisit; rsId: string; side: Side; onChanged: () => void }) {
  const [slot, setSlot] = useState<number | null>(null);
  const [reasonFor, setReasonFor] = useState<'CANCEL' | 'REQUEST_OTHER' | null>(null);
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: (body: Parameters<typeof dealsService.updateVisit>[2]) => dealsService.updateVisit(rsId, visit.id, body),
    onSuccess: () => {
      setReasonFor(null);
      setReason('');
      onChanged();
    },
  });
  const status = STATUS[visit.status];
  return (
    <div className="qs-visit" aria-label={t('O‘lchov uchrashuvi')}>
      <header><CalendarClock size={16} /> {t('O‘lchov uchrashuvi')} <Badge tone={status.tone}>{status.label}</Badge></header>
      {visit.status === 'PROPOSED' && (
        <>
          <div className="qs-visit__slots" role="radiogroup" aria-label={t('Vaqt oralig‘i')}>
            {visit.proposedSlotsJson.map((s, i) => (
              <label key={s.start} className={slot === i ? 'is-on' : undefined}>
                {side === 'CUSTOMER' && <input type="radio" name={`slot-${visit.id}`} checked={slot === i} onChange={() => setSlot(i)} />}
                {slotText(s)}
              </label>
            ))}
          </div>
          {visit.notes && <small className="qs-muted">{visit.notes}</small>}
          {side === 'CUSTOMER' ? (
            <>
              <small className="qs-muted">{t('Tasdiqlasangiz, kontaktingiz (telefon va aniq manzil) do‘konga ochiladi.')}</small>
              <div className="qs-page__actions">
                <Button size="sm" disabled={slot === null} loading={act.isPending} onClick={() => slot !== null && act.mutate({ action: 'CONFIRM', slotIndex: slot })}>{t('Tasdiqlash')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setReasonFor('REQUEST_OTHER')}>{t('Boshqa vaqt taklif qilish')}</Button>
              </div>
            </>
          ) : (
            <div className="qs-page__actions"><Button size="sm" variant="ghost" onClick={() => setReasonFor('CANCEL')}>{t('Bekor qilish')}</Button></div>
          )}
        </>
      )}
      {visit.status === 'CONFIRMED' && visit.confirmedStart && (
        <>
          <strong className="qs-num">{slotText({ start: visit.confirmedStart, end: visit.confirmedEnd ?? visit.confirmedStart })}</strong>
          <div className="qs-page__actions">
            <Button size="sm" variant="secondary" onClick={() => void dealsService.visitIcs(rsId, visit.id)}><CalendarPlus size={15} /> {t('Kalendarga qo‘shish')}</Button>
            {side === 'SHOP' && <Button size="sm" variant="secondary" loading={act.isPending} onClick={() => act.mutate({ action: 'DONE' })}>{t('O‘lchov bajarildi')}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setReasonFor('CANCEL')}>{t('Bekor qilish')}</Button>
          </div>
        </>
      )}
      {visit.status === 'CANCELLED' && visit.cancelReason && visit.cancelReason !== 'REPLACED' && <small className="qs-muted">{visit.cancelReason === 'OTHER_TIME' ? t('Mijoz boshqa vaqt so‘radi') : visit.cancelReason}</small>}
      {act.isError && <Alert tone="danger">{getErrorMessage(act.error)}</Alert>}
      <Modal
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor === 'CANCEL' ? t('O‘lchovni bekor qilish') : t('Boshqa vaqt so‘rash')}
        footer={<Button loading={act.isPending} disabled={reasonFor === 'CANCEL' && !reason.trim()} onClick={() => reasonFor && act.mutate({ action: reasonFor, reason: reason.trim() || undefined })}>{t('Yuborish')}</Button>}
      >
        <Textarea label={reasonFor === 'CANCEL' ? t('Sabab') : t('Sizga qulay vaqt (ixtiyoriy)')} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} required={reasonFor === 'CANCEL'} />
      </Modal>
    </div>
  );
}

/** Do‘kon: 1–3 ta vaqt oralig‘ini taklif qilish. */
export function ProposeVisitModal({ open, rsId, onClose, onDone }: { open: boolean; rsId: string; onClose: () => void; onDone: () => void }) {
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date(Date.now() + 86_400_000));
  const [slots, setSlots] = useState([{ date: tomorrow, from: '10:00', to: '12:00' }]);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();
  const propose = useMutation({
    mutationFn: () => dealsService.proposeVisit(rsId, slots.map((s) => ({ start: new Date(`${s.date}T${s.from}:00+05:00`).toISOString(), end: new Date(`${s.date}T${s.to}:00+05:00`).toISOString() })), notes.trim() || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', rsId] });
      onDone();
      onClose();
    },
  });
  const set = (i: number, patch: Partial<(typeof slots)[number]>) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <Modal open={open} onClose={onClose} title={t('O‘lchov vaqtini taklif qilish')} footer={<Button loading={propose.isPending} onClick={() => propose.mutate()}>{t('Taklif qilish')}</Button>}>
      <div className="qs-form">
        {slots.map((s, i) => (
          <div className="qs-form__row" key={i}>
            <Input label={t('Sana')} type="date" value={s.date} min={tomorrow} onChange={(e) => set(i, { date: e.target.value })} />
            <Input label={t('Dan')} type="time" value={s.from} onChange={(e) => set(i, { from: e.target.value })} />
            <Input label={t('Gacha')} type="time" value={s.to} onChange={(e) => set(i, { to: e.target.value })} />
          </div>
        ))}
        {slots.length < 3 && <Button variant="ghost" size="sm" onClick={() => setSlots((all) => { const last = all[all.length - 1]!; const next = new Date(`${last.date}T12:00:00+05:00`); next.setDate(next.getDate() + 1); return [...all, { ...last, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(next) }]; })}>{t('Yana vaqt qo‘shish')}</Button>}
        <Textarea label={t('Izoh (ixtiyoriy)')} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        {propose.isError && <Alert tone="danger">{getErrorMessage(propose.error)}</Alert>}
      </div>
    </Modal>
  );
}
