import { Global, Module } from '@nestjs/common';
import { AdminErrorController, ClientErrorController } from './error-log.controller';
import { ErrorLogService } from './error-log.service';

@Global()
@Module({
  controllers: [ClientErrorController, AdminErrorController],
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
