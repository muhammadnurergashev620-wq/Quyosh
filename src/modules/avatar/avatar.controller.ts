import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { pipeline, type Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AvatarService } from './avatar.service';

class AvatarPermissionDto {
  @IsBoolean()
  allowed!: boolean;
}

const upload = () => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

@Controller()
export class AvatarController {
  constructor(
    private readonly avatars: AvatarService,
    private readonly storage: StorageService,
  ) {}

  /** Ommaviy rasm (versiyalangan manzil — fayl id'si o‘zgarsa, manzil ham o‘zgaradi, shuning uchun uzoq keshlanadi). */
  @Public()
  @Get('avatars/:assetId')
  async stream(@Param('assetId', ParseUUIDPipe) assetId: string, @Query('s') size: string, @Req() req: Request, @Res() res: Response) {
    const key = await this.avatars.resolve(assetId, size === 'thumb' ? 'thumb' : 'medium');
    const object = await this.storage.getObjectStream(key);
    res.status(200);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (object.contentLength !== undefined) res.setHeader('Content-Length', String(object.contentLength));
    const body = object.body as Readable;
    const release = () => {
      if (!body.destroyed) body.destroy();
    };
    if (res.destroyed || res.writableEnded) return release();
    res.once('close', release);
    req.once('aborted', release);
    pipeline(body, res, release);
  }

  @Post('users/me/avatar')
  @UseInterceptors(upload())
  setMine(@CurrentUser('sub') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.avatars.upload(userId, userId, file);
  }

  @Delete('users/me/avatar')
  removeMine(@CurrentUser('sub') userId: string) {
    return this.avatars.remove(userId, userId);
  }

  @Roles(Role.ADMIN)
  @RequiresPermission('USERS')
  @Post('admin/users/:id/avatar')
  @UseInterceptors(upload())
  setFor(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.avatars.upload(adminId, id, file);
  }

  @Roles(Role.ADMIN)
  @RequiresPermission('USERS')
  @Delete('admin/users/:id/avatar')
  removeFor(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Query('reason') reason?: string) {
    return this.avatars.remove(adminId, id, reason?.slice(0, 300));
  }

  /** Faqat superadmin: admin akkaunt o‘ziga rasm qo‘ya olishini yoqish/o‘chirish. */
  @Roles(Role.ADMIN)
  @Patch('admin/admins/:id/avatar-permission')
  setPermission(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AvatarPermissionDto) {
    return this.avatars.setAdminPermission(adminId, id, dto.allowed);
  }
}
