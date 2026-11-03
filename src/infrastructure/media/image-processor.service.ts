import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ERRORS } from '../../common/constants/error-messages';

export interface ProcessedImage {
  thumbnail: Buffer;
  medium: Buffer;
  contentType: string;
}

const THUMBNAIL_SIZE = 200;
const MEDIUM_SIZE = 800;

@Injectable()
/** Faqat ko‘rish uchun kichik nusxalar (thumbnail/medium) yasaydi; asl fayl hech qachon o‘zgartirilmaydi. */
export class ImageProcessorService {
  async process(input: Buffer): Promise<ProcessedImage> {
    const pipeline = sharp(input, { failOn: 'error' });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(ERRORS.IMAGE_DIMENSIONS_UNKNOWN);
    }

    const thumbnail = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const medium = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: MEDIUM_SIZE, height: MEDIUM_SIZE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { thumbnail, medium, contentType: 'image/jpeg' };
  }
}
