import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { pseudonym } from '../privacy/pseudonymize';
import { AuditEntry, AuditService } from './audit.service';

interface Req {
  method: string;
  originalUrl?: string;
  route?: { path?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  user?: {
    sub?: string;
    preferred_username?: string;
    localUser?: {
      id?: number | string;
      username?: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

const VERBS: Record<string, string> = {
  GET: 'CONSULTATION',
  POST: 'CREATION',
  PUT: 'MODIFICATION',
  PATCH: 'MODIFICATION',
  DELETE: 'SUPPRESSION',
};
/** Paramètres d'URL qui sont des identifiants techniques (gardés tels quels) ; les autres sont pseudonymisés. */
const TECHNICAL_PARAMS = new Set(['id', 'marinId', 'categorieId']);

/**
 * Trace chaque requête sur le dossier médical, réussie ou refusée, après l'authentification.
 * Les consultations des listes de référence (types de visite, fonctions…) ne sont pas tracées.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Req>();
    const entry = this.describe(req);
    if (!entry) return next.handle();
    const write = (status: number) => {
      this.audit
        .record({ ...entry, status })
        .catch((e: Error) =>
          this.logger.error(
            `Écriture du journal d'audit impossible : ${e.message}`,
          ),
        );
    };
    return next.handle().pipe(
      tap(() =>
        write(
          ctx.switchToHttp().getResponse<{ statusCode: number }>().statusCode,
        ),
      ),
      catchError((err: unknown) => {
        write(err instanceof HttpException ? err.getStatus() : 500);
        return throwError(() => err);
      }),
    );
  }

  private describe(req: Req): Omit<AuditEntry, 'status'> | null {
    const route = (req.route?.path ?? req.originalUrl ?? '').split('?')[0];
    const segments = route
      .replace(/^\/?api\//, '')
      .split('/')
      .filter(Boolean);
    const entityType = segments[0] ?? 'racine';
    if (
      entityType === 'racine' ||
      (entityType === 'referentiels' && req.method === 'GET')
    )
      return null;
    const sub = segments
      .filter((s, i) => i > 0 && !s.startsWith(':'))
      .join(' ');
    const params = req.params ?? {};
    const context: Record<string, string> = {};
    for (const [k, v] of Object.entries(params))
      if (!TECHNICAL_PARAMS.has(k)) context[k] = pseudonym(v);
    for (const k of Object.keys(req.query ?? {}))
      context[`?${k}`] = pseudonym(JSON.stringify(req.query?.[k] ?? ''));
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const local = req.user?.localUser;
    const name =
      [local?.firstName, local?.lastName].filter(Boolean).join(' ') ||
      local?.username ||
      req.user?.preferred_username;
    return {
      actorId:
        local?.id !== undefined ? String(local.id) : (req.user?.sub ?? null),
      actorName:
        name || (req.user ? 'Agent' : 'Public (sans authentification)'),
      action: `${VERBS[req.method] ?? req.method}${sub ? ` ${sub}` : ''}`
        .toUpperCase()
        .slice(0, 80),
      entityType,
      entityId: params.id ?? params.marinId ?? null,
      route: `${req.method} ${route}`.slice(0, 200),
      // Noms des champs envoyés, jamais leurs valeurs (ni mot de passe).
      fields:
        req.method === 'GET'
          ? []
          : Object.keys(body).filter((k) => !/pass|secret|token/i.test(k)),
      context,
      ip: req.ip ?? null,
    };
  }
}
