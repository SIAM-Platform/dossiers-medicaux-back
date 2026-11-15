import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, importLegacyFiles, prepareCli } from './storage.cli-hooks';
import { StorageService } from './storage.service';

const USAGE = `Administration du stockage des fichiers

  npm run storage:files <commande> [options]   (image construite : node dist/<chemin>/storage-cli.js)

  status                 cible configurée, antivirus, fichiers par stockage et par chiffrement
  migrate [--dry-run] [--delete-source]
                         copie (et chiffre) les fichiers vers la cible configurée (STORAGE_DRIVER),
                         relit chaque copie et compare l'empreinte ; relançable
  verify                 relit chaque fichier et contrôle son empreinte
  sweep [--dry-run]      supprime les objets du stockage sans fichier enregistré (après purge RGPD)
  import-legacy [--dry-run] [--delete-source]
                         reprend les fichiers enregistrés hors bibliothèque (anciens dossiers)

Chaque opération est inscrite au journal du service.`;

export async function runStorageCli(argv: string[], logger = new Logger('StorageCli')): Promise<unknown> {
  const [command, ...rest] = argv;
  const flags = new Set(rest);
  if (!['status', 'migrate', 'verify', 'sweep', 'import-legacy'].includes(command)) throw new Error(USAGE);
  await prepareCli(logger);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const storage = app.get(StorageService);
    const opts = { dryRun: flags.has('--dry-run'), deleteSource: flags.has('--delete-source') };
    switch (command) {
      case 'status':
        return await storage.status();
      case 'migrate':
        return await storage.migrate(opts);
      case 'verify':
        return await storage.verify();
      case 'sweep':
        return await storage.sweep(opts);
      default:
        return await importLegacyFiles(app, storage, opts);
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  runStorageCli(process.argv.slice(2))
    .then((out) => {
      console.log(JSON.stringify(out, null, 2));
      const errs = (out as { erreurs?: unknown[] })?.erreurs;
      process.exit(Array.isArray(errs) && errs.length ? 2 : 0);
    })
    .catch((e) => {
      console.error((e as Error).message);
      process.exit(1);
    });
}
