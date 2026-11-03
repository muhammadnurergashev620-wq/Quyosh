import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { BadRequestException, Body, Controller, Get, Param, Query, Req, Res, ParseEnumPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { pipeline, type Readable } from 'node:stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { ERRORS } from '../../common/constants/error-messages';
import { decodeFilename } from '../../common/utils/filename';

// Multer yuqori chegarasi: qisqa video (40 MB) uchun; rasm va boshqa fayllar uchun aniq chegara xizmat ichida tekshiriladi.
const HARD_UPLOAD_LIMIT_BYTES = 41 * 1024 * 1024;

const MEDIA_VARIANTS = { original: 'original', thumbnail: 'thumbnail', medium: 'medium' } as const;
type MediaVariant = keyof typeof MEDIA_VARIANTS;

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
  ) {}

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: HARD_UPLOAD_LIMIT_BYTES } }),
  )
  upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: InitiateUploadDto,
  ) {
    if (!file) throw new BadRequestException(ERRORS.FILE_REQUIRED);
    return this.mediaService.initiateUpload(
      userId,
      { buffer: file.buffer, originalname: decodeFilename(file.originalname), mimetype: file.mimetype, size: file.size },
      dto.kind,
      { type: dto.linkType, id: dto.linkId },
    );
  }

  @Get(':id')
  getStatus(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: Role[],
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mediaService.getStatus(userId, roles, id);
  }

  /** Imzolangan havola bilan faylni API orqali uzatadi (Range qo‘llab-quvvatlanadi: audio/video surish uchun). */
  @Public()
  @Get('file/:id/:variant')
  async streamFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variant', new ParseEnumPipe(MEDIA_VARIANTS)) variant: MediaVariant,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.mediaService.resolveStream(id, variant, Number(expires), sig);
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const object = await this.storage.getObjectStream(file.key, range);
    res.status(range && object.contentRange ? 206 : 200);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    // Foydalanuvchi yuklagan fayl: brauzerda skript bajarilmasin (sandbox) va tur o‘zgartirilmasin.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    if (object.contentLength !== undefined) res.setHeader('Content-Length', String(object.contentLength));
    if (object.contentRange) res.setHeader('Content-Range', object.contentRange);
    // Mijoz uzilsa (video surish, sahifadan chiqish) saqlash oqimi yopiladi, aks holda ulanishlar to‘lib, keyingi fayllar ochilmay qoladi.
    const body = object.body as Readable;
    const release = () => {
      if (!body.destroyed) body.destroy();
    };
    // Mijoz uzilgan bo‘lishi mumkin (pipeline ishga tushmasdan oldin ham): oqimni darhol yopamiz.
    if (res.destroyed || res.writableEnded) return release();
    res.once('close', release);
    req.once('aborted', release);
    pipeline(body, res, release);
  }

  @Get(':id/:variant')
  getSignedUrl(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: Role[],
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variant', new ParseEnumPipe(MEDIA_VARIANTS)) variant: MediaVariant,
    @Req() req: Request,
  ) {
    const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
    const host = String(req.headers['x-forwarded-host'] ?? req.get('host')).split(',')[0];
    return this.mediaService.getSignedUrl(userId, roles, id, variant, `${proto}://${host}`);
  }
}
