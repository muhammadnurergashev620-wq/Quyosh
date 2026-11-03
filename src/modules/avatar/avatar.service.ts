import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { MediaProcessingService } from '../../infrastructure/media/media-processing.service';
import { MediaService } from '../media/media.service';
import { ERRORS } from '../../common/constants/error-messages';
import { avatarPath } from '../../common/utils/avatar';

/** Profil rasmi: faqat rasm (JPEG/PNG/WebP), eng ko‘pi bilan 5 MB. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class AvatarService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly processing: MediaProcessingService,
  ) {}

  /**
   * Kim kimning rasmini o‘zgartira oladi:
   *  - oddiy foydalanuvchi va usta — o‘zining rasmini;
   *  - admin akkaunt — faqat superadmin ruxsat bergan bo‘lsa (yoki o‘zi superadmin bo‘lsa);
   *  - admin (USERS huquqi bilan) — mijoz va ustalarning rasmini; admin akkauntlarning rasmini faqat superadmin.
   */
  private async assertCanChange(actorId: string, targetId: string) {
    const [actor, target] = await Promise.all([
      this.db.user.findUnique({ where: { id: actorId }, select: { id: true, isSuperAdmin: true, userRoles: { select: { role: true } } } }),
      this.db.user.findUnique({ where: { id: targetId }, select: { id: true, deletedAt: true, isSuperAdmin: true, adminAvatarAllowed: true, avatarAssetId: true, userRoles: { select: { role: true } } } }),
    ]);
    if (!actor || !target || target.deletedAt) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const targetIsAdmin = target.userRoles.some((item) => item.role === Role.ADMIN);
    if (actorId === targetId) {
      if (targetIsAdmin && !target.isSuperAdmin && !target.adminAvatarAllowed) throw new ForbiddenException(ERRORS.AVATAR_ADMIN_NOT_ALLOWED);
      return target;
    }
    const actorIsAdmin = actor.userRoles.some((item) => item.role === Role.ADMIN);
    if (!actorIsAdmin) throw new ForbiddenException(ERRORS.FORBIDDEN);
    if (targetIsAdmin && !actor.isSuperAdmin) throw new ForbiddenException(ERRORS.SUPER_ADMIN_ONLY);
    return target;
  }

  /** Rasmni yuklaydi, tekshiradi (turi, hajmi, zararli kod, buzuq fayl), o‘lchamlarini tayyorlaydi va profilga qo‘yadi. */
  async upload(actorId: string, targetId: string, file: UploadedFile | undefined, reason?: string) {
    if (!file) throw new BadRequestException(ERRORS.FILE_REQUIRED);
    const target = await this.assertCanChange(actorId, targetId);
    if (file.size > MAX_AVATAR_BYTES) throw new BadRequestException(ERRORS.AVATAR_TOO_LARGE);
    if (!IMAGE_MIMES.has(file.mimetype)) throw new BadRequestException(ERRORS.AVATAR_IMAGE_ONLY);

    // Fayl egasi — rasm tegishli foydalanuvchining o‘zi (admin nomidan yuklansa ham).
    const asset = await this.media.initiateUpload(targetId, file, 'USER_AVATAR', { type: 'User', id: targetId });
    if (asset.status === 'REJECTED') throw new BadRequestException(ERRORS.AVATAR_REJECTED);
    await this.processing.process(asset.id);
    const ready = await this.db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    if (ready.status !== 'READY' || !ready.mediumKey) {
      await this.discard(asset.id);
      throw new BadRequestException(ERRORS.AVATAR_REJECTED);
    }

    const previous = target.avatarAssetId;
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { avatarAssetId: asset.id, avatarUpdatedAt: new Date() } });
      if (actorId !== targetId) {
        await tx.auditLog.create({
          data: { actorId, action: 'ADMIN_USER_AVATAR_SET', targetType: 'User', targetId, before: { avatarAssetId: previous } as Prisma.InputJsonValue, after: { avatarAssetId: asset.id } as Prisma.InputJsonValue, reason: reason ?? null },
        });
      }
    });
    if (previous) await this.discard(previous);
    return { avatar: avatarPath(asset.id) };
  }

  async remove(actorId: string, targetId: string, reason?: string) {
    const target = await this.assertCanChange(actorId, targetId);
    const previous = target.avatarAssetId;
    if (!previous) return { avatar: null };
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { avatarAssetId: null, avatarUpdatedAt: new Date() } });
      if (actorId !== targetId) {
        await tx.auditLog.create({
          data: { actorId, action: 'ADMIN_USER_AVATAR_REMOVED', targetType: 'User', targetId, before: { avatarAssetId: previous } as Prisma.InputJsonValue, reason: reason ?? null },
        });
      }
    });
    await this.discard(previous);
    return { avatar: null };
  }

  /** Superadmin: admin akkaunt o‘ziga rasm qo‘ya olishini yoqadi/o‘chiradi. O‘chirilganda mavjud rasm ham olib tashlanadi. */
  async setAdminPermission(actorId: string, targetId: string, allowed: boolean) {
    const actor = await this.db.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    if (!actor?.isSuperAdmin) throw new ForbiddenException(ERRORS.SUPER_ADMIN_ONLY);
    const target = await this.db.user.findUnique({ where: { id: targetId }, select: { id: true, isSuperAdmin: true, adminAvatarAllowed: true, avatarAssetId: true, userRoles: { select: { role: true } } } });
    if (!target || !target.userRoles.some((item) => item.role === Role.ADMIN)) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { adminAvatarAllowed: allowed } });
      await tx.auditLog.create({
        data: { actorId, action: 'ADMIN_AVATAR_PERMISSION_CHANGED', targetType: 'User', targetId, before: { adminAvatarAllowed: target.adminAvatarAllowed }, after: { adminAvatarAllowed: allowed } },
      });
    });
    return { adminAvatarAllowed: allowed };
  }

  /** Ommaviy rasm: faqat hozir biror profilga biriktirilgan va tayyor rasm beriladi (fayl id'si taxmin qilib bo‘lmaydi). */
  async resolve(assetId: string, size: 'thumb' | 'medium') {
    const owner = await this.db.user.findUnique({ where: { avatarAssetId: assetId }, select: { deletedAt: true, status: true, avatarAsset: { select: { status: true, thumbnailKey: true, mediumKey: true, kind: true } } } });
    const asset = owner?.avatarAsset;
    if (!owner || owner.deletedAt || !asset || asset.kind !== 'USER_AVATAR' || asset.status !== 'READY') throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    const key = size === 'thumb' ? (asset.thumbnailKey ?? asset.mediumKey) : asset.mediumKey;
    if (!key) throw new NotFoundException(ERRORS.MEDIA_NOT_FOUND);
    return key;
  }

  private async discard(assetId: string) {
    const asset = await this.db.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    await this.db.user.updateMany({ where: { avatarAssetId: assetId }, data: { avatarAssetId: null } });
    await this.db.mediaAsset.delete({ where: { id: assetId } }).catch(() => undefined);
    for (const key of [asset.originalKey, asset.thumbnailKey, asset.mediumKey, asset.quarantineKey]) {
      if (key) await this.storage.deleteObject(key).catch(() => undefined);
    }
  }
}
