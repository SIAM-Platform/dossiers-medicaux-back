import { LoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { currentRequestId } from './request-id';
import { SERVICE_NAME } from './service';

type Level = 'error' | 'warn' | 'log' | 'debug' | 'verbose' | 'fatal';

/**
 * Journaux structurés : une ligne JSON par message (horodatage, niveau, service, contexte,
 * identifiant de requête et de trace) pour la collecte (Loki, Elasticsearch…). Actif si
 * LOG_FORMAT=json, et par défaut en production. Les messages restent ceux du code : aucune donnée
 * personnelle n'y est ajoutée.
 */
export class JsonLogger implements LoggerService {
  private readonly levels: Set<Level>;

  constructor(levels: Level[] = ['fatal', 'error', 'warn', 'log']) {
    this.levels = new Set(process.env.LOG_LEVEL === 'debug' ? [...levels, 'debug', 'verbose'] : levels);
  }

  private write(level: Level, message: unknown, rest: unknown[]): void {
    if (!this.levels.has(level)) return;
    const args = [...rest];
    const context = typeof args[args.length - 1] === 'string' ? (args.pop() as string) : undefined;
    const stack = level === 'error' || level === 'fatal' ? args.find((a) => typeof a === 'string' && a.includes('\n    at ')) : undefined;
    const span = trace.getActiveSpan()?.spanContext();
    const line: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      context,
      message: message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message),
      request_id: currentRequestId(),
      trace_id: span?.traceId,
      stack: message instanceof Error ? message.stack : stack,
    };
    (level === 'error' || level === 'fatal' ? process.stderr : process.stdout).write(JSON.stringify(line) + '\n');
  }

  log(message: unknown, ...rest: unknown[]): void { this.write('log', message, rest); }
  error(message: unknown, ...rest: unknown[]): void { this.write('error', message, rest); }
  warn(message: unknown, ...rest: unknown[]): void { this.write('warn', message, rest); }
  debug(message: unknown, ...rest: unknown[]): void { this.write('debug', message, rest); }
  verbose(message: unknown, ...rest: unknown[]): void { this.write('verbose', message, rest); }
  fatal(message: unknown, ...rest: unknown[]): void { this.write('fatal', message, rest); }
}

export const jsonLogs = (env: Record<string, string | undefined> = process.env): boolean =>
  (env.LOG_FORMAT ?? (env.NODE_ENV === 'production' ? 'json' : 'text')) === 'json';
