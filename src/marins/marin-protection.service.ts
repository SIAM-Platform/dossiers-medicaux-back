import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { encryptField } from '../privacy/field-cipher';
import { encryptPlaintext } from '../privacy/schema-prep';
import { run, runExclusive } from '../privacy/sql';
import { Marin } from './entities/marin.entity';

/**
 * Rattrapage au démarrage (une seule copie, verrou nommé) : chiffre les données encore en clair
 * (dossiers antérieurs au chiffrement) et calcule les index aveugles des marins. Idempotent.
 */
@Injectable()
export class MarinProtectionService implements OnApplicationBootstrap {
  private readonly logger = new Logger('MarinProtection');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.IDENTITY_BACKFILL_ON_START === 'false') return;
    const res = await runExclusive(this.ds, 'dmgm-protection-backfill', () =>
      this.backfill(),
    );
    if (
      res.ran &&
      res.result &&
      (res.result.values > 0 || res.result.marins > 0)
    )
      this.logger.log(
        `Données protégées : ${res.result.values} valeur(s) chiffrée(s), ${res.result.marins} marin(s) indexé(s)`,
      );
  }

  async backfill(batch = 200): Promise<{ values: number; marins: number }> {
    const values = await encryptPlaintext(this.ds, encryptField);
    let marins = 0;
    for (;;) {
      const n = await this.ds.transaction(async (m) => {
        const rows = await run<{ id: number }>(
          this.ds,
          m,
          `SELECT id FROM marin WHERE nom_index IS NULL OR (numero_ins_mar IS NOT NULL AND numero_ins_mar <> '' AND numero_ins_mar_index IS NULL) OR (numero_cni IS NOT NULL AND numero_cni <> '' AND numero_cni_index IS NULL) LIMIT ${batch}`,
        );
        const ids = rows.map((r) => r.id);
        const repo = m.getRepository(Marin);
        for (const r of await repo.findBy({ id: In(ids) })) {
          r.computeIndexes();
          await repo.update(r.id, {
            nom_index: r.nom_index,
            numero_ins_mar_index: r.numero_ins_mar_index,
            numero_cni_index: r.numero_cni_index,
          });
        }
        return ids.length;
      });
      marins += n;
      if (n < batch) break;
    }
    return { values, marins };
  }
}
