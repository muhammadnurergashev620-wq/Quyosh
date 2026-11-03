import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT ?? '',
  region: process.env.STORAGE_REGION ?? 'us-east-1',
  bucket: process.env.STORAGE_BUCKET ?? 'quyosh-media',
  accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
  signedUrlTtlSeconds: Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? 900),
  maxUploadSizeBytes: Number(process.env.STORAGE_MAX_UPLOAD_SIZE_BYTES) || 11 * 1024 * 1024,
}));
