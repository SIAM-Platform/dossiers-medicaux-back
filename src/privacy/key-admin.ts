import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import {
  keyUsage,
  loadKeyring,
  purgeRetiredKeys,
  reencryptAll,
  rewrapKeys,
  rotateDataKey,
} from './crypto-keys';
import { keyringStatus } from './keyring';
import { PrivacyService } from './privacy.service';
import { loadSecrets } from './secrets';

const USAGE = `Administration des clés de chiffrement des champs

  npm run crypto:keys <commande>      (image construite : node dist/privacy/key-admin.js <commande>)

  status      clés du trousseau et répartition des valeurs chiffrées par clé
  rotate      crée une nouvelle clé de données active (l'ancienne reste lisible)
  reencrypt   re-chiffre avec la clé active tout ce qui ne l'est pas (relançable)
  rewrap      change de clé maître : FIELD_MASTER_KEY_PREVIOUS (ancienne) -> FIELD_MASTER_KEY (nouvelle)
  purge       supprime les clés retirées depuis 24 h qui ne chiffrent plus aucune valeur

Chaque opération est inscrite au journal privacy_audit_events (action CRYPTO_*).`;

/** Commande d'administration : démarre le contexte de l'application (sans serveur HTTP). */
export async function runKeyAdmin(
  command: string,
  logger = new Logger('KeyAdmin'),
): Promise<unknown> {
  if (!['status', 'rotate', 'reencrypt', 'rewrap', 'purge'].includes(command))
    throw new Error(USAGE);
  await loadSecrets(process.env, logger);
  process.env.CRYPTO_KEYRING_REFRESH_SECONDS = '0';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const ds = app.get(DataSource);
    const privacy = app.get(PrivacyService, { strict: false });
    await loadKeyring(ds, process.env, logger);
    const record = (
      action: string,
      summary: string,
      context: Record<string, unknown>,
    ) =>
      privacy.recordSystemEvent(
        action,
        'CryptoKey',
        keyringStatus().active,
        summary,
        context,
      );
    switch (command) {
      case 'status':
        return { keyring: keyringStatus(), usage: await keyUsage(ds) };
      case 'rotate': {
        const r = await rotateDataKey(ds);
        await record(
          'CRYPTO_KEY_ROTATED',
          `Nouvelle clé de données active ${r.active} (précédente : ${r.previous ?? 'aucune'})`,
          r,
        );
        return r;
      }
      case 'reencrypt': {
        const r = await reencryptAll(ds, { onProgress: (m) => logger.log(m) });
        await record(
          'CRYPTO_DATA_REENCRYPTED',
          `${r.reduce((a, b) => a + b.updated, 0)} valeur(s) re-chiffrée(s) avec la clé ${keyringStatus().active}`,
          { columns: r },
        );
        return r;
      }
      case 'rewrap': {
        const r = await rewrapKeys(ds);
        await record(
          'CRYPTO_MASTER_KEY_CHANGED',
          `Clé maître changée (${r.from} -> ${r.to}), ${r.keys} clé(s) re-protégée(s)`,
          r,
        );
        return r;
      }
      default: {
        const removed = await purgeRetiredKeys(ds);
        if (removed.length)
          await record(
            'CRYPTO_KEY_DESTROYED',
            `Clé(s) retirée(s) supprimée(s) : ${removed.join(', ')}`,
            { removed },
          );
        return { removed };
      }
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  runKeyAdmin(process.argv[2] ?? 'help')
    .then((r) => {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(0);
    })
    .catch((err: Error) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    });
}
