import { Module } from '@nestjs/common';
import { QuoteRequestModule } from '../quote-request/quote-request.module';
import { InstalledSystemService } from './installed-system.service';
import { InstalledSystemController } from './installed-system.controller';

/** Montajdan keyingi kabinet (TZ 3.6, U10.5). */
@Module({
  imports: [QuoteRequestModule],
  controllers: [InstalledSystemController],
  providers: [InstalledSystemService],
  exports: [InstalledSystemService],
})
export class InstalledSystemModule {}
