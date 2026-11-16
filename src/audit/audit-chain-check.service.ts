import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { recordIntegrity } from '../observability/metrics';
import { runExclusive } from '../privacy/sql';
import { AuditService } from './audit.service';

/**
 * Contrôle quotidien du journal d'audit chaîné (vers 3 h, AUDIT_CHAIN_CHECK_HOUR) : chaque entrée
 * est recalculée. Une rupture (entrée modifiée, supprimée ou insérée hors de l'application)
 * déclenche une alerte : journal en erreur, entrée AUDIT_CHAIN_BROKEN et métrique
 * siam_integrity_check_ok{check="audit-chain"} à 0. Une seule copie à la fois (verrou PostgreSQL).
 */
@Injectable()
export class AuditChainCheckService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('JournalChaine');
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastDay = '';

  constructor(
    private readonly audit: AuditService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.JOBS_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), 3_600_000);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(now = new Date()): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    if (now.getHours() !== Number(process.env.AUDIT_CHAIN_CHECK_HOUR ?? 3) || this.lastDay === day) return;
    this.lastDay = day;
    await runExclusive(this.ds, 'audit-chain-check', () => this.check()).catch((e: Error) =>
      this.logger.error(`Contrôle du journal chaîné impossible : ${e.message}`),
    );
  }

  async check(): Promise<{ ok: boolean; entries: number; brokenAt: number | null }> {
    const result = await this.audit.verify();
    recordIntegrity('audit-chain', result.ok);
    if (result.ok) {
      this.logger.log(`Journal d'audit intègre (${result.entries} entrée(s) vérifiée(s))`);
    } else {
      this.logger.error(`ALERTE : journal d'audit rompu à l'entrée ${result.brokenAt}`);
      await this.audit
        .record({
          actorId: null,
          actorName: 'Système',
          action: 'AUDIT_CHAIN_BROKEN',
          entityType: 'AuditJournal',
          entityId: String(result.brokenAt),
          route: 'contrôle quotidien',
          status: 500,
          fields: [],
          context: { entrees: String(result.entries) },
          ip: null,
        })
        .catch((e: Error) => this.logger.error(`Alerte non inscrite au journal : ${e.message}`));
    }
    return result;
  }
}
