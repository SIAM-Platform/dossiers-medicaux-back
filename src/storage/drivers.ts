import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import { Readable } from 'stream';

export type DriverName = 'local' | 's3';

export interface StorageDriver {
  readonly name: DriverName;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Vérifie que la cible répond (démarrage, points de santé). */
  check(): Promise<void>;
  /** Clés présentes sous un préfixe (nettoyage des objets sans fichier enregistré). */
  list(prefix: string): Promise<string[]>;
}

/**
 * Disque du serveur. Le dossier ne doit jamais être publié par un serveur web : les fichiers ne
 * sortent que par le service, après contrôle des droits. Dossiers 0700, fichiers 0600.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathOf(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('Clé de stockage invalide');
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, data, { flag: 'wx', mode: 0o600 });
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async check(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  async list(prefix: string): Promise<string[]> {
    const base = this.pathOf(prefix);
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else out.push(p.slice(this.root.length + 1).split(sep).join('/'));
      }
    };
    await walk(base);
    return out;
  }
}

/** Stockage objet compatible S3 : MinIO ou Ceph sur site, ou cloud. */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    options: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean },
  ) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async put(key: string, data: Buffer): Promise<void> {
    // Contenu toujours chiffré par SIAM : type générique, aucune métadonnée parlante.
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: 'application/octet-stream' }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of out.Body as Readable) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async check(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${prefix}/`, ContinuationToken: token }),
      );
      for (const o of page.Contents ?? []) if (o.Key) out.push(o.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
}
