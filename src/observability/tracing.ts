/**
 * Traces OpenTelemetry (HTTP entrant et sortant, Express, NestJS, PostgreSQL). À importer EN
 * PREMIER dans main.ts : les instrumentations doivent être en place avant le chargement des
 * modules qu'elles observent. Inactif tant qu'aucun collecteur n'est configuré
 * (OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ou OTEL_EXPORTER_OTLP_ENDPOINT).
 *
 * Données personnelles : ni paramètres SQL, ni chaîne de requête des URL (recherches par nom,
 * etc.) ne sont exportés.
 */
import { SERVICE_NAME } from './service';

type Attrs = Record<string, unknown>;
const QUERY_KEYS = ['http.target', 'http.url', 'url.full', 'url.query', 'http.route'];

export function redactAttributes(attrs: Attrs): Attrs {
  for (const k of QUERY_KEYS) {
    const v = attrs[k];
    if (k === 'url.query') delete attrs[k];
    else if (typeof v === 'string' && v.includes('?')) attrs[k] = v.slice(0, v.indexOf('?'));
  }
  delete attrs['db.statement.parameters'];
  return attrs;
}

export function tracesEndpoint(env: Record<string, string | undefined> = process.env): string | null {
  if (env.OTEL_SDK_DISABLED === 'true') return null;
  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) return `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`;
  return null;
}

const endpoint = tracesEndpoint();
if (endpoint) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
  const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  const { registerInstrumentations } = require('@opentelemetry/instrumentation');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
  const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
  const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core');
  /* eslint-enable @typescript-eslint/no-require-imports */

  const exporter = new OTLPTraceExporter({ url: endpoint });
  const redacting = {
    export: (spans: { attributes: Attrs }[], done: (r: unknown) => void) => {
      for (const s of spans) redactAttributes(s.attributes);
      return exporter.export(spans, done);
    },
    shutdown: () => exporter.shutdown(),
    forceFlush: () => exporter.forceFlush?.(),
  };
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || SERVICE_NAME,
      'service.namespace': 'siam',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    spanProcessors: [new BatchSpanProcessor(redacting)],
  });
  provider.register();
  const ignored = /^\/(health|metrics)(\/|$)|^\/api\/health(\/|$)|^\/api\/v1\/health(\/|$)/;
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req: { url?: string }) => ignored.test((req.url ?? '').split('?')[0]) }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  const stop = () => void provider.shutdown().catch(() => undefined);
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
