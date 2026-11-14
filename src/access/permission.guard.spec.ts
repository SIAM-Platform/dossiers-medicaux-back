import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { Public } from '../auth/decorators/public.decorator';
import { Authenticated, RequirePermission } from './decorators';
import { PermissionGuard } from './permission.guard';
import { PERMISSIONS } from './permissions';

class Routes {
  @RequirePermission(PERMISSIONS.VISITE_CONCLUDE) conclude() {}
  @Authenticated() me() {}
  @Public() open() {}
  forgotten() {}
}

const record = jest.fn().mockResolvedValue(undefined);
const guard = () =>
  new PermissionGuard(new Reflector(), { record } as unknown as AuditService);
const ctx = (handler: keyof Routes, user?: object): ExecutionContext =>
  ({
    getType: () => 'http',
    // eslint-disable-next-line @typescript-eslint/unbound-method -- seule la référence (métadonnées) est lue
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({
      getRequest: () => ({ method: 'PUT', url: '/x', user }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionGuard', () => {
  beforeEach(() => record.mockClear());

  it('autorise avec la permission, refuse sans (et trace le refus)', () => {
    expect(
      guard().canActivate(
        ctx('conclude', { permissions: ['visite.conclude'] }),
      ),
    ).toBe(true);
    expect(() =>
      guard().canActivate(ctx('conclude', { permissions: ['visite.update'] })),
    ).toThrow(ForbiddenException);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCES_REFUSE', status: 403 }),
    );
  });

  it('une route sans déclaration est refusée, même à un utilisateur connecté', () => {
    expect(() =>
      guard().canActivate(ctx('forgotten', { permissions: ALL() })),
    ).toThrow(ForbiddenException);
  });

  it('route publique ouverte, route « connecté » ouverte à tout compte', () => {
    expect(guard().canActivate(ctx('open'))).toBe(true);
    expect(guard().canActivate(ctx('me', { permissions: [] }))).toBe(true);
  });

  it('authentification forte exigée pour une action sensible quand MFA_ENFORCED=true', () => {
    process.env.MFA_ENFORCED = 'true';
    try {
      expect(() =>
        guard().canActivate(
          ctx('conclude', { permissions: ['visite.conclude'], mfa: false }),
        ),
      ).toThrow(ForbiddenException);
      expect(
        guard().canActivate(
          ctx('conclude', { permissions: ['visite.conclude'], mfa: true }),
        ),
      ).toBe(true);
    } finally {
      delete process.env.MFA_ENFORCED;
    }
  });
});

function ALL(): string[] {
  return Object.values(PERMISSIONS).map((p) => p.code);
}
