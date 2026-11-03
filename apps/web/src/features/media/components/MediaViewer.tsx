import { useEffect, useState } from 'react';
import { cx } from '@/lib/utils';
import { fixFilename, formatBytes, formatMime } from '../file-info';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useMediaSignedUrl, useMediaStatus } from '../hooks/useMedia';
import { MediaThumbnail } from './MediaThumbnail';
import './MediaViewer.css';
import { t } from '@/i18n';

/** Kichik rasm; bosilganda faylning asl (to‘liq) nusxasi katta oynada ochiladi. */
export function MediaViewer({ assetId, alt, label = 'Fayl', size = 'md' }: { assetId: string; alt: string; label?: string; size?: 'md' | 'lg' }) {
  const [open, setOpen] = useState(false);
  const original = useMediaSignedUrl(assetId, 'original', open);
  const [asVideo, setAsVideo] = useState(false);
  // Brauzer asl formatni (masalan, HEIC) ko‘rsata olmasa, ko‘rish uchun JPEG nusxa ishlatiladi; yuklab olish esa doim asl fayl.
  const [useMedium, setUseMedium] = useState(false);
  const preview = useMediaSignedUrl(assetId, 'medium', open && useMedium);
  const [broken, setBroken] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const info = useMediaStatus(open ? assetId : null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const url = original.data?.url;
  useEffect(() => {
    if (useMedium && preview.isError) setAsVideo(true);
  }, [useMedium, preview.isError]);
  const shown = useMedium ? preview.data?.url : url;

  return (
    <>
      <button type="button" className={size === 'lg' ? 'gm-mviewer__open gm-mviewer__open--lg' : 'gm-mviewer__open'} onClick={() => setOpen(true)} aria-label={t('{label}ni to‘liq ochish', { label })}>
        <MediaThumbnail assetId={assetId} alt={alt} variant={size === 'lg' ? 'medium' : 'thumbnail'} />
        <span className="gm-mviewer__hint">{t('To‘liq ochish')}</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        wide
        footer={
          url ? (
            <>
              <a href={url} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink size={16} />{' '}{t('Yangi oynada')}</Button>
              </a>
              <a href={url} download>
                <Button>
                  <Download size={16} />{' '}{t('Yuklab olish')}</Button>
              </a>
            </>
          ) : undefined
        }
      >
        <div className="gm-mviewer__stage">
          {original.isLoading && <Spinner />}
          {original.isError && <p>{t('Faylni yuklab bo‘lmadi.')}</p>}
          {url && !broken && !asVideo && (
            <div className={cx('gm-mviewer__frame', zoomed && 'gm-mviewer__frame--zoomed')}>
              <img
                src={shown}
                alt={alt}
                className={cx('gm-mviewer__img', zoomed && 'gm-mviewer__img--actual')}
                onClick={() => setZoomed((value) => !value)}
                onLoad={(event) => setDims({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
                onError={() => (useMedium ? setAsVideo(true) : setUseMedium(true))}
              />
            </div>
          )}
          {url && !broken && (
            <p className="gm-mviewer__meta">
              {info.data && (
                <>
                  <strong>{fixFilename(info.data.originalName)}</strong> · {formatMime(info.data.detectedMimeType ?? info.data.declaredMimeType)} · {formatBytes(info.data.sizeBytes)}
                </>
              )}
              {!asVideo && dims && (
                <>{t('{p} {w} × {h} px ·', { p: info.data && ' · ', w: dims.w, h: dims.h })}{' '}{zoomed ? t('sig‘dirish uchun rasmni bosing') : t('rasm asl o‘lchamida; kattaroq bo‘lsa, bosib to‘liq ko‘ring')}
                </>
              )}
            </p>
          )}
          {url && !broken && asVideo && <video src={url} controls className="gm-mviewer__img gm-mviewer__img--video" onError={() => setBroken(true)} />}
          {url && broken && (
            <p className="gm-mviewer__file">
              <FileText size={28} aria-hidden="true" />{' '}{t('Bu fayl brauzerda ko‘rsatilmaydi. Yuqoridagi tugmalar orqali oching yoki yuklab oling.')}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
