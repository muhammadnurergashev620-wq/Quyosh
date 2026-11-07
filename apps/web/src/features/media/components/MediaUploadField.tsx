import { Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import type { LinkTargetType, MediaAssetKind } from '@/types/common';
import { useMediaStatus, useUploadMedia } from '../hooks/useMedia';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, prepareUpload } from '../prepare-image';
import { MediaThumbnail } from './MediaThumbnail';
import './MediaUploadField.css';
import { t } from '@/i18n';
import { formatDecimal } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  UPLOADING: t('Yuklanmoqda'),
  QUARANTINED: t('Navbatda'),
  SCANNING: t('Tekshirilmoqda'),
  PROCESSING: t('Qayta ishlanmoqda'),
  READY: t('Tayyor'),
  REJECTED: t('Rad etildi'),
  FAILED: t('Xatolik'),
};
const STATUS_TONE: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
  UPLOADING: 'neutral',
  QUARANTINED: 'neutral',
  SCANNING: 'warning',
  PROCESSING: 'warning',
  READY: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
};

export interface MediaUploadFieldProps {
  label: string;
  accept?: string;
  kind: MediaAssetKind;
  linkType: LinkTargetType;
  linkId: string;
  onReady?: (mediaAssetId: string) => void;
}

export function MediaUploadField({ label, accept = 'image/*,video/*', kind, linkType, linkId, onReady }: MediaUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const notifiedAssetIdRef = useRef<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState('');

  const upload = useUploadMedia();
  const status = useMediaStatus(assetId);

  const currentStatus = status.data?.status;
  useEffect(() => {
    if (currentStatus === 'READY' && assetId && notifiedAssetIdRef.current !== assetId) {
      notifiedAssetIdRef.current = assetId;
      onReady?.(assetId);
    }
    // onReady is a parent-supplied callback whose identity changes every render;
    // the ref guard above (not the dependency array) is what prevents re-notifying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus, assetId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    setLocalError('');
    setPreparing(true);
    const file = await prepareUpload(picked);
    setPreparing(false);
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(t('Fayl juda katta: {size} MB. Eng ko‘pi bilan {max} MB yuklash mumkin.', { size: formatDecimal(file.size / 1024 / 1024, 1), max: MAX_UPLOAD_MB }));
      return;
    }
    upload.mutate(
      { file, kind, linkType, linkId },
      { onSuccess: (asset) => setAssetId(asset.id) },
    );
  }

  return (
    <div className="gm-media-upload">
      <label htmlFor={inputId} className="gm-field__label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={(e) => void handleFileChange(e)}
        className="gm-visually-hidden"
      />
      <Button type="button" variant="secondary" className="gm-media-upload__pick" loading={upload.isPending || preparing} onClick={() => inputRef.current?.click()}>
        <Upload size={18} />{' '}{t('Fayl tanlash')}</Button>

      {localError && <Alert tone="danger">{localError}</Alert>}
      {upload.isError && <Alert tone="danger">{getErrorMessage(upload.error)}</Alert>}

      {assetId && currentStatus && (
        <div className="gm-media-upload__result">
          {currentStatus === 'READY' ? (
            <MediaThumbnail assetId={assetId} alt={label} />
          ) : (
            <Badge tone={STATUS_TONE[currentStatus]}>{STATUS_LABEL[currentStatus]}</Badge>
          )}
          {(currentStatus === 'REJECTED' || currentStatus === 'FAILED') && status.data?.rejectionReason && (
            <p className="gm-media-upload__reason">{status.data.rejectionReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
