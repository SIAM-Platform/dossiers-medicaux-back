import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bibliothèque de stockage SIAM : fichiers déposés (contenu chiffré dans le stockage, clé du
 * fichier chiffrée ici par la clé de données du service, empreinte SHA-256, rattachement métier).
 */
export class StoredFiles1794766942232 implements MigrationInterface {
  name = 'StoredFiles1794766942232';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "stored_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver" character varying(16) NOT NULL, "storage_key" character varying(512) NOT NULL, "original_name" character varying(255) NOT NULL, "mime_type" character varying(128) NOT NULL, "size_bytes" bigint NOT NULL, "sha256" character(64) NOT NULL, "av_status" character varying(16) NOT NULL, "encryption" character varying(16) NOT NULL DEFAULT 'NONE', "file_key" text, "owner_type" character varying(64), "owner_id" character varying(64), "read_permission" character varying(64), "uploaded_by" character varying(64), "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_d876a11b7afb1d51658687cd302" UNIQUE ("storage_key"), CONSTRAINT "PK_5d5be862bf53851c1794b4adf4e" PRIMARY KEY ("id"))`,
    );
    await q.query(`CREATE INDEX "IDX_stored_files_owner" ON "stored_files" ("owner_type", "owner_id")`);
    await q.query(`CREATE INDEX "IDX_stored_files_sha256" ON "stored_files" ("sha256")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "public"."IDX_stored_files_sha256"`);
    await q.query(`DROP INDEX "public"."IDX_stored_files_owner"`);
    await q.query(`DROP TABLE "stored_files"`);
  }
}
