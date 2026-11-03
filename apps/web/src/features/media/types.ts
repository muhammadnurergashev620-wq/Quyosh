import type { LinkTargetType, MediaAssetKind, MediaAssetStatus } from '@/types/common';

export interface MediaAsset {
  id: string;
  uploaderId: string;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  originalName: string;
  declaredMimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  scanResult: string | null;
  rejectionReason: string | null;
  linkedResourceType: LinkTargetType | null;
  linkedResourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignedUrlResult {
  url: string;
  expiresIn: number;
}

export type MediaVariant = 'original' | 'thumbnail' | 'medium';

export const MEDIA_PENDING_STATUSES: readonly MediaAssetStatus[] = [
  'UPLOADING',
  'QUARANTINED',
  'SCANNING',
  'PROCESSING',
];
