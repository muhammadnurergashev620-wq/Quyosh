import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaModule } from '../media/media.module';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

@Module({
  imports: [StorageModule, MediaModule],
  controllers: [AvatarController],
  providers: [AvatarService],
})
export class AvatarModule {}
