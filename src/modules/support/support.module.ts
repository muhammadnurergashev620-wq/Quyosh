import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { QuoteRequestModule } from '../quote-request/quote-request.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SupportService } from './support.service';
import { AdminSupportController, SupportController } from './support.controller';

/** Yordam markazi (TZ 4.20). */
@Module({ imports: [OtpModule, QuoteRequestModule, KnowledgeModule], controllers: [SupportController, AdminSupportController], providers: [SupportService], exports: [SupportService] })
export class SupportModule {}
