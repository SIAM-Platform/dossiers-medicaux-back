import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Journal d'audit du dossier médical (chaîné SHA-256, en ajout seul). `fields` et `context` sont
 * en `json` (texte conservé tel quel) et non `jsonb` : l'ordre des clés entre dans l'empreinte.
 * Les déclencheurs refusent toute modification, suppression ou vidage (même règle que le socle).
 */
export class AuditJournal1794688034400 implements MigrationInterface {
  name = 'AuditJournal1794688034400';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "audit_events" ("seq" bigint PRIMARY KEY, "id" varchar(36) NOT NULL UNIQUE, "occurred_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "actor_id" varchar(100), "actor_name" varchar(200) NOT NULL, "action" varchar(80) NOT NULL, "entity_type" varchar(60) NOT NULL, "entity_id" varchar(100), "route" varchar(200) NOT NULL, "status" smallint NOT NULL, "fields" json, "context" json, "ip" varchar(40), "prev_hash" char(64) NOT NULL, "hash" char(64) NOT NULL)`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_entity" ON "audit_events" ("entity_type", "entity_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_actor" ON "audit_events" ("actor_id", "occurred_at")`,
    );
    await q.query(
      `CREATE TABLE "audit_chain_head" ("id" smallint PRIMARY KEY, "seq" bigint NOT NULL, "hash" char(64) NOT NULL)`,
    );
    await q.query(
      `INSERT INTO "audit_chain_head" ("id", "seq", "hash") VALUES (1, 0, '${'0'.repeat(64)}')`,
    );
    await q.query(`CREATE OR REPLACE FUNCTION siam_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'SIAM_IMMUTABLE: % sur % interdit (table en ajout seul)', TG_OP, TG_TABLE_NAME;
      END $$`);
    await q.query(
      `CREATE TRIGGER "TRG_audit_events_append_only" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION siam_forbid_mutation()`,
    );
    await q.query(
      `CREATE TRIGGER "TRG_audit_events_no_truncate" BEFORE TRUNCATE ON "audit_events" FOR EACH STATEMENT EXECUTE FUNCTION siam_forbid_mutation()`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "audit_chain_head"`);
    await q.query(`DROP TABLE "audit_events"`);
  }
}
