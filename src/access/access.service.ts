import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { runExclusive } from '../privacy/sql';
import { Role } from '../users/entities/role.entity';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from './permissions';
import { RolePermission } from './role-permission.entity';

const KNOWN = new Set(ALL_PERMISSIONS.map((p) => p.code));

/**
 * Permissions effectives des comptes et matrice rôles / permissions.
 * Au démarrage, chaque rôle rencontré pour la première fois reçoit l'attribution par défaut
 * (`role_permission_seed` garde la trace : une attribution modifiée ensuite n'est jamais écrasée).
 */
@Injectable()
export class AccessService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Access');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const res = await runExclusive(this.ds, 'dmgm-access-defaults', () =>
      this.applyDefaults(),
    );
    if (res.ran && res.result?.length)
      this.logger.log(
        `Permissions par défaut attribuées aux rôles : ${res.result.join(', ')}`,
      );
  }

  /** Attribution par défaut des rôles jamais initialisés. Renvoie les rôles traités. */
  async applyDefaults(): Promise<string[]> {
    return this.ds.transaction(async (m) => {
      const roles = await m.getRepository(Role).find();
      const rows: { role_name: string }[] = await m.query(
        `SELECT role_name FROM role_permission_seed`,
      );
      const seeded = new Set(rows.map((r) => r.role_name));
      const done: string[] = [];
      for (const role of roles) {
        if (seeded.has(role.name)) continue;
        const defaults = DEFAULT_ROLE_PERMISSIONS[role.name] ?? [];
        for (const p of defaults) {
          await m.query(
            `INSERT INTO role_permission (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [role.id, p.code],
          );
        }
        await m.query(
          `INSERT INTO role_permission_seed (role_name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [role.name],
        );
        done.push(role.name);
      }
      return done;
    });
  }

  /** Permissions effectives : union des permissions des rôles (codes inconnus ignorés). */
  async permissionsOf(roleIds: number[]): Promise<string[]> {
    if (!roleIds.length) return [];
    const rows = await this.ds
      .getRepository(RolePermission)
      .find({ where: { roleId: In(roleIds) } });
    return [
      ...new Set(rows.map((r) => r.permission).filter((c) => KNOWN.has(c))),
    ].sort();
  }

  /** Permissions effectives que donneraient des rôles (par nom). */
  async permissionsOfRoleNames(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const roles = await this.ds
      .getRepository(Role)
      .find({ where: { name: In(names) } });
    return this.permissionsOf(roles.map((r) => r.id));
  }

  /**
   * Règle anti-escalade : on ne peut attribuer des rôles, ni gérer un compte, qui donnent une
   * permission que l'on n'a pas soi-même (un médecin ne peut ni se donner le rôle admin, ni
   * modifier ou supprimer un compte administrateur).
   */
  assertWithinOwnRights(
    actorPermissions: string[],
    granted: string[],
    what: string,
  ): void {
    const beyond = granted.filter((p) => !actorPermissions.includes(p));
    if (beyond.length) {
      throw new ForbiddenException({
        code: 'PRIVILEGE_ESCALATION',
        message: `${what} : impossible de donner ou de gérer des droits que vous n'avez pas (${beyond.join(', ')})`,
      });
    }
  }

  /** Matrice complète : catalogue, rôles et leurs permissions. */
  async matrix() {
    const roles = await this.ds
      .getRepository(Role)
      .find({ order: { id: 'ASC' } });
    const rows = await this.ds.getRepository(RolePermission).find();
    return {
      permissions: ALL_PERMISSIONS,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: rows
          .filter((x) => x.roleId === r.id && KNOWN.has(x.permission))
          .map((x) => x.permission)
          .sort(),
      })),
    };
  }

  /** Remplace les permissions d'un rôle. */
  async setRolePermissions(
    roleName: string,
    codes: string[],
  ): Promise<{ before: string[]; after: string[] }> {
    const unknown = codes.filter((c) => !KNOWN.has(c));
    if (unknown.length)
      throw new BadRequestException(
        `Permission(s) inconnue(s) : ${unknown.join(', ')}`,
      );
    return this.ds.transaction(async (m) => {
      const role = await m
        .getRepository(Role)
        .findOne({ where: { name: roleName } });
      if (!role) throw new NotFoundException(`Rôle ${roleName} introuvable`);
      const repo = m.getRepository(RolePermission);
      const before = (await repo.find({ where: { roleId: role.id } }))
        .map((r) => r.permission)
        .sort();
      await repo.delete({ roleId: role.id });
      const after = [...new Set(codes)].sort();
      if (after.length)
        await repo.insert(
          after.map((permission) => ({ roleId: role.id, permission })),
        );
      await m.query(
        `INSERT INTO role_permission_seed (role_name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [role.name],
      );
      return { before, after };
    });
  }
}
