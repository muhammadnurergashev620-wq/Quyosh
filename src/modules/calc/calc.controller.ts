import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth, Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CalcService } from './calc.service';
import { CompatibilityDto, EstimateDto, FinancingEstimateDto, OutageEstimateDto } from './dto/calc.dto';

/**
 * TZ 9.9: hisoblar — auth ixtiyoriy (guest ham). @Public bo‘lsa ham kirgan foydalanuvchi aniqlanadi (obyekt bo‘yicha hisob uchun).
 */
@Public()
@Controller()
export class CalcController {
  constructor(private readonly calc: CalcService) {}

  @Get('calc/reference')
  reference() {
    return this.calc.reference();
  }

  @OptionalAuth()
  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @HttpCode(200)
  @Post('calculations/estimate')
  estimate(@Body() dto: EstimateDto, @CurrentUser('sub') userId?: string) {
    return this.calc.estimate(dto, userId ?? null);
  }

  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @HttpCode(200)
  @Post('financing/estimate')
  financing(@Body() dto: FinancingEstimateDto) {
    return this.calc.financingEstimate(dto);
  }

  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @HttpCode(200)
  @Post('outage/estimate')
  outage(@Body() dto: OutageEstimateDto) {
    return this.calc.outageEstimate(dto);
  }

  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @HttpCode(200)
  @Post('compatibility/check')
  compatibility(@Body() dto: CompatibilityDto) {
    return this.calc.compatibility(dto);
  }
}
