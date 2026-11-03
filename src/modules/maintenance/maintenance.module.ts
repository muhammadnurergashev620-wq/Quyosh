import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { InstalledSystemModule } from '../installed-system/installed-system.module';
import { ShopContentModule } from '../shop-content/shop-content.module';
import { SupportModule } from '../support/support.module';
import { UsersModule } from '../users/users.module';
import { M7JobsService } from './m7-jobs.service';

@Module({ imports: [StorageModule, InstalledSystemModule, ShopContentModule, SupportModule, UsersModule], providers: [M7JobsService], exports: [M7JobsService] })
export class MaintenanceModule {}
