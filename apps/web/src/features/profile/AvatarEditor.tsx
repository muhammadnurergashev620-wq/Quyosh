import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/common/UserAvatar';
import { apiDelete, apiUpload } from '@/services/api.client';
import { getErrorMessage } from '@/lib/error-messages';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '@/lib/avatar';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import './AvatarEditor.css';

interface AvatarEditorProps {
  name: string;
  seed: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Boshqa foydalanuvchining rasmini admin o‘zgartirganda — o‘sha foydalanuvchi id'si. Bo‘sh bo‘lsa — o‘z profili. */
  targetUserId?: string;
  /** Rasm o‘zgartirish mumkinmi (admin akkaunt uchun superadmin ruxsatiga bog‘liq). */
  canEdit: boolean;
  /** Rasm o‘zgartirib bo‘lmasa, nima uchun (matn tooltipda ko‘rsatiladi). */
  lockedHint?: string;
}

/** Profil rasmi: avatar ustida kamera (yuklash/almashtirish) va o‘chirish tugmalari. Fayl turi va hajmi yuklashdan oldin tekshiriladi. */
export function AvatarEditor({ name, seed, src, size = 'lg', targetUserId, canEdit, lockedHint }: AvatarEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const base = targetUserId ? `/admin/users/${targetUserId}/avatar` : '/users/me/avatar';

  const refresh = () => queryClient.invalidateQueries();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload<{ avatar: string }>(base, form);
    },
    onSuccess: () => {
      void refresh();
      pushToast(t('Profil rasmi yangilandi'), 'success');
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => apiDelete<{ avatar: null }>(base),
    onSuccess: () => {
      void refresh();
      pushToast(t('Profil rasmi olib tashlandi'), 'success');
    },
    onError: (error) => pushToast(getErrorMessage(error), 'error'),
  });

  const onPick = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return pushToast(t('Faqat JPEG, PNG yoki WebP rasm yuklang'), 'error');
    if (file.size > AVATAR_MAX_BYTES) return pushToast(t('Rasm hajmi 5 MB dan oshmasligi kerak'), 'error');
    upload.mutate(file);
  };

  const busy = upload.isPending || remove.isPending;
  return (
    <span className={`gm-avedit gm-avedit--${size}${busy ? ' is-busy' : ''}`}>
      <UserAvatar name={name} seed={seed} size={size} src={src} />
      {canEdit ? (
        <>
          <input ref={input} type="file" accept={AVATAR_TYPES.join(',')} hidden onChange={(event) => onPick(event.target.files?.[0])} />
          <button type="button" className="gm-avedit__btn gm-avedit__btn--edit" onClick={() => input.current?.click()} disabled={busy} aria-label={src ? t('Rasmni almashtirish') : t('Rasm yuklash')} title={src ? t('Rasmni almashtirish') : t('Rasm yuklash')}>
            <Camera size={14} aria-hidden="true" />
          </button>
          {src && (
            <button type="button" className="gm-avedit__btn gm-avedit__btn--remove" onClick={() => remove.mutate()} disabled={busy} aria-label={t('Rasmni olib tashlash')} title={t('Rasmni olib tashlash')}>
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}
        </>
      ) : lockedHint ? (
        <span className="gm-visually-hidden">{lockedHint}</span>
      ) : null}
    </span>
  );
}
