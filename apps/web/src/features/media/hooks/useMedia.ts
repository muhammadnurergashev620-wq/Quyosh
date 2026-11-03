import { useMutation, useQuery } from '@tanstack/react-query';
import { mediaService } from '../services/media.service';
import { MEDIA_PENDING_STATUSES, type MediaVariant } from '../types';
import type { LinkTargetType, MediaAssetKind } from '@/types/common';

export function useUploadMedia() {
  return useMutation({
    mutationFn: ({
      file,
      kind,
      linkType,
      linkId,
    }: {
      file: File;
      kind: MediaAssetKind;
      linkType: LinkTargetType;
      linkId: string;
    }) => mediaService.upload(file, kind, linkType, linkId),
  });
}

export function useMediaStatus(id: string | null) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getStatus(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && MEDIA_PENDING_STATUSES.includes(status) ? 1500 : false;
    },
  });
}

export function useMediaSignedUrl(id: string | null, variant: MediaVariant, ready: boolean) {
  return useQuery({
    queryKey: ['media', id, variant],
    queryFn: () => mediaService.getSignedUrl(id as string, variant),
    enabled: !!id && ready,
    staleTime: 0,
    gcTime: 0,
  });
}
