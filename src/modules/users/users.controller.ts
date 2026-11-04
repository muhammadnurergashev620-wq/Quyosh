import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { clientIpOf } from '../../common/utils/client-ip';
import { panelOf } from '../../common/utils/panel';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RequestPhoneDto, VerifyPhoneDto } from './dto/phone.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChangePasswordDto, FirstPasswordDto, SetPasswordDto } from './dto/set-password.dto';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { SetEmailDto } from './dto/set-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me/two-factor')
  setTwoFactor(@CurrentUser('sub') userId: string, @Body() dto: SetTwoFactorDto) {
    return this.usersService.setTwoFactor(userId, dto);
  }

  @RateLimit({ policy: 'login', scope: 'ip', escalate: true })
  @Post('me/delete-account')
  deleteAccount(@CurrentUser('sub') userId: string, @Body() dto: DeleteAccountDto, @Req() req: Request) {
    return this.usersService.deleteAccount(userId, dto, clientIpOf(req));
  }

  @Post('me/delete-account/cancel')
  cancelDeletion(@CurrentUser('sub') userId: string) {
    return this.usersService.cancelDeletion(userId);
  }

  @Patch('me/email')
  setEmail(@CurrentUser('sub') userId: string, @Body() dto: SetEmailDto) {
    return this.usersService.setEmail(userId, dto);
  }

  /** Parolsiz (masalan, Google orqali ochilgan) akkauntga birinchi marta parol o‘rnatish. */
  @Post('me/password')
  setPassword(@CurrentUser('sub') userId: string, @Body() dto: SetPasswordDto) {
    return this.usersService.setInitialPassword(userId, dto.password);
  }

  /** Joriy parolni yangisiga almashtirish (joriy qurilmadan boshqa barcha qurilmalar tizimdan chiqariladi). */
  @RateLimit({ policy: 'login', scope: 'ip', escalate: true })
  @Post('me/password/change')
  changePassword(@CurrentUser('sub') userId: string, @CurrentUser('deviceId') deviceId: string | undefined, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, deviceId, dto.currentPassword, dto.newPassword);
  }

  /** Do‘kon hisobi: admin bergan vaqtincha parolni birinchi kirishda yangisiga almashtirish (mustPasswordChange). */
  @RateLimit({ policy: 'login', scope: 'ip', escalate: true })
  @Post('me/password/first')
  firstPassword(@CurrentUser('sub') userId: string, @CurrentUser('deviceId') deviceId: string | undefined, @Body() dto: FirstPasswordDto) {
    return this.usersService.setFirstPassword(userId, deviceId, dto.newPassword);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('me/name')
  updateName(@CurrentUser('sub') userId: string, @Body() dto: UpdateNameDto) {
    return this.usersService.updateName(userId, dto);
  }

  @RateLimit({ policy: 'otpRequest', scope: 'ip+phone', escalate: true })
  @Post('me/phone/request')
  requestPhone(@CurrentUser('sub') userId: string, @Body() dto: RequestPhoneDto, @Req() req: Request) {
    return this.usersService.requestPhoneCode(userId, dto.phone, { ip: clientIpOf(req), panel: panelOf(req) });
  }

  @RateLimit({ policy: 'otpVerify', scope: 'ip+phone', escalate: true })
  @Post('me/phone/verify')
  verifyPhone(@CurrentUser('sub') userId: string, @Body() dto: VerifyPhoneDto) {
    return this.usersService.verifyPhone(userId, dto.phone, dto.code);
  }
}
