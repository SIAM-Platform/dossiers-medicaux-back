import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance: string;
  /** Compatibilité avec l'interface existante (lisait `message` et `statusCode`). */
  message: string | string[];
  statusCode: number;
  [extra: string]: unknown;
}

const TITLES: Record<number, string> = {
  400: 'Requête invalide',
  401: 'Authentification requise',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit',
  413: 'Contenu trop volumineux',
  422: 'Données non traitables',
  429: 'Trop de requêtes',
  500: 'Erreur interne',
};

/**
 * Toutes les erreurs sortent au format RFC 9457 `application/problem+json`, comme dans le socle
 * SIAM ; les champs `message` et `statusCode` restent présents pour l'interface. Les erreurs de
 * base de données deviennent des refus explicites (doublon, élément encore utilisé, contrainte) au
 * lieu d'erreurs 500 ; les erreurs internes ne divulguent rien.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erreurs');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const problem = this.toProblem(exception, req);
    if (problem.status >= 500)
      this.logger.error(
        `${req.method} ${req.url} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, req: Request): Problem {
    const make = (
      status: number,
      code: string,
      detail: string,
      extra: Record<string, unknown> = {},
      message?: string | string[],
    ): Problem => ({
      type: `urn:siam:error:${code.toLowerCase()}`,
      title: TITLES[status] ?? 'Erreur',
      status,
      detail,
      code,
      instance: req.originalUrl,
      message: message ?? detail,
      statusCode: status,
      ...extra,
    });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        const b = body as Record<string, unknown>;
        const raw = b.detail ?? b.message ?? TITLES[status] ?? '';
        const detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
        return {
          ...make(status, String(b.code), detail),
          ...b,
          message: (b.message as string) ?? detail,
          statusCode: status,
        };
      }
      const message =
        typeof body === 'object' && body !== null
          ? (body as { message?: unknown }).message
          : body;
      if (Array.isArray(message)) {
        const list = message.map(String);
        return make(
          status,
          'VALIDATION_FAILED',
          list.join(' ; '),
          { errors: list.map((m) => ({ field: m.split(' ')[0], message: m })) },
          list,
        );
      }
      return make(
        status,
        `HTTP_${status}`,
        typeof message === 'string'
          ? message
          : message === undefined || message === null
            ? (TITLES[status] ?? 'Erreur')
            : JSON.stringify(message),
      );
    }

    if (exception instanceof QueryFailedError) {
      const pg = exception.driverError as {
        code?: string;
        constraint?: string;
        message?: string;
      };
      if (pg.code === '23505')
        return make(
          HttpStatus.CONFLICT,
          'UNIQUE_VIOLATION',
          'Un enregistrement identique existe déjà',
          { constraint: pg.constraint },
        );
      if (pg.code === '23503' && req.method === 'DELETE')
        return make(
          HttpStatus.CONFLICT,
          'IN_USE',
          "Suppression impossible : cet élément est encore utilisé par d'autres enregistrements",
          { constraint: pg.constraint },
        );
      if (pg.code === '23503')
        return make(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'REFERENCE_NOT_FOUND',
          "Un élément référencé n'existe pas",
          { constraint: pg.constraint },
        );
      if (
        pg.code === '23502' ||
        pg.code === '23514' ||
        pg.code === '22P02' ||
        pg.code === '22001' ||
        pg.code === '22007'
      )
        return make(
          HttpStatus.BAD_REQUEST,
          'INVALID_DATA',
          'Données invalides ou incomplètes',
          { constraint: pg.constraint },
        );
      if (pg.code === 'P0001' && pg.message?.startsWith('SIAM_IMMUTABLE'))
        return make(
          HttpStatus.CONFLICT,
          'RECORD_LOCKED',
          'Cet enregistrement ne peut plus être modifié',
        );
    }

    return make(500, 'INTERNAL', 'Une erreur interne est survenue');
  }
}
