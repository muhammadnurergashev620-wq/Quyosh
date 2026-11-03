import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';
import { ERRORS } from './common/constants/error-messages';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  liveness() {
    return this.appService.getStatus();
  }

  @Public()
  @Get('ready')
  async readiness() {
    const result = await this.appService.getReadiness();
    if (result.status !== 'ready') throw new ServiceUnavailableException(ERRORS.DEPENDENCIES_NOT_READY);
    return result;
  }
}
