import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { AdminSiteController, SiteController } from './site.controller';
import { SiteService } from './site.service';

/** Bosh sahifa CMS (SiteBlock). */
@Module({ imports: [PublicModule], controllers: [SiteController, AdminSiteController], providers: [SiteService] })
export class SiteModule {}
