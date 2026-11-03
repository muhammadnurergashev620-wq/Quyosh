import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { PublicService } from './public.service';

/** Kirmasdan ko‘rinadigan ommaviy ma’lumotlar. Telefon va aniq manzil hech qachon berilmaydi. */
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Get('stats')
  stats() {
    return this.publicService.stats();
  }
}
