/** Serverdagi yuklash chegarasi (MB) — undan katta fayl yuborilmaydi. */
export const MAX_UPLOAD_MB = 11;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const MAX_SIDE = 2560;
const SKIP_COMPRESS_BELOW = 1.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-load'));
    };
    image.src = url;
  });
}

/**
 * Telefon kamerasidan olingan katta rasmlar serverdagi chegaradan oshib ketmasligi uchun JPEG'ga o‘tkazib kichraytiriladi.
 * Kichik rasm, GIF/SVG, video yoki o‘qib bo‘lmaydigan fayl o‘zgarishsiz qaytariladi.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size <= SKIP_COMPRESS_BELOW) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
