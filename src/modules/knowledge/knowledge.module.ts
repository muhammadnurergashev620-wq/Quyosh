import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { AdminKnowledgeController, KnowledgeController, SitemapController } from './knowledge.controller';

/** Bilimlar markazi (TZ 4.19). */
@Module({ controllers: [KnowledgeController, SitemapController, AdminKnowledgeController], providers: [KnowledgeService], exports: [KnowledgeService] })
export class KnowledgeModule {}
