import { ForbiddenException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import * as FileType from 'file-type';
import { extname } from 'path';
import { Readable } from 'stream';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { clamdScan } from './clamav';
import { DriverName, StorageDriver } from './drivers';
import { isSealed, openFile, sealFile } from './file-crypto';
import { driverFromEnv, StorageSettings, storageSettings } from './storage.config';
import { DEFAULT_UPLOAD_MAX_MB, fileError, linkSecret, SERVICE_NAME, StorageActor, StorageJournal, toActor } from './storage.adapter';
import { EXTENSIONS, UploadPolicy } from './storage.policies';
import { AvStatus, StoredFile } from './stored-file.entity';

const MB = 1024 * 1024;

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  size?: number;
}

/** Rattachement métier d'un fichier, et permission qui ouvre le lien de téléchargement. */
export interface FileOwner {
  type: string;
  id: string | number;
  readPermission?: string | null;
}

export interface DownloadLink {
  /** Chemin à ajouter à l'adresse de l'API (ex. `files/download/<jeton>`). */
  path: string;
  token: string;
  expiresAt: string;
}

export const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

export const sanitizeName = (name: string): string =>
  (name || 'fichier')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .slice(0, 255);

/**
 * Bibliothèque de stockage SIAM (identique dans les 15 services ; seul `storage.adapter.ts` change).
 *
 * Dépôt, dans cet ordre : type réel du contenu (et cohérence de l'extension), taille, antivirus,
 * empreinte SHA-256, chiffrement AES-256-GCM, envoi au stockage (disque local ou S3, selon
 * STORAGE_DRIVER). Lecture : déchiffrement puis contrôle de l'empreinte. Téléchargement : lien
 * court signé, émis après contrôle des droits, chaque émission et chaque téléchargement étant
 * inscrits au journal du service.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  readonly settings: StorageSettings;

  constructor(
    @InjectRepository(StoredFile) private readonly files: Repository<StoredFile>,
    private readonly journal: StorageJournal,
  ) {
    this.settings = storageSettings(SERVICE_NAME, process.env, DEFAULT_UPLOAD_MAX_MB);
  }

  get driver(): StorageDriver {
    return this.settings.driver;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.driver.check();
      this.logger.log(`Stockage des fichiers : ${this.driver.name}`);
    } catch (e) {
      this.logger.error(`Stockage des fichiers (${this.driver.name}) injoignable : ${(e as Error).message}`);
    }
    if (this.settings.antivirusRequired && !this.settings.clamav)
      this.logger.error('Antivirus exigé (STORAGE_ANTIVIRUS=required) mais CLAMAV_HOST absent : tout dépôt sera refusé');
  }

  /** Contrôle, analyse, chiffrement puis stockage. Le fichier n'est jamais exécuté ni publié tel quel. */
  async store(
    file: IncomingFile,
    policy: UploadPolicy,
    user: unknown,
    manager?: EntityManager,
    owner?: FileOwner,
  ): Promise<StoredFile> {
    const actor = toActor(user);
    const limit = Math.min(policy.maxBytes, this.settings.maxBytes);
    if (!file?.buffer?.length) this.reject(actor, file?.originalname, 'Fichier vide ou absent');
    if (file.buffer.length > limit)
      this.reject(actor, file.originalname, `Fichier trop volumineux (maximum ${Math.round(limit / MB)} Mo)`, HttpStatus.PAYLOAD_TOO_LARGE);

    const mimeType = await this.detectMime(file, policy);
    if (!mimeType)
      this.reject(actor, file.originalname, 'Type de fichier non autorisé, ou contenu ne correspondant pas à son extension', HttpStatus.UNSUPPORTED_MEDIA_TYPE);

    const avStatus = await this.scan(actor, file);
    const digest = sha256(file.buffer);
    const { blob, fileKey } = sealFile(file.buffer);
    const now = new Date();
    const key = `${this.settings.prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    await this.driver.put(key, blob);

    const repo = manager ? manager.getRepository(StoredFile) : this.files;
    try {
      const saved = await repo.save(
        repo.create({
          driver: this.driver.name,
          storageKey: key,
          originalName: this.displayName(file.originalname, mimeType!),
          mimeType: mimeType!,
          sizeBytes: file.buffer.length,
          sha256: digest,
          avStatus,
          encryption: 'AES256GCM',
          fileKey,
          ownerType: owner?.type ?? null,
          ownerId: owner ? String(owner.id) : null,
          readPermission: owner?.readPermission ?? null,
          uploadedBy: actor?.id ?? null,
          deletedAt: null,
        }),
      );
      this.journal.record({ actor, action: 'FICHIER_DEPOSE', fileId: saved.id, summary: `Fichier déposé (${mimeType}, ${file.buffer.length} octets)`, context: { owner: owner ? `${owner.type}/${owner.id}` : '' } });
      return saved;
    } catch (e) {
      await this.driver.delete(key).catch(() => undefined);
      throw e;
    }
  }

  /** Contenu en clair, après contrôle de l'empreinte (usage interne au service). */
  async read(id: string): Promise<{ file: StoredFile; data: Buffer }> {
    const file = await this.files.findOne({ where: { id, deletedAt: IsNull() } });
    if (!file) throw new NotFoundException('Fichier introuvable');
    return { file, data: await this.contentOf(file) };
  }

  /** Compatibilité : contenu sous forme de flux. */
  async open(id: string): Promise<{ file: StoredFile; stream: Readable }> {
    const { file, data } = await this.read(id);
    return { file, stream: Readable.from(data) };
  }

  /**
   * Lien de téléchargement court et signé. Sans `checked`, le compte doit avoir la permission
   * enregistrée avec le fichier ; un fichier sans permission enregistrée n'est délivré que par le
   * code métier qui a déjà vérifié les droits (`checked: true`).
   */
  async createLink(id: string, user: unknown, opts: { checked?: boolean } = {}): Promise<DownloadLink> {
    const actor = toActor(user);
    const file = await this.files.findOne({ where: { id, deletedAt: IsNull() } });
    if (!file) throw new NotFoundException('Fichier introuvable');
    if (!opts.checked) {
      const ok = !!file.readPermission && !!actor?.permissions.includes(file.readPermission);
      if (!ok) {
        this.journal.record({ actor, action: 'FICHIER_ACCES_REFUSE', fileId: id, summary: 'Lien de téléchargement refusé', context: { permission: file.readPermission ?? '' } });
        throw new ForbiddenException("Vous n'avez pas accès à ce fichier");
      }
    }
    const exp = Math.floor(Date.now() / 1000) + this.settings.linkTtlSeconds;
    const payload = Buffer.from(JSON.stringify({ f: id, u: actor?.id ?? null, e: exp, n: randomBytes(6).toString('base64url') })).toString('base64url');
    const token = `${payload}.${this.sign(payload)}`;
    this.journal.record({ actor, action: 'FICHIER_LIEN', fileId: id, summary: 'Lien de téléchargement émis', context: { expire: new Date(exp * 1000).toISOString() } });
    return { path: `files/download/${token}`, token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /** Téléchargement par lien : signature et échéance vérifiées, accès inscrit au journal. */
  async download(token: string, ip: string | null): Promise<{ file: StoredFile; data: Buffer }> {
    const [payload, sig] = String(token).split('.');
    const expected = payload ? this.sign(payload) : '';
    if (!payload || !sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      throw new ForbiddenException('Lien de téléchargement invalide');
    let claims: { f: string; u: string | null; e: number };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new ForbiddenException('Lien de téléchargement invalide');
    }
    if (!claims?.f || claims.e * 1000 < Date.now()) throw new ForbiddenException('Lien de téléchargement expiré');
    const out = await this.read(claims.f);
    this.journal.record({
      actor: claims.u ? { id: claims.u, name: claims.u, permissions: [] } : null,
      action: 'FICHIER_TELECHARGE',
      fileId: claims.f,
      summary: 'Fichier téléchargé',
      context: { ip: ip ?? '' },
    });
    return out;
  }

  /** Suppression (droit à l'effacement, purge) : l'objet est détruit, la ligne garde la trace. */
  async remove(id: string, user: unknown): Promise<void> {
    const file = await this.files.findOne({ where: { id, deletedAt: IsNull() } });
    if (!file) return;
    await this.driverFor(file.driver).delete(file.storageKey);
    file.deletedAt = new Date();
    file.fileKey = null;
    await this.files.save(file);
    this.journal.record({ actor: toActor(user), action: 'FICHIER_SUPPRIME', fileId: id, summary: 'Fichier supprimé', context: {} });
  }

  // ---------------------------------------------------------------- outillage (storage:files)

  async status(): Promise<Record<string, unknown>> {
    const rows: { driver: string; encryption: string; n: string; bytes: string }[] = await this.files
      .createQueryBuilder('f')
      .select('f.driver', 'driver')
      .addSelect('f.encryption', 'encryption')
      .addSelect('COUNT(*)', 'n')
      .addSelect('COALESCE(SUM(f.size_bytes),0)', 'bytes')
      .where('f.deleted_at IS NULL')
      .groupBy('f.driver')
      .addGroupBy('f.encryption')
      .getRawMany();
    return {
      cible: this.driver.name,
      antivirus: this.settings.clamav ? `${this.settings.clamav.host}:${this.settings.clamav.port}` : 'non configuré',
      antivirusExige: this.settings.antivirusRequired,
      fichiers: rows.map((r) => ({ stockage: r.driver, chiffrement: r.encryption, nombre: Number(r.n), octets: Number(r.bytes) })),
    };
  }

  /**
   * Déplace (et chiffre au passage) les fichiers vers la cible configurée. Chaque fichier est relu
   * depuis la nouvelle cible et son empreinte comparée avant que la ligne ne soit mise à jour ;
   * l'ancien objet n'est supprimé qu'avec `deleteSource`. Relançable : un fichier déjà sur la
   * cible et chiffré est ignoré.
   */
  async migrate(opts: { dryRun?: boolean; deleteSource?: boolean } = {}): Promise<{ examines: number; deplaces: number; erreurs: { id: string; erreur: string }[] }> {
    const all = await this.files.find({ where: { deletedAt: IsNull() }, order: { uploadedAt: 'ASC' } });
    let moved = 0;
    const errors: { id: string; erreur: string }[] = [];
    for (const f of all) {
      if (f.driver === this.driver.name && f.encryption === 'AES256GCM') continue;
      if (opts.dryRun) {
        moved++;
        continue;
      }
      try {
        const plain = await this.contentOf(f);
        const { blob, fileKey } = sealFile(plain);
        const key = `${this.settings.prefix}/${f.uploadedAt.getUTCFullYear()}/${String(f.uploadedAt.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
        await this.driver.put(key, blob);
        const check = openFile(await this.driver.get(key), fileKey);
        if (sha256(check) !== f.sha256) {
          await this.driver.delete(key).catch(() => undefined);
          throw new Error('empreinte différente après copie');
        }
        const old = { driver: f.driver, key: f.storageKey };
        await this.files.update(f.id, { driver: this.driver.name, storageKey: key, encryption: 'AES256GCM', fileKey });
        if (opts.deleteSource) await this.driverFor(old.driver).delete(old.key).catch(() => undefined);
        moved++;
      } catch (e) {
        errors.push({ id: f.id, erreur: (e as Error).message });
      }
    }
    if (!opts.dryRun)
      this.journal.record({ actor: null, action: 'FICHIERS_MIGRES', fileId: null, summary: `Migration vers ${this.driver.name} : ${moved} fichier(s), ${errors.length} erreur(s)`, context: {} });
    return { examines: all.length, deplaces: moved, erreurs: errors };
  }

  /** Relit chaque fichier et contrôle son empreinte. */
  async verify(): Promise<{ verifies: number; erreurs: { id: string; erreur: string }[] }> {
    const all = await this.files.find({ where: { deletedAt: IsNull() } });
    const errors: { id: string; erreur: string }[] = [];
    for (const f of all) {
      try {
        await this.contentOf(f);
      } catch (e) {
        errors.push({ id: f.id, erreur: (e as Error).message });
      }
    }
    return { verifies: all.length, erreurs: errors };
  }

  /**
   * Reprise d'un fichier existant hors bibliothèque (ancien dossier `uploads`, etc.) : mêmes
   * contrôles qu'un dépôt, puis contrôle de l'empreinte à la relecture.
   */
  async importLegacy(data: Buffer, name: string, policy: UploadPolicy, owner: FileOwner): Promise<StoredFile> {
    const saved = await this.store({ buffer: data, originalname: name }, policy, null, undefined, owner);
    const { data: back } = await this.read(saved.id);
    if (sha256(back) !== sha256(data)) throw new Error('empreinte différente après reprise');
    return saved;
  }

  /**
   * Supprime du stockage les objets qui n'ont plus de fichier enregistré : objets dont la ligne a
   * été effacée par une purge RGPD (leur clé ayant disparu, ils étaient déjà illisibles), ou
   * laissés par une copie interrompue. Ne touche qu'au préfixe du service.
   */
  async sweep(opts: { dryRun?: boolean } = {}): Promise<{ objets: number; orphelins: number; supprimes: number }> {
    const keys = await this.driver.list(this.settings.prefix);
    const rows = await this.files.find({ select: { storageKey: true, deletedAt: true }, where: { driver: this.driver.name } });
    const live = new Set(rows.filter((r) => !r.deletedAt).map((r) => r.storageKey));
    const orphans = keys.filter((k) => !live.has(k));
    if (!opts.dryRun) {
      for (const k of orphans) await this.driver.delete(k);
      if (orphans.length)
        this.journal.record({ actor: null, action: 'FICHIERS_ORPHELINS_SUPPRIMES', fileId: null, summary: `${orphans.length} objet(s) sans fichier enregistré supprimé(s)`, context: {} });
    }
    return { objets: keys.length, orphelins: orphans.length, supprimes: opts.dryRun ? 0 : orphans.length };
  }

  // ---------------------------------------------------------------- interne

  private driverFor(name: DriverName): StorageDriver {
    return name === this.driver.name ? this.driver : driverFromEnv(process.env, name);
  }

  private async contentOf(file: StoredFile): Promise<Buffer> {
    const raw = await this.driverFor(file.driver).get(file.storageKey);
    let data: Buffer;
    if (file.encryption === 'AES256GCM') {
      if (!file.fileKey || !isSealed(raw)) throw new Error('Fichier chiffré illisible');
      try {
        data = openFile(raw, file.fileKey);
      } catch {
        // Le contrôle d'authenticité d'AES-GCM échoue : le contenu chiffré a été modifié.
        this.journal.record({ actor: null, action: 'FICHIER_ALTERE', fileId: file.id, summary: 'Contenu chiffré modifié dans le stockage', context: {} });
        throw new Error("Fichier altéré : le contenu chiffré a été modifié dans le stockage");
      }
    } else data = raw;
    if (sha256(data) !== file.sha256) {
      this.journal.record({ actor: null, action: 'FICHIER_ALTERE', fileId: file.id, summary: "Empreinte différente de celle enregistrée au dépôt", context: {} });
      throw new Error("Fichier altéré : l'empreinte ne correspond plus");
    }
    return data;
  }

  private async scan(actor: StorageActor | null, file: IncomingFile): Promise<AvStatus> {
    const av = this.settings.clamav;
    if (!av) {
      if (this.settings.antivirusRequired)
        this.reject(actor, file.originalname, 'Analyse antivirus indisponible : dépôt refusé', HttpStatus.SERVICE_UNAVAILABLE);
      return 'SKIPPED';
    }
    let signature: string | null = null;
    try {
      signature = await clamdScan(av.host, av.port, file.buffer);
    } catch (err) {
      this.logger.error(`Antivirus injoignable : dépôt refusé (${(err as Error).message})`);
      this.reject(actor, file.originalname, 'Analyse antivirus indisponible, réessayez plus tard', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (signature) this.reject(actor, file.originalname, `Fichier malveillant détecté (${signature})`);
    return 'CLEAN';
  }

  private async detectMime(file: IncomingFile, policy: UploadPolicy): Promise<string | null> {
    const ext = extname(file.originalname || '').toLowerCase();
    const detected = await FileType.fromBuffer(file.buffer);
    // Reprise de pièces existantes (preuves…) : tout type est conservé tel quel, l'antivirus et
    // l'empreinte s'appliquent ; jamais pour un dépôt ordinaire.
    if (policy.anyType) return detected?.mime ?? policy.textTypes?.[ext] ?? 'application/octet-stream';
    if (detected) {
      if (!policy.mimeTypes.includes(detected.mime)) return null;
      // Une extension présente doit correspondre au contenu (pas de « photo.jpg » qui serait un PDF).
      if (ext && !(EXTENSIONS[detected.mime] ?? []).includes(ext)) return null;
      return detected.mime;
    }
    const textMime = policy.textTypes?.[ext];
    // Texte : aucune signature binaire ; on exige l'absence d'octet nul.
    return textMime && !file.buffer.includes(0) ? textMime : null;
  }

  private displayName(name: string, mime: string): string {
    const clean = sanitizeName(name);
    if (extname(clean)) return clean;
    return `${clean}${(EXTENSIONS[mime] ?? [''])[0]}`;
  }

  private sign(payload: string): string {
    return createHmac('sha256', linkSecret()).update(payload).digest('base64url');
  }

  private reject(actor: StorageActor | null, name: string | undefined, reason: string, status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY): never {
    this.journal.record({ actor, action: 'FICHIER_REFUSE', fileId: null, summary: reason, context: { nom: sanitizeName(name ?? '').slice(0, 80) } });
    throw fileError(reason, status);
  }
}
