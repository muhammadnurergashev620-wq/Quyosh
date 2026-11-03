export const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'audio/ogg': ['.ogg'],
  'audio/mp4': ['.m4a'],
  'audio/mpeg': ['.mp3'],
  // Ovozli xabar: brauzer MediaRecorder .webm (Opus) yoki .m4a beradi; file-type webm'ni video/webm deb aniqlaydi.
  'video/webm': ['.webm'],
  'audio/webm': ['.webm'],
  'audio/x-m4a': ['.m4a'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const ALLOWED_MIME_TYPES = new Set(Object.keys(EXTENSIONS_BY_MIME));
