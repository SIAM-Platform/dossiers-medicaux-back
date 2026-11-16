import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequirePermission } from '../access/decorators';
import { PERMISSIONS } from '../access/permissions';
import { AuditInterceptor } from './audit.interceptor';
import { AuditChainCheckService } from './audit-chain-check.service';
import { AuditService } from './audit.service';

@Controller('audit')
@RequirePermission(PERMISSIONS.AUDIT_READ)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query()
    q: {
      entityType?: string;
      entityId?: string;
      actorId?: string;
      limit?: string;
    },
  ) {
    return this.audit.list({ ...q, limit: Number(q.limit) });
  }

  @Get('verify')
  verify() {
    return this.audit.verify();
  }
}

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditChainCheckService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
