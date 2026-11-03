import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CalcModule } from '../calc/calc.module';
import { OtpModule } from '../otp/otp.module';
import { QuoteRequestModule } from '../quote-request/quote-request.module';
import { ShopContentService } from './shop-content.service';
import { WidgetService } from './widget.service';
import { AdminCertificationsController, ManageShopContentController, PublicShopContentController } from './shop-content.controller';

/** Portfolio, sertifikatlar va vidjet (TZ 4.11, 4.15, 7.3). */
@Module({
  imports: [MediaModule, CalcModule, OtpModule, QuoteRequestModule],
  controllers: [ManageShopContentController, PublicShopContentController, AdminCertificationsController],
  providers: [ShopContentService, WidgetService],
  exports: [ShopContentService],
})
export class ShopContentModule {}
