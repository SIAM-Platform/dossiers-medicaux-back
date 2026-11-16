import { INestApplication, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { JsonLogger, jsonLogs } from './logger';
import { Gauge } from 'prom-client';
import { httpDuration, registry } from './metrics';
import { requestIdMiddleware } from './request-id';

type Req = { method: string; path: string; headers: Record<string, unknown>; route?: { path?: string }; baseUrl?: string };
type Res = { statusCode: number; on(e: string, f: () => void): void; setHeader(k: string, v: string): void; status(c: number): Res; json(b: unknown): void; type(t: string): Res; send(b: string): void; end(): void };

/**
 * Observabilité commune aux services SIAM (identique partout) :
 * - identifiant de requête (X-Request-Id) et journaux JSON (LOG_FORMAT=json, défaut en production) ;
 * - métriques Prometheus sur /metrics : en production, exige METRICS_TOKEN (Bearer), sinon 404 ;
 * - sondes /health/live (le processus répond) et /health/ready (la base répond en moins de 2 s).
 * Ces routes sont posées avant celles de l'application : ni préfixe, ni authentification.
 */
export function applyObservability(app: INestApplication, opts: { health?: boolean } = {}): void {
  if (jsonLogs()) app.useLogger(new JsonLogger());
  const http = app.getHttpAdapter().getInstance() as {
    use(fn: (req: Req, res: Res, next: () => void) => void): void;
    get(path: string, fn: (req: Req, res: Res) => void): void;
  };
  http.use(requestIdMiddleware as unknown as (req: Req, res: Res, next: () => void) => void);
  http.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      if (req.path === '/metrics' || req.path.startsWith('/health')) return;
      const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : 'unmatched';
      end({ method: req.method, route, status_code: String(res.statusCode) });
    });
    next();
  });

  const token = process.env.METRICS_TOKEN ?? '';
  const metricsOpen = process.env.NODE_ENV !== 'production' && !token;
  http.get('/metrics', (req, res) => {
    if (!metricsOpen) {
      const auth = String(req.headers.authorization ?? '');
      const given = Buffer.from(auth.startsWith('Bearer ') ? auth.slice(7) : '');
      const want = Buffer.from(token);
      if (!token || given.length !== want.length || !timingSafeEqual(given, want)) return void res.status(404).end();
    }
    void registry.metrics().then((body) => res.type(registry.contentType).send(body));
  });

  if (opts.health === false) return;
  const ready = new Gauge({ name: 'siam_ready', help: '1 si le service est prêt (base joignable)', registers: [registry] });
  http.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  http.get('/health/ready', (_req, res) => {
    void checkDatabase(app).then((ok) => {
      ready.set(ok ? 1 : 0);
      res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable', checks: { database: ok ? 'ok' : 'down' } });
    });
  });
}

async function checkDatabase(app: INestApplication): Promise<boolean> {
  try {
    const ds = app.get(DataSource, { strict: false });
    await Promise.race([ds.query('SELECT 1'), new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), 2000))]);
    return true;
  } catch (e) {
    new Logger('Health').warn(`Base injoignable : ${(e as Error).message}`);
    return false;
  }
}
