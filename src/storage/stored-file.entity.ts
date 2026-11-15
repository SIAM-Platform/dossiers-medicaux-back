import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { fileKeyTransformer } from './storage.adapter';

export type AvStatus = 'CLEAN' | 'SKIPPED';
export type FileEncryption = 'AES256GCM' | 'NONE';

/**
 * Fichier déposé (bibliothèque de stockage SIAM). Le contenu est chiffré par SIAM avant d'être
 * envoyé au stockage ; sa clé est en base, chiffrée par la clé de données du service. L'empreinte
 * SHA-256 porte sur le contenu en clair : elle est vérifiée à chaque lecture.
 * Les noms de colonnes sont explicites : la table est identique dans les 15 services.
 */
@Entity('stored_files')
@Index('IDX_stored_files_sha256', ['sha256'])
@Index('IDX_stored_files_owner', ['ownerType', 'ownerId'])
export class StoredFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'driver', type: 'varchar', length: 16 })
  driver!: 'local' | 's3';

  @Column({ name: 'storage_key', type: 'varchar', length: 512, unique: true })
  storageKey!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  /** Type détecté à partir du contenu, jamais celui déclaré par le client. */
  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  sizeBytes!: number;

  @Column({ name: 'sha256', type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'av_status', type: 'varchar', length: 16 })
  avStatus!: AvStatus;

  @Column({ name: 'encryption', type: 'varchar', length: 16, default: 'NONE' })
  encryption!: FileEncryption;

  /** Clé du fichier, chiffrée par la clé de données du service (rotation par `crypto:keys`). */
  @Column({ name: 'file_key', type: 'text', nullable: true, transformer: fileKeyTransformer })
  fileKey!: string | null;

  /** Objet métier auquel le fichier est rattaché (ex. ExamenClinique / 42). */
  @Column({ name: 'owner_type', type: 'varchar', length: 64, nullable: true })
  ownerType!: string | null;

  @Column({ name: 'owner_id', type: 'varchar', length: 64, nullable: true })
  ownerId!: string | null;

  /** Permission exigée pour obtenir un lien de téléchargement (null : lien émis par le code métier). */
  @Column({ name: 'read_permission', type: 'varchar', length: 64, nullable: true })
  readPermission!: string | null;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 64, nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
