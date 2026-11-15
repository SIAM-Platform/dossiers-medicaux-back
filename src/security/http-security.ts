import { INestApplication, Logger } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Sécurité HTTP commune aux services SIAM, mêmes réglages que les services Inspection, GUM et gens
 * de mer : en-têtes helmet, `x-powered-by` retiré, IP réelle derrière le proxy (journal, limitation
 * de débit), origines CORS explicites. La limitation de débit est faite par ThrottlerModule
 * (`RATE_LIMIT_PER_MINUTE`, 300 par défaut) et la validation par ValidationPipe (`whitelist`).
 *
 * Origines CORS, dans l'ordre : `CORS_ORIGINS` (liste séparée par des virgules), anciennes variables
 * du service (`CORS_ORIGIN`, `FRONTEND_URL`), sinon les sous-domaines https de siam-platform.com
 * (et localhost hors production). Jamais « toutes origines ».
 */
type Env = Record<string, string | undefined>;
export type Origin = string | RegExp;

export const SIAM_DOMAIN = /^https:\/\/([a-z0-9-]+\.)*siam-platform\.com$/;
export const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const list = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter((o) => o && o !== '*');

export function corsOrigins(env: Env = process.env): Origin[] {
  const explicit = list(env.CORS_ORIGINS);
  if (explicit.length) return explicit;
  const legacy = [...list(env.CORS_ORIGIN), ...list(env.FRONTEND_URL)];
  const base: Origin[] = legacy.length ? legacy : [SIAM_DOMAIN];
  return env.NODE_ENV === 'production' ? base : [...base, LOCALHOST];
}

export const swaggerEnabled = (env: Env = process.env): boolean =>
  (env.SWAGGER_ENABLED ?? (env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true';

export function applyHttpSecurity(app: INestApplication, opts: { allowedHeaders?: string[] } = {}): Origin[] {
  const http = app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void; disable(k: string): void };
  http.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? '1'));
  http.disable('x-powered-by');
  // API JSON : la CSP utile est celle des frontends (servis par nginx) ; ici les autres en-têtes.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  const origins = corsOrigins();
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // En-têtes demandés acceptés sauf liste fournie : seules les origines sont restreintes.
    ...(opts.allowedHeaders ? { allowedHeaders: opts.allowedHeaders } : {}),
    exposedHeaders: ['Content-Disposition', 'ETag', 'X-Request-Id'],
    maxAge: 600,
  });
  new Logger('HttpSecurity').log(`Origines CORS : ${origins.map(String).join(', ')}`);
  return origins;
}
