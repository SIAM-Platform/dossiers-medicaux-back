import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { AUTHENTICATED_KEY, PERMISSIONS_KEY } from './decorators';
import { ALL_PERMISSIONS } from './permissions';

const MFA_PERMISSIONS = new Set(
  ALL_PERMISSIONS.filter((p) => p.requiresMfa).map((p) => p.code),
);

interface AuthRequest {
  method: string;
  originalUrl?: string;
  url: string;
  ip?: string;
  route?: { path?: string };
  user?: {
    sub?: string;
    preferred_username?: string;
    permissions?: string[];
    mfa?: boolean;
    localUser?: {
      id?: number;
      username?: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

/**
 * Contrôle d'accès global (même règle que le socle), exécuté après l'authentification :
 * - route publique : accès libre ;
 * - `@Authenticated()` : tout utilisateur connecté ;
 * - `@RequirePermission(...)` : toutes les permissions requises ;
 * - aucun décorateur : REFUS (une route oubliée n'est jamais ouverte par erreur).
 * Chaque refus est inscrit au journal d'audit.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger('Access');
  private readonly mfaEnforced = process.env.MFA_ENFORCED === 'true';

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Utilisateur non authentifié');

    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
      AUTHENTICATED_KEY,
      targets,
    );
    if (!required) {
      if (authenticatedOnly) return true;
      this.deny(req, 'Route sans permission déclarée');
    }
    const mine = user.permissions ?? [];
    const missing = required.filter((code) => !mine.includes(code));
    if (missing.length)
      this.deny(req, `Permission(s) manquante(s) : ${missing.join(', ')}`);
    if (
      this.mfaEnforced &&
      !user.mfa &&
      required.some((c) => MFA_PERMISSIONS.has(c))
    ) {
      this.deny(req, 'Authentification forte requise pour cette action');
    }
    return true;
  }

  private deny(req: AuthRequest, reason: string): never {
    const local = req.user?.localUser;
    this.audit
      .record({
        actorId:
          local?.id !== undefined ? String(local.id) : (req.user?.sub ?? null),
        actorName:
          [local?.firstName, local?.lastName].filter(Boolean).join(' ') ||
          local?.username ||
          req.user?.preferred_username ||
          'Agent',
        action: 'ACCES_REFUSE',
        entityType: 'Route',
        entityId: null,
        route:
          `${req.method} ${req.route?.path ?? req.originalUrl ?? req.url}`.slice(
            0,
            200,
          ),
        status: 403,
        fields: [],
        context: { motif: reason.slice(0, 200) },
        ip: req.ip ?? null,
      })
      .catch((e: Error) =>
        this.logger.error(`Refus d'accès non tracé : ${e.message}`),
      );
    throw new ForbiddenException("Vous n'avez pas les droits nécessaires");
  }
}
