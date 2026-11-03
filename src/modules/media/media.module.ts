import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaProcessingModule } from '../../infrastructure/media/media-processing.module';

@Module({
  imports: [StorageModule, MediaProcessingModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
