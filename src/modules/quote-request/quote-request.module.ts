import { Module } from '@nestjs/common';
import { QuoteRequestService } from './quote-request.service';
import { M6Notifier } from './m6-notifier.service';
import { M6JobsService } from './m6-jobs.service';
import { QuoteRequestsController, RequestShopsController, ShopRequestsController } from './quote-request.controller';
import { QuoteService } from '../quote/quote.service';
import { QuoteTemplateService } from '../quote/quote-template.service';
import { QuotesController, ShopQuotesController } from '../quote/quote.controller';
import { InstallationService } from '../installation/installation.service';
import { AdminInstallationsController, InstallationsController, ShopInstallationsController } from '../installation/installation.controller';
import { ReviewService } from '../review/review.service';
import { AdminReviewsController, ReviewsController, ShopReviewsController } from '../review/review.controller';

/**
 * M6: so‘rovlar, yozishma, takliflar, montaj va sharhlar (TZ 9.10, 13). Entity bo‘yicha papkalar
 * (quote-request, quote, installation, review) — bir-biriga bog‘liq bo‘lgani uchun bitta Nest modulida.
 */
@Module({
  controllers: [
    QuoteRequestsController, RequestShopsController, ShopRequestsController,
    QuotesController, ShopQuotesController,
    InstallationsController, ShopInstallationsController, AdminInstallationsController,
    ReviewsController, ShopReviewsController, AdminReviewsController,
  ],
  providers: [QuoteRequestService, M6Notifier, M6JobsService, QuoteService, QuoteTemplateService, InstallationService, ReviewService],
  exports: [QuoteRequestService, QuoteService, InstallationService, ReviewService, M6JobsService, M6Notifier],
})
export class QuoteRequestModule {}
