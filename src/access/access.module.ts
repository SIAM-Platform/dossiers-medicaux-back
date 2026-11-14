import {
  Body,
  Controller,
  Get,
  Global,
  Module,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArrayUnique, IsArray, IsString } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AccessService } from './access.service';
import { RequirePermission } from './decorators';
import { PermissionGuard } from './permission.guard';
import { PERMISSIONS } from './permissions';
import { RolePermission } from './role-permission.entity';

class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

interface AdminRequest {
  method: string;
  ip?: string;
  user?: { sub?: string; localUser?: { id?: number; username?: string } };
}

/** Matrice rôles / permissions (écran d'administration). */
@Controller('access')
export class AccessController {
  constructor(
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission(PERMISSIONS.PERMISSION_READ)
  @Get('matrix')
  matrix() {
    return this.access.matrix();
  }

  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @Put('roles/:name/permissions')
  async set(
    @Param('name') name: string,
    @Body() dto: SetRolePermissionsDto,
    @Req() req: AdminRequest,
  ) {
    const r = await this.access.setRolePermissions(name, dto.permissions);
    const added = r.after.filter((p) => !r.before.includes(p));
    const removed = r.before.filter((p) => !r.after.includes(p));
    await this.audit.record({
      actorId:
        req.user?.localUser?.id !== undefined
          ? String(req.user.localUser.id)
          : (req.user?.sub ?? null),
      actorName: req.user?.localUser?.username ?? 'Agent',
      action: 'PERMISSIONS_ROLE_MODIFIEES',
      entityType: 'Role',
      entityId: name,
      route: 'PUT /api/access/roles/:name/permissions',
      status: 200,
      fields: [],
      context: {
        ajoutees: added.join(',').slice(0, 500),
        retirees: removed.join(',').slice(0, 500),
      },
      ip: req.ip ?? null,
    });
    return { role: name, permissions: r.after, added, removed };
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RolePermission])],
  providers: [AccessService, PermissionGuard],
  controllers: [AccessController],
  exports: [AccessService, PermissionGuard],
})
export class AccessModule {}
