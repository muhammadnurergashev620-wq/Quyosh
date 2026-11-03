import { Global, Module } from '@nestjs/common';
import { ScannerService } from '../scanner/scanner.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaProcessingService } from './media-processing.service';
import { MediaCleanupService } from './media-cleanup.service';

@Global()
@Module({
  providers: [ScannerService, ImageProcessorService, MediaProcessingService, MediaCleanupService],
  exports: [MediaProcessingService],
})
export class MediaProcessingModule {}
