import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/login.dto';
import { GoogleRegisterDto, GoogleSignInDto } from './dto/google.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOTPDto } from '../otp/dto/verify-otp.dto';
import { RequestOtpDto } from '../otp/dto/request-otp.dto';
import { RefreshToken } from '../../common/decorators/get-cookie.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ policy: 'register', scope: 'ip', escalate: true })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req);
  }

  @Public()
  @RateLimit({ policy: 'login', scope: 'ip', escalate: true })
  @Post('google')
  google(@Body() dto: GoogleSignInDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.googleSignIn(dto, req, res);
  }

  @RateLimit({ policy: 'login', scope: 'ip', escalate: true })
  @Post('google/link')
  linkGoogle(@CurrentUser('sub') userId: string, @Body() dto: GoogleSignInDto, @Req() req: Request) {
    return this.authService.linkGoogle(userId, dto, req);
  }

  @Post('google/unlink')
  unlinkGoogle(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.authService.unlinkGoogle(userId, req);
  }

  @Public()
  @RateLimit({ policy: 'register', scope: 'ip', escalate: true })
  @Post('google/register')
  googleRegister(@Body() dto: GoogleRegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.googleRegister(dto, req, res);
  }

  @Public()
  @RateLimit({ policy: 'login', scope: 'ip+phone', escalate: true })
  @Post('login')
  login(@Body() dto: SignInDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.signIn(dto, req, res);
  }

  @Public()
  @RateLimit({ scope: 'ip+phone', escalateOnly: true })
  @Post('verify-otp')
  verifyLoginOtp(
    @Body() dto: VerifyOTPDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.confirmSignIn(dto, req, res);
  }

  /** Ro‘yxatdan o‘tish kodi eskirgan/yetib kelmagan bo‘lsa yangisini so‘rash. Javob raqam holatidan qat’i nazar bir xil. */
  @Public()
  @RateLimit({ policy: 'otpRequest', scope: 'ip+phone', escalate: true })
  @Post('resend-registration')
  resendRegistration(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.authService.resendRegistration(dto, req);
  }

  @Public()
  @RateLimit({ scope: 'ip+phone', escalateOnly: true })
  @Post('verify-registration')
  verifyRegistration(
    @Body() dto: VerifyOTPDto,
    @Req() req: Request,
  ) {
    return this.authService.confirmRegistration(dto, req);
  }

  @Public()
  @Post('refresh')
  refresh(
    @RefreshToken() cookieToken: string,
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(cookieToken ?? dto.refreshToken, req, res);
  }

  @Post('logout')
  logout(
    @RefreshToken() token: string,
    @Req() req: Request,
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signOut(
      token,
      req,
      res,
      dto.allDevices === true,
    );
  }

  @Get('sessions')
  findAllSessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('deviceId') deviceId: string,
    @Req() req: Request,
  ) {
    return this.authService.findAllSessions(userId, deviceId, req);
  }

  @Post('sessions/revoke-others')
  revokeOtherSessions(
    @CurrentUser('sub') userId: string,
    @CurrentUser('deviceId') deviceId: string,
    @Req() req: Request,
  ) {
    return this.authService.revokeOtherSessions(userId, deviceId, req);
  }

  @Post('sessions/:deviceId/revoke')
  revokeSession(
    @CurrentUser('sub') userId: string,
    @CurrentUser('deviceId') deviceId: string,
    @Param('deviceId') sessionOrDeviceId: string,
    @Req() req: Request,
  ) {
    return this.authService.revokeSession(userId, sessionOrDeviceId, deviceId, req);
  }
}
