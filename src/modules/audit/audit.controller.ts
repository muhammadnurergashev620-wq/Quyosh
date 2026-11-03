import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@Roles(Role.ADMIN)
@RequiresPermission('AUDIT')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('summary')
  summary(@Query() query: AuditQueryDto) {
    return this.auditService.summary(query);
  }

  @Get('stats')
  stats(@Query() query: AuditQueryDto) {
    return this.auditService.stats(query);
  }

  @Get(':id/related')
  related(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.related(id);
  }

  @Get()
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }
}
