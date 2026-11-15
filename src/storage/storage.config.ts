import { LocalStorageDriver, S3StorageDriver, StorageDriver } from './drivers';

type Env = Record<string, string | undefined>;
const MB = 1024 * 1024;

/**
 * Configuration du stockage, lue dans l'environnement (jamais dans l'interface) :
 *
 *   STORAGE_DRIVER        local (défaut) | s3
 *   STORAGE_LOCAL_PATH    dossier du disque local (défaut ./storage-data), jamais publié par un serveur web
 *   S3_ENDPOINT           adresse du stockage objet (MinIO, Ceph, cloud) ; vide pour AWS
 *   S3_REGION             défaut us-east-1
 *   S3_BUCKET             compartiment, de préférence un par service
 *   S3_ACCESS_KEY / S3_SECRET_KEY   lus aussi depuis *_FILE ou Vault (voir secrets)
 *   S3_FORCE_PATH_STYLE   true (défaut, MinIO) | false
 *   STORAGE_PREFIX        préfixe des clés, défaut : nom du service
 *   UPLOAD_MAX_MB         plafond global (défaut propre au service, 100 Mo en général)
 *   CLAMAV_HOST / CLAMAV_PORT       antivirus clamd
 *   STORAGE_ANTIVIRUS     required (défaut en production) | optional (défaut ailleurs)
 *   STORAGE_LINK_TTL_SECONDS        durée des liens de téléchargement (défaut 300)
 */
export interface StorageSettings {
  driver: StorageDriver;
  prefix: string;
  maxBytes: number;
  clamav: { host: string; port: number } | null;
  antivirusRequired: boolean;
  linkTtlSeconds: number;
}

export function storageSettings(serviceName: string, env: Env = process.env, defaultMaxMb = 100): StorageSettings {
  return {
    driver: driverFromEnv(env),
    prefix: (env.STORAGE_PREFIX || serviceName).replace(/[^a-zA-Z0-9_-]/g, '-'),
    maxBytes: Number(env.UPLOAD_MAX_MB || defaultMaxMb) * MB,
    clamav: env.CLAMAV_HOST ? { host: env.CLAMAV_HOST, port: Number(env.CLAMAV_PORT || '3310') } : null,
    antivirusRequired: (env.STORAGE_ANTIVIRUS || (env.NODE_ENV === 'production' ? 'required' : 'optional')) === 'required',
    linkTtlSeconds: Math.max(30, Math.min(3600, Number(env.STORAGE_LINK_TTL_SECONDS || '300'))),
  };
}

export function driverFromEnv(env: Env = process.env, kind = env.STORAGE_DRIVER || 'local'): StorageDriver {
  if (kind === 's3') {
    const need = (name: string) => {
      const v = env[name];
      if (!v) throw new Error(`Stockage S3 : ${name} manquant`);
      return v;
    };
    return new S3StorageDriver(need('S3_BUCKET'), {
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION || 'us-east-1',
      accessKeyId: need('S3_ACCESS_KEY'),
      secretAccessKey: need('S3_SECRET_KEY'),
      forcePathStyle: (env.S3_FORCE_PATH_STYLE || 'true') === 'true',
    });
  }
  if (kind !== 'local') throw new Error(`STORAGE_DRIVER inconnu : ${kind} (local ou s3)`);
  return new LocalStorageDriver(env.STORAGE_LOCAL_PATH || './storage-data');
}
