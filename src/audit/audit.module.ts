import {
  Controller,
  ForbiddenException,
  Get,
  Global,
  Module,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { KeycloakAuthGuard } from '../auth/guards/keycloak-auth.guard';
import { rolesOf } from '../privacy/privacy.module';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/** Rôles autorisés à lire le journal (surchargeable : AUDIT_ROLES_READ, liste séparée par des virgules). */
const readers = () =>
  process.env.AUDIT_ROLES_READ
    ? process.env.AUDIT_ROLES_READ.split(',').map((s) => s.trim())
    : ['admin', 'PRIVACY_OFFICER'];

@Controller('audit')
@UseGuards(KeycloakAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  private check(req: { user?: unknown }) {
    const mine = rolesOf(req.user);
    if (
      !readers().some((r) => mine.includes(r) || mine.includes(r.toUpperCase()))
    ) {
      throw new ForbiddenException({
        code: 'AUDIT_FORBIDDEN',
        message: "Accès au journal d'audit réservé",
      });
    }
  }

  @Get()
  list(
    @Req() req: { user?: unknown },
    @Query()
    q: {
      entityType?: string;
      entityId?: string;
      actorId?: string;
      limit?: string;
    },
  ) {
    this.check(req);
    return this.audit.list({ ...q, limit: Number(q.limit) });
  }

  @Get('verify')
  verify(@Req() req: { user?: unknown }) {
    this.check(req);
    return this.audit.verify();
  }
}

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    KeycloakAuthGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
