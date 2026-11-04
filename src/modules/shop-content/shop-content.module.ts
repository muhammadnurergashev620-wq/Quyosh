import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CalcModule } from '../calc/calc.module';
import { OtpModule } from '../otp/otp.module';
import { QuoteRequestModule } from '../quote-request/quote-request.module';
import { ShopContentService } from './shop-content.service';
import { WidgetService } from './widget.service';
import { AdminShopBadgesController, ManageShopContentController, PublicShopContentController } from './shop-content.controller';

/** Portfolio, do‘kon belgilari va vidjet (TZ 4.11, 4.15, 7.3). */
@Module({
  imports: [MediaModule, CalcModule, OtpModule, QuoteRequestModule],
  controllers: [ManageShopContentController, PublicShopContentController, AdminShopBadgesController],
  providers: [ShopContentService, WidgetService],
  exports: [ShopContentService],
})
export class ShopContentModule {}
