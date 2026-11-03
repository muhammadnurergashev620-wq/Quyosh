import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { OpsService, type AlertmanagerPayload, type DeployPayload } from './ops.service';

class DeployDto {
  @IsString() @MaxLength(20) service!: string;
  @IsString() @MaxLength(20) environment!: string;
  @IsString() @MaxLength(60) version!: string;
  @IsOptional() @IsString() @MaxLength(64) gitSha?: string;
  @IsIn(['STARTED', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK', 'started', 'succeeded', 'failed', 'rolled_back']) status!: string;
  @IsOptional() @IsString() startedAt?: string;
  @IsOptional() @IsString() finishedAt?: string;
  @IsOptional() @IsString() @MaxLength(120) triggeredBy?: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @MaxLength(500) changelogUrl?: string;
}

/** Alertmanager va CI/CD webhooklari (TZ 9.11): HMAC-SHA256 imzo (X-Quyosh-Signature), OPS_WEBHOOK_SECRET. */
@Controller('ops/webhooks')
export class OpsWebhooksController {
  constructor(private readonly ops: OpsService) {}

  @Public() @HttpCode(200) @RateLimit({ scope: 'ip', limit: 120, windowSeconds: 60 }) @Post('alertmanager')
  alertmanager(@Req() req: RawBodyRequest<Request>, @Headers('x-quyosh-signature') sig: string | undefined, @Body() body: Record<string, unknown>) {
    this.ops.verifySignature(req.rawBody, sig);
    return this.ops.alertmanager(body as AlertmanagerPayload);
  }

  @Public() @HttpCode(200) @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 }) @Post('deploy')
  deploy(@Req() req: RawBodyRequest<Request>, @Headers('x-quyosh-signature') sig: string | undefined, @Body() dto: DeployDto) {
    this.ops.verifySignature(req.rawBody, sig);
    return this.ops.deploy(dto as DeployPayload);
  }
}

@Controller('admin/ops')
@Roles(Role.ADMIN)
@RequiresPermission('DEVOPS')
export class AdminOpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('providers') providers() { return this.ops.providers(); }
  @Get('providers/snapshots') snapshots(@Query('provider') provider?: string) { return this.ops.snapshots(provider); }
  @Get('deployments') deployments() { return this.ops.deployments(); }
  @Get('alerts') alerts(@Query('status') status?: string) { return this.ops.alerts(status); }
  @Post('alerts/:id/ack') ack(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) { return this.ops.ack(adminId, id); }
}
