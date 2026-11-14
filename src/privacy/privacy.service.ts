import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { decryptField, encryptField } from './cipher';
import type { PrivacyInventory, Purge } from './privacy.types';
import { maskPersonal, pseudonym, redactText } from './pseudonymize';
import { ensurePrivacySchema } from './schema';
import { affected, ident, isMysql, run, runExclusive, text } from './sql';

export const PRIVACY_INVENTORY = Symbol('PRIVACY_INVENTORY');
export const REQUEST_DUE_DAYS = 30;
const DAY = 86_400_000;
const TYPES = [
  'ACCESS',
  'RECTIFICATION',
  'ERASURE',
  'RESTRICTION',
  'OBJECTION',
  'PORTABILITY',
] as const;
const STATUSES = ['RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
type Status = (typeof STATUSES)[number];
const TRANSITIONS: Record<Status, Status[]> = {
  RECEIVED: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

/** Acteur d'une action (agent authentifié), quelle que soit la forme de l'utilisateur du service. */
export interface PrivacyActor {
  id: string | null;
  name: string;
}

/**
 * Protection des données personnelles (RGPD), version autonome pour les services hors socle :
 * registre généré, durées de conservation et purge (rapport par défaut, application sur décision),
 * demandes des personnes avec échéance, export des données d'une personne, journal en ajout seul.
 */
@Injectable()
export class PrivacyService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Privacy');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PRIVACY_INVENTORY) private readonly inventory: PrivacyInventory,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await ensurePrivacySchema(this.ds);
    if (process.env.NODE_ENV === 'test') return;
    // Tâche de conservation : toutes les heures, exécutée au plus une fois par jour et par une seule copie.
    this.timer = setInterval(
      () =>
        void this.dailyRetention().catch((e: Error) =>
          this.logger.error(e.message),
        ),
      3_600_000,
    );
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private mode(): 'report' | 'apply' {
    return process.env.PRIVACY_RETENTION_MODE === 'apply' ? 'apply' : 'report';
  }

  private q<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    on: DataSource | EntityManager = this.ds,
  ) {
    return run<T>(this.ds, on, sql, params);
  }

  private async audit(
    actor: PrivacyActor | null,
    action: string,
    entityType: string,
    entityId: string | null,
    summary: string,
    data: { before?: unknown; after?: unknown; context?: unknown } = {},
    on: DataSource | EntityManager = this.ds,
  ) {
    const json = (v: unknown) =>
      v === undefined || v === null ? null : JSON.stringify(maskPersonal(v));
    await this.q(
      `INSERT INTO privacy_audit_events (id, actor_id, actor_name, action, entity_type, entity_id, summary, ${ident(this.ds, 'before')}, ${ident(this.ds, 'after')}, context) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        actor?.id ?? null,
        actor?.name ?? 'Système',
        action,
        entityType,
        entityId,
        redactText(summary),
        json(data.before),
        json(data.after),
        json(data.context),
      ],
      on,
    );
  }

  /** Événement système (administration des clés…) inscrit au journal RGPD en ajout seul. */
  async recordSystemEvent(
    action: string,
    entityType: string,
    entityId: string | null,
    summary: string,
    context: unknown,
  ): Promise<void> {
    await this.audit(null, action, entityType, entityId, summary, { context });
  }

  // -------------------------------------------------------------- Registre

  private async overrides(): Promise<
    Map<
      string,
      { days: number | null; reason: string | null; updatedAt: unknown }
    >
  > {
    const rows = await this.q<{
      key: string;
      days: number | null;
      reason: string | null;
      updated_at: unknown;
    }>(
      `SELECT ${ident(this.ds, 'key')} AS ${ident(this.ds, 'key')}, days, reason, updated_at FROM privacy_retention_policies`,
    );
    return new Map(
      rows.map((r) => [
        r.key,
        {
          days: r.days === null ? null : Number(r.days),
          reason: r.reason,
          updatedAt: r.updated_at,
        },
      ]),
    );
  }

  private async effectiveDays(): Promise<Map<string, number | null>> {
    const o = await this.overrides();
    return new Map(
      this.inventory.datasets.map((d) => [
        d.retention.key,
        d.retention.action === 'KEEP'
          ? null
          : (o.get(d.retention.key)?.days ?? d.retention.defaultDays),
      ]),
    );
  }

  async register() {
    const eff = await this.effectiveDays();
    return {
      service: this.inventory.service,
      controller: this.inventory.controller,
      generatedAt: new Date().toISOString(),
      retentionMode: this.mode(),
      datasets: this.inventory.datasets.map((d) => ({
        code: d.code,
        label: d.label,
        purpose: d.purpose,
        legalBasis: d.legalBasis,
        subjects: d.subjects,
        categories: d.categories,
        sensitive: d.categories.includes('SANTE'),
        storage: d.storage,
        encrypted: !!d.encrypted,
        recipients: d.recipients,
        retention: {
          key: d.retention.key,
          action: d.retention.action,
          days: eff.get(d.retention.key) ?? null,
          defaultDays: d.retention.defaultDays,
          justification: d.retention.justification,
        },
      })),
      processors: this.inventory.processors.map((p) => ({
        ...p,
        enabled: !p.enabledBy || !!process.env[p.enabledBy],
      })),
      subjectTypes: this.inventory.exporters.map((e) => ({
        type: e.type,
        label: e.label,
        refHint: e.refHint,
      })),
    };
  }

  async registerCsv(): Promise<string> {
    const r = await this.register();
    const cell = (v: unknown) => `"${text(v).replace(/"/g, '""')}"`;
    const head = [
      'Traitement',
      'Finalité',
      'Base légale',
      'Personnes concernées',
      'Catégories de données',
      'Donnée de santé',
      'Stockage',
      'Chiffré',
      'Destinataires',
      'Conservation',
      'Durée (jours)',
      'Justification',
    ];
    const lines = r.datasets.map((d) =>
      [
        d.label,
        d.purpose,
        d.legalBasis,
        d.subjects,
        d.categories.join(', '),
        d.sensitive ? 'oui' : 'non',
        d.storage,
        d.encrypted ? 'oui' : 'non',
        d.recipients.join(', '),
        d.retention.action,
        d.retention.days ?? '',
        d.retention.justification,
      ]
        .map(cell)
        .join(';'),
    );
    return '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n');
  }

  // -------------------------------------------------------------- Conservation

  async policies() {
    const o = await this.overrides();
    const seen = new Set<string>();
    return this.inventory.datasets
      .filter((d) => !seen.has(d.retention.key) && seen.add(d.retention.key))
      .map((d) => {
        const x = o.get(d.retention.key);
        return {
          key: d.retention.key,
          dataset: d.label,
          action: d.retention.action,
          defaultDays: d.retention.defaultDays,
          days:
            d.retention.action === 'KEEP'
              ? null
              : (x?.days ?? d.retention.defaultDays),
          overridden: !!x,
          reason: x?.reason ?? null,
          justification: d.retention.justification,
        };
      });
  }

  async setPolicy(
    key: string,
    days: number,
    reason: string,
    actor: PrivacyActor,
  ) {
    const d = this.inventory.datasets.find((x) => x.retention.key === key);
    if (!d)
      throw new NotFoundException({
        code: 'PRIVACY_RULE_UNKNOWN',
        message: `Règle de conservation inconnue : ${key}`,
      });
    if (d.retention.action === 'KEEP')
      throw new ConflictException({
        code: 'PRIVACY_RULE_KEEP',
        message:
          'Donnée conservée par obligation (acte, preuve) : aucune durée à fixer',
      });
    if (!Number.isInteger(days) || days < 1 || days > 36_500)
      throw new BadRequestException({
        code: 'PRIVACY_DAYS',
        message: 'Durée en jours entre 1 et 36 500',
      });
    if (!reason || reason.trim().length < 3)
      throw new BadRequestException({
        code: 'PRIVACY_REASON',
        message: 'Motif obligatoire (décision du responsable de traitement)',
      });
    const before =
      (await this.overrides()).get(key)?.days ?? d.retention.defaultDays;
    await this.ds.transaction(async (m) => {
      const k = ident(this.ds, 'key');
      await this.q(
        `DELETE FROM privacy_retention_policies WHERE ${k} = $1`,
        [key],
        m,
      );
      await this.q(
        `INSERT INTO privacy_retention_policies (${k}, days, reason, updated_by) VALUES ($1, $2, $3, $4)`,
        [key, days, reason.trim(), actor.id],
        m,
      );
      await this.audit(
        actor,
        'PRIVACY_RETENTION_CHANGED',
        'RetentionPolicy',
        key,
        `${d.label} : ${days} jours`,
        { before: { key, days: before }, after: { key, days, reason } },
        m,
      );
    });
    return { key, days, reason };
  }

  async runRetention(opts: {
    apply: boolean;
    actor: PrivacyActor | null;
    now?: Date;
  }) {
    const apply = opts.apply && this.mode() === 'apply';
    const now = opts.now ?? new Date();
    const eff = await this.effectiveDays();
    const lines: {
      key: string;
      dataset: string;
      table: string | null;
      action: string;
      days: number | null;
      cutoff: string | null;
      eligible: number;
      applied: number;
    }[] = [];
    for (const d of this.inventory.datasets) {
      const days = eff.get(d.retention.key) ?? null;
      const purges: Purge[] = [
        ...(d.retention.purge ? [d.retention.purge] : []),
        ...(d.retention.purges ?? []),
      ];
      if (d.retention.action === 'KEEP' || !purges.length || days === null) {
        lines.push({
          key: d.retention.key,
          dataset: d.label,
          table: null,
          action: d.retention.action,
          days,
          cutoff: null,
          eligible: 0,
          applied: 0,
        });
        continue;
      }
      const cutoff = new Date(now.getTime() - days * DAY);
      for (const p of purges) {
        const [row] = await this.q<{ n: unknown }>(
          `SELECT count(*) AS n FROM ${ident(this.ds, p.table)} WHERE ${p.condition}`,
          [cutoff],
        );
        const n = Number(row?.n ?? 0);
        let applied = 0;
        if (apply && n > 0) {
          applied = await this.ds.transaction(async (m) => {
            const sql =
              d.retention.action === 'DELETE'
                ? `DELETE FROM ${ident(this.ds, p.table)} WHERE ${p.condition}`
                : `UPDATE ${ident(this.ds, p.table)} SET ${Object.entries(
                    p.set ?? {},
                  )
                    .map(([c, v]) => `${ident(this.ds, c)} = ${v}`)
                    .join(', ')} WHERE ${p.condition}`;
            const count = affected(await run(this.ds, m, sql, [cutoff]), n);
            await this.audit(
              opts.actor,
              'PRIVACY_RETENTION_APPLIED',
              'PrivacyDataset',
              d.retention.key,
              `${d.label} (${p.table}) : ${count} ligne(s) ${d.retention.action === 'DELETE' ? 'supprimée(s)' : 'anonymisée(s)'} (antérieures au ${cutoff.toISOString().slice(0, 10)})`,
              {
                context: { key: d.retention.key, table: p.table, days, count },
              },
              m,
            );
            return count;
          });
        }
        lines.push({
          key: d.retention.key,
          dataset: d.label,
          table: p.table,
          action: d.retention.action,
          days,
          cutoff: cutoff.toISOString(),
          eligible: n,
          applied,
        });
      }
    }
    return { mode: this.mode(), applied: apply, lines };
  }

  /** Une seule copie, au plus une fois par jour (02 h et après). */
  private lastRun = '';
  private async dailyRetention(): Promise<void> {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (this.lastRun === day || now.getUTCHours() < 2) return;
    this.lastRun = day;
    await runExclusive(this.ds, 'privacy-retention', async () => {
      const r = await this.runRetention({ apply: true, actor: null });
      const due = r.lines.filter((l) => l.eligible > 0);
      if (due.length)
        this.logger.log(
          `Conservation (${r.mode}) : ${due.map((l) => `${l.table}=${l.applied || l.eligible}`).join(', ')}`,
        );
    });
  }

  // -------------------------------------------------------------- Demandes des personnes

  private view(r: Record<string, unknown>) {
    const dueAt = new Date(r.due_at as string);
    const status = r.status as Status;
    const open = status === 'RECEIVED' || status === 'IN_PROGRESS';
    return {
      id: r.id,
      reference: r.reference,
      type: r.type,
      status,
      subjectType: r.subject_type,
      subjectRef: decryptField(text(r.subject_ref)),
      requesterName: decryptField(text(r.requester_name)),
      requesterContact: r.requester_contact
        ? decryptField(text(r.requester_contact))
        : null,
      channel: r.channel,
      details: r.details,
      receivedAt: new Date(r.received_at as string),
      dueAt,
      response: r.response,
      closedAt: r.closed_at ? new Date(r.closed_at as string) : null,
      overdue: open && dueAt.getTime() < Date.now(),
      daysLeft: open ? Math.ceil((dueAt.getTime() - Date.now()) / DAY) : null,
    };
  }

  async createRequest(dto: Record<string, unknown>, actor: PrivacyActor) {
    const type = text(dto.type);
    if (!(TYPES as readonly string[]).includes(type))
      throw new BadRequestException({
        code: 'PRIVACY_REQUEST_TYPE',
        message: `Type de demande : ${TYPES.join(', ')}`,
      });
    const subjectType = text(dto.subjectType);
    if (!this.inventory.exporters.some((e) => e.type === subjectType))
      throw new BadRequestException({
        code: 'PRIVACY_SUBJECT_TYPE',
        message: `Type de personne inconnu : ${subjectType}`,
      });
    const subjectRef = text(dto.subjectRef).trim();
    const requesterName = text(dto.requesterName).trim();
    if (
      !subjectRef ||
      subjectRef.length > 200 ||
      !requesterName ||
      requesterName.length > 200
    )
      throw new BadRequestException({
        code: 'PRIVACY_REQUEST_FIELDS',
        message:
          'Personne concernée et demandeur obligatoires (200 caractères au plus)',
      });
    const receivedAt = dto.receivedAt
      ? new Date(text(dto.receivedAt))
      : new Date();
    if (
      Number.isNaN(receivedAt.getTime()) ||
      receivedAt.getTime() > Date.now() + 60_000
    )
      throw new BadRequestException({
        code: 'PRIVACY_RECEIVED_AT',
        message: 'Date de réception invalide',
      });
    const channel = ['COURRIER', 'EMAIL', 'GUICHET', 'PORTAIL'].includes(
      text(dto.channel),
    )
      ? text(dto.channel)
      : 'COURRIER';
    const id = randomUUID();
    return this.ds.transaction(async (m) => {
      const series = `DPR-${receivedAt.getUTCFullYear()}`;
      const [c] = await this.q<{ value: unknown }>(
        `SELECT value FROM privacy_counters WHERE series = $1 FOR UPDATE`,
        [series],
        m,
      );
      const next = c ? Number(c.value) + 1 : 1;
      await this.q(
        c
          ? `UPDATE privacy_counters SET value = $2 WHERE series = $1`
          : `INSERT INTO privacy_counters (series, value) VALUES ($1, $2)`,
        [series, next],
        m,
      );
      const reference = `${series}-${String(next).padStart(5, '0')}`;
      await this.q(
        `INSERT INTO privacy_requests (id, reference, type, status, subject_type, subject_ref, requester_name, requester_contact, channel, details, received_at, due_at, created_by) VALUES ($1, $2, $3, 'RECEIVED', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          reference,
          type,
          subjectType,
          encryptField(subjectRef),
          encryptField(requesterName),
          dto.requesterContact
            ? encryptField(text(dto.requesterContact).trim())
            : null,
          channel,
          dto.details ? text(dto.details).slice(0, 2000) : null,
          receivedAt,
          new Date(receivedAt.getTime() + REQUEST_DUE_DAYS * DAY),
          actor.id,
        ],
        m,
      );
      await this.audit(
        actor,
        'PRIVACY_REQUEST_RECEIVED',
        'PrivacyRequest',
        id,
        `${reference} (${type})`,
        { after: { reference, type, subjectType, subjectRef } },
        m,
      );
      const [row] = await this.q(
        `SELECT * FROM privacy_requests WHERE id = $1`,
        [id],
        m,
      );
      return this.view(row);
    });
  }

  async listRequests(filter: { status?: string; overdue?: boolean | string }) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (
      filter.status &&
      (STATUSES as readonly string[]).includes(filter.status)
    ) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.overdue === true || filter.overdue === 'true') {
      params.push(new Date());
      where.push(
        `status IN ('RECEIVED','IN_PROGRESS') AND due_at < $${params.length}`,
      );
    }
    const rows = await this.q(
      `SELECT * FROM privacy_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY due_at ASC LIMIT 500`,
      params,
    );
    return rows.map((r) => this.view(r));
  }

  async updateRequest(
    id: string,
    dto: { status?: string; response?: string },
    actor: PrivacyActor,
  ) {
    const status = text(dto.status) as Status;
    if (!(STATUSES as readonly string[]).includes(status))
      throw new BadRequestException({
        code: 'PRIVACY_STATUS',
        message: `Statut : ${STATUSES.join(', ')}`,
      });
    return this.ds.transaction(async (m) => {
      const [r] = await this.q(
        `SELECT * FROM privacy_requests WHERE id = $1 FOR UPDATE`,
        [id],
        m,
      );
      if (!r)
        throw new NotFoundException({
          code: 'PRIVACY_REQUEST_NOT_FOUND',
          message: 'Demande introuvable',
        });
      const current = r.status as Status;
      if (!TRANSITIONS[current].includes(status))
        throw new ConflictException({
          code: 'PRIVACY_REQUEST_TRANSITION',
          message: `Passage de ${current} à ${status} impossible`,
        });
      const closing = status === 'COMPLETED' || status === 'REJECTED';
      if (closing && !dto.response?.trim())
        throw new BadRequestException({
          code: 'PRIVACY_RESPONSE_REQUIRED',
          message:
            'La réponse apportée à la personne est obligatoire pour clore la demande',
        });
      await this.q(
        `UPDATE privacy_requests SET status = $2, handled_by = $3, response = COALESCE($4, response), closed_at = $5, updated_at = $6 WHERE id = $1`,
        [
          id,
          status,
          actor.id,
          dto.response?.trim() ?? null,
          closing ? new Date() : null,
          new Date(),
        ],
        m,
      );
      await this.audit(
        actor,
        'PRIVACY_REQUEST_UPDATED',
        'PrivacyRequest',
        id,
        `${text(r.reference)} : ${current} → ${status}`,
        { before: { status: current }, after: { status } },
        m,
      );
      const [row] = await this.q(
        `SELECT * FROM privacy_requests WHERE id = $1`,
        [id],
        m,
      );
      return this.view(row);
    });
  }

  // -------------------------------------------------------------- Droit d'accès

  async exportSubject(type: string, ref: string, actor: PrivacyActor) {
    const exporter = this.inventory.exporters.find((e) => e.type === type);
    if (!exporter)
      throw new NotFoundException({
        code: 'PRIVACY_SUBJECT_TYPE',
        message: `Type de personne inconnu : ${type}`,
      });
    if (!ref?.trim())
      throw new BadRequestException({
        code: 'PRIVACY_SUBJECT_REF',
        message: exporter.refHint,
      });
    const data = await exporter.find(this.ds, ref.trim());
    await this.audit(
      actor,
      'PRIVACY_SUBJECT_EXPORTED',
      'PrivacySubject',
      null,
      `${exporter.label} ${pseudonym(ref)}`,
      { context: { subjectType: type, subjectRef: ref } },
    );
    return {
      service: this.inventory.service,
      controller: this.inventory.controller,
      exportedAt: new Date().toISOString(),
      subjectType: type,
      data,
    };
  }

  async auditTrail(limit = 200) {
    const rows = await this.q(
      `SELECT * FROM privacy_audit_events ORDER BY occurred_at DESC LIMIT ${Math.min(Math.max(1, Number(limit) || 200), 1000)}`,
    );
    return rows;
  }

  isMysql(): boolean {
    return isMysql(this.ds);
  }
}
