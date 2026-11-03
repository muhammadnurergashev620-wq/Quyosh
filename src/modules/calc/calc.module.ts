import { Module } from '@nestjs/common';
import { CalcController } from './calc.controller';
import { CalcService } from './calc.service';
import { CalcDataService } from './calc-data.service';
import { SolarService } from './solar.service';
import { AdminCalcService } from './admin-calc.service';
import { CalculationsService } from './calculations.service';
import { CalculationsController, ReportsController, SharedCalculationController } from './calculations.controller';
import { ReportService } from './report/report.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AdminCalcController, AdminTariffsController } from './admin-calc.controller';

@Module({
  controllers: [CalcController, CalculationsController, SharedCalculationController, ReportsController, AdminTariffsController, AdminCalcController],
  providers: [CalcService, CalcDataService, SolarService, AdminCalcService, CalculationsService, ReportService],
  imports: [StorageModule],
  exports: [CalcService, CalcDataService, SolarService, CalculationsService],
})
export class CalcModule {}
