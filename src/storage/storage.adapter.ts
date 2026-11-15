import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ValueTransformer } from 'typeorm';
import { Authenticated } from '../access/decorators';
import { AuditService } from '../audit/audit.service';
import { Public } from '../auth/decorators/public.decorator';
import { encrypted } from '../privacy/field-cipher';
import { masterKey } from '../privacy/keyring';

/**
 * Adaptateur de la bibliothèque de stockage SIAM pour DMGM : seul fichier propre au service.
 * Il relie la bibliothèque au journal d'audit chaîné, au trousseau de clés et aux droits du service.
 */
export const SERVICE_NAME = 'dmgm';

/** Plafond de taille par défaut (UPLOAD_MAX_MB le remplace). */
export const DEFAULT_UPLOAD_MAX_MB = 100;

export { Authenticated, Public };

/** Clé de chaque fichier, chiffrée par la clé de données du service (rotation : crypto:keys). */
export const fileKeyTransformer: ValueTransformer = encrypted;

/** Secret de signature des liens, dérivé de la clé maître (identique pour toutes les copies du service). */
export const linkSecret = (): Buffer => createHmac('sha256', masterKey()).update('siam-storage-link-v1').digest();

export interface StorageActor {
  id: string | null;
  name: string;
  permissions: string[];
}

export function toActor(user: unknown): StorageActor | null {
  if (!user || typeof user !== 'object') return null;
  const u = user as { sub?: string; id?: string; name?: string; permissions?: string[]; preferred_username?: string; localUser?: { id?: unknown; firstName?: string; lastName?: string; username?: string } };
  const local = u.localUser;
  return {
    id: local?.id !== undefined ? String(local.id) : (u.sub ?? u.id ?? null),
    name: [local?.firstName, local?.lastName].filter(Boolean).join(' ') || local?.username || u.preferred_username || u.name || 'Agent',
    permissions: u.permissions ?? [],
  };
}

export const fileError = (detail: string, status: HttpStatus): HttpException =>
  new HttpException({ code: 'FILE_REJECTED', title: 'Fichier refusé', detail, message: detail }, status);

export const ADAPTER_IMPORTS = [];

/** Journal : le journal d'audit chaîné de DMGM (jamais de contenu, seulement l'événement). */
@Injectable()
export class StorageJournal {
  private readonly logger = new Logger('StorageJournal');
  constructor(private readonly audit: AuditService) {}

  record(e: { actor: StorageActor | null; action: string; fileId: string | null; summary: string; context: Record<string, string> }): void {
    this.audit
      .record({
        actorId: e.actor?.id ?? null,
        actorName: e.actor?.name ?? 'Système',
        action: e.action,
        entityType: 'Fichier',
        entityId: e.fileId,
        route: 'stockage',
        status: e.action === 'FICHIER_REFUSE' || e.action === 'FICHIER_ACCES_REFUSE' ? 403 : 200,
        fields: [],
        context: { resume: e.summary.slice(0, 200), ...e.context },
        ip: e.context.ip || null,
      })
      .catch((err: Error) => this.logger.error(`Journal indisponible : ${err.message}`));
  }
}
