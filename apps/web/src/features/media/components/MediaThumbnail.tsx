import { Skeleton } from '@/components/ui/Skeleton';
import { useMediaSignedUrl } from '../hooks/useMedia';
import './MediaThumbnail.css';

export function MediaThumbnail({ assetId, alt, variant = 'thumbnail' }: { assetId: string; alt: string; variant?: 'thumbnail' | 'medium' }) {
  const signedUrl = useMediaSignedUrl(assetId, variant, true);

  if (signedUrl.isLoading) return <Skeleton className="gm-media-thumb" />;
  if (signedUrl.isError || !signedUrl.data) return null;

  return <img className="gm-media-thumb" src={signedUrl.data.url} alt={alt} />;
}
