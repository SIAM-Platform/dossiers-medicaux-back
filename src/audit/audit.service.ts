import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { pseudonym } from '../privacy/pseudonymize';
import { run, text } from '../privacy/sql';

/** Une entrée du journal : qui, quand, quelle action, sur quel objet. Jamais de valeur médicale. */
export interface AuditEntry {
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  route: string;
  status: number;
  fields: string[];
  context: Record<string, string>;
  ip: string | null;
}

const GENESIS = '0'.repeat(64);

/**
 * Journal d'audit du dossier médical : toute consultation et toute modification sont tracées.
 * - ajout seul : un déclencheur refuse modification, suppression et vidage (migration AuditJournal) ;
 * - chaîné : chaque entrée porte l'empreinte SHA-256 de la précédente, une rupture est détectable
 *   (`GET /audit/verify`) ;
 * - minimal : seuls les noms des champs modifiés sont gardés, jamais leurs valeurs ; les
 *   identifiants de recherche (CNI, e-mail…) et l'adresse IP sont pseudonymisés.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Contenu haché d'une entrée (ordre des champs fixe). */
  private static digest(
    prev: string,
    e: {
      id: string;
      seq: number;
      occurredAt: string;
      actorId: string | null;
      actorName: string;
      action: string;
      entityType: string;
      entityId: string | null;
      route: string;
      status: number;
      fields: string[];
      context: Record<string, string>;
      ip: string | null;
    },
  ): string {
    const canonical = JSON.stringify([
      e.seq,
      e.id,
      e.occurredAt,
      e.actorId,
      e.actorName,
      e.action,
      e.entityType,
      e.entityId,
      e.route,
      e.status,
      e.fields,
      e.context,
      e.ip,
    ]);
    return createHash('sha256').update(prev).update(canonical).digest('hex');
  }

  /** Ajoute une entrée en fin de chaîne (la tête est verrouillée : plusieurs copies écrivent sans se croiser). */
  async record(entry: AuditEntry): Promise<void> {
    const occurredAt = new Date();
    await this.ds.transaction(async (m) => {
      const [head] = await run<{ seq: number | string; hash: string }>(
        this.ds,
        m,
        `SELECT seq, hash FROM audit_chain_head WHERE id = 1 FOR UPDATE`,
      );
      const seq = Number(head.seq) + 1;
      const row = {
        id: randomUUID(),
        seq,
        occurredAt: occurredAt.toISOString(),
        actorId: entry.actorId,
        actorName: entry.actorName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        route: entry.route,
        status: entry.status,
        fields: entry.fields,
        context: entry.context,
        ip: entry.ip === null ? null : pseudonym(entry.ip),
      };
      const hash = AuditService.digest(head.hash, row);
      await run(
        this.ds,
        m,
        `INSERT INTO audit_events (seq, id, occurred_at, actor_id, actor_name, action, entity_type, entity_id, route, status, fields, context, ip, prev_hash, hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          seq,
          row.id,
          occurredAt,
          row.actorId,
          row.actorName,
          row.action,
          row.entityType,
          row.entityId,
          row.route,
          row.status,
          JSON.stringify(row.fields),
          JSON.stringify(row.context),
          row.ip,
          head.hash,
          hash,
        ],
      );
      await m.query(
        `UPDATE audit_chain_head SET seq = $1, hash = $2 WHERE id = 1`,
        [seq, hash],
      );
    });
  }

  /** Dernières entrées, filtrables par objet ou par agent. */
  async list(q: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    limit?: number;
  }) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.entityType) where.push(`entity_type = $${params.push(q.entityType)}`);
    if (q.entityId) where.push(`entity_id = $${params.push(q.entityId)}`);
    if (q.actorId) where.push(`actor_id = $${params.push(q.actorId)}`);
    const limit = Math.min(Math.max(Number(q.limit) || 200, 1), 1000);
    return run(
      this.ds,
      this.ds,
      `SELECT seq, occurred_at, actor_id, actor_name, action, entity_type, entity_id, route, status, fields, context FROM audit_events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY seq DESC LIMIT ${limit}`,
      params,
    );
  }

  /** Recalcule toute la chaîne : la première entrée modifiée, supprimée ou insérée hors chaîne est signalée. */
  async verify(): Promise<{
    ok: boolean;
    entries: number;
    brokenAt: number | null;
  }> {
    let prev = GENESIS;
    let expected = 1;
    let entries = 0;
    for (;;) {
      const rows = await run<Record<string, unknown>>(
        this.ds,
        this.ds,
        `SELECT * FROM audit_events WHERE seq >= $1 ORDER BY seq LIMIT 5000`,
        [expected],
      );
      if (!rows.length) break;
      for (const r of rows) {
        const seq = Number(r.seq);
        const parse = (v: unknown): unknown =>
          typeof v === 'string' ? JSON.parse(v) : v;
        const recomputed = AuditService.digest(prev, {
          id: text(r.id),
          seq,
          occurredAt: new Date(r.occurred_at as string).toISOString(),
          actorId: (r.actor_id as string | null) ?? null,
          actorName: text(r.actor_name),
          action: text(r.action),
          entityType: text(r.entity_type),
          entityId: (r.entity_id as string | null) ?? null,
          route: text(r.route),
          status: Number(r.status),
          fields: (parse(r.fields) as string[]) ?? [],
          context: (parse(r.context) as Record<string, string>) ?? {},
          ip: (r.ip as string | null) ?? null,
        });
        if (seq !== expected || r.prev_hash !== prev || r.hash !== recomputed) {
          this.logger.error(`Chaîne d'audit rompue à l'entrée ${seq}`);
          return { ok: false, entries, brokenAt: seq };
        }
        prev = text(r.hash);
        expected += 1;
        entries += 1;
      }
    }
    return { ok: true, entries, brokenAt: null };
  }
}
