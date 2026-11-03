import { Body, Controller, Delete, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterPushTokenDto, RemovePushTokenDto } from './dto/register-token.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Ilova ochilganda yoki chiqqandan keyin qurilma tokenini yuboradi. */
  @Post('tokens')
  register(@CurrentUser('sub') userId: string, @Body() dto: RegisterPushTokenDto) {
    return this.push.register(userId, dto);
  }

  /** DELETE tanasini yubora olmaydigan mijozlar uchun (ilova): xuddi shu amal. */
  @Post('tokens/remove')
  removeViaPost(@CurrentUser('sub') userId: string, @Body() dto: RemovePushTokenDto) {
    return this.push.unregister(userId, dto.token);
  }

  /** Chiqishda token o‘chiriladi: boshqa foydalanuvchining xabari shu telefonga kelmasligi uchun. */
  @Delete('tokens')
  unregister(@CurrentUser('sub') userId: string, @Body() dto: RemovePushTokenDto) {
    return this.push.unregister(userId, dto.token);
  }
}
