import { apiGet, apiUpload } from '@/services/api.client';
import type { LinkTargetType, MediaAssetKind } from '@/types/common';
import type { MediaAsset, MediaVariant, SignedUrlResult } from '../types';

export const mediaService = {
  upload(file: File, kind: MediaAssetKind, linkType: LinkTargetType, linkId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    form.append('linkType', linkType);
    form.append('linkId', linkId);
    return apiUpload<MediaAsset>('/media/uploads', form);
  },
  getStatus(id: string) {
    return apiGet<MediaAsset>(`/media/${id}`);
  },
  getSignedUrl(id: string, variant: MediaVariant) {
    return apiGet<SignedUrlResult>(`/media/${id}/${variant}`);
  },
};
