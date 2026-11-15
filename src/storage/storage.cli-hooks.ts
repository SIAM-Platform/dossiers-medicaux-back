import { INestApplicationContext, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { loadSecrets } from '../privacy/secrets';
import { DMGM_SCAN_POLICY, FILE_REF_PREFIX } from './dmgm-files';
import { StorageService } from './storage.service';

export { AppModule };

export async function prepareCli(logger: Logger): Promise<void> {
  await loadSecrets(process.env, logger);
  process.env.CRYPTO_KEYRING_REFRESH_SECONDS = '0';
}

/**
 * Reprise des scans d'« autres examens » enregistrés avant la bibliothèque dans le dossier public
 * `uploads/` (référence `…/uploads/file_<n>.<ext>` dans examen_clinique.url_scan_autre_examen).
 * Chaque fichier passe les contrôles d'un dépôt, est chiffré, relu et comparé, puis la référence
 * devient `siam-file:<id>`. L'original n'est supprimé qu'avec --delete-source. Relançable.
 */
export async function importLegacyFiles(
  app: INestApplicationContext,
  storage: StorageService,
  opts: { dryRun?: boolean; deleteSource?: boolean },
): Promise<{ examines: number; repris: number; erreurs: { id: string; erreur: string }[] }> {
  const ds = app.get(DataSource);
  const repo = ds.getRepository('ExamenClinique');
  const dir = resolve(process.env.LEGACY_UPLOADS_DIR || join(process.cwd(), 'uploads'));
  const rows = (await repo.find()) as { id: number; visiteId: number; url_scan_autre_examen: string | null }[];
  const errors: { id: string; erreur: string }[] = [];
  let examined = 0;
  let done = 0;
  for (const row of rows) {
    const ref = row.url_scan_autre_examen;
    if (!ref || ref.startsWith(FILE_REF_PREFIX)) continue;
    examined++;
    try {
      const m = /\/uploads\/([^/?#]+)$/.exec(ref);
      if (!m) throw new Error('référence non reconnue');
      const path = resolve(join(dir, basename(m[1])));
      if (!path.startsWith(dir + sep)) throw new Error('chemin invalide');
      const data = await readFile(path);
      if (opts.dryRun) {
        done++;
        continue;
      }
      const saved = await storage.importLegacy(data, basename(path), DMGM_SCAN_POLICY, {
        type: 'VisiteMedicale',
        id: row.visiteId,
        readPermission: 'visite.read',
      });
      await repo.update(row.id, { url_scan_autre_examen: `${FILE_REF_PREFIX}${saved.id}` });
      if (opts.deleteSource) await (await import('fs/promises')).rm(path, { force: true });
      done++;
    } catch (e) {
      errors.push({ id: `examenclinique/${row.id}`, erreur: (e as Error).message });
    }
  }
  return { examines: examined, repris: done, erreurs: errors };
}
