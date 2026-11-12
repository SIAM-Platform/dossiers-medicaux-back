import { DataSource } from 'typeorm';
import { isMysql } from './sql';

/**
 * Tables du module RGPD, créées au démarrage si elles n'existent pas (idempotent, sous verrou) :
 * le module s'installe de la même façon quel que soit le mode de gestion du schéma du service
 * (migrations ou synchronisation). Le journal `privacy_audit_events` est en ajout seul : un
 * déclencheur refuse toute modification ou suppression, en PostgreSQL comme en MySQL.
 */
const PG = [
  `CREATE TABLE IF NOT EXISTS privacy_retention_policies (key varchar(60) PRIMARY KEY, days integer CHECK (days IS NULL OR days >= 1), reason text, updated_by varchar(100), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS privacy_counters (series varchar(40) PRIMARY KEY, value integer NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS privacy_requests (id varchar(36) PRIMARY KEY, reference varchar(32) NOT NULL UNIQUE, type varchar(16) NOT NULL CHECK (type IN ('ACCESS','RECTIFICATION','ERASURE','RESTRICTION','OBJECTION','PORTABILITY')), status varchar(16) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','IN_PROGRESS','COMPLETED','REJECTED')), subject_type varchar(30) NOT NULL, subject_ref text NOT NULL, requester_name text NOT NULL, requester_contact text, channel varchar(20) NOT NULL DEFAULT 'COURRIER', details text, received_at timestamptz NOT NULL, due_at timestamptz NOT NULL, response text, created_by varchar(100), handled_by varchar(100), closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS idx_privacy_requests_status_due ON privacy_requests (status, due_at)`,
  `CREATE TABLE IF NOT EXISTS privacy_audit_events (id varchar(36) PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(), actor_id varchar(100), actor_name varchar(200), action varchar(60) NOT NULL, entity_type varchar(60) NOT NULL, entity_id varchar(100), summary text, before jsonb, after jsonb, context jsonb)`,
  `CREATE OR REPLACE FUNCTION privacy_audit_forbid() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'SIAM_IMMUTABLE: privacy_audit_events est en ajout seul'; END $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_privacy_audit_immutable ON privacy_audit_events`,
  `CREATE TRIGGER trg_privacy_audit_immutable BEFORE UPDATE OR DELETE ON privacy_audit_events FOR EACH ROW EXECUTE FUNCTION privacy_audit_forbid()`,
];

const MY = [
  `CREATE TABLE IF NOT EXISTS privacy_retention_policies (\`key\` varchar(60) PRIMARY KEY, days int NULL, reason text NULL, updated_by varchar(100) NULL, updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), CONSTRAINT chk_privacy_days CHECK (days IS NULL OR days >= 1))`,
  `CREATE TABLE IF NOT EXISTS privacy_counters (series varchar(40) PRIMARY KEY, value int NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS privacy_requests (id varchar(36) PRIMARY KEY, reference varchar(32) NOT NULL UNIQUE, type varchar(16) NOT NULL, status varchar(16) NOT NULL DEFAULT 'RECEIVED', subject_type varchar(30) NOT NULL, subject_ref text NOT NULL, requester_name text NOT NULL, requester_contact text NULL, channel varchar(20) NOT NULL DEFAULT 'COURRIER', details text NULL, received_at datetime(3) NOT NULL, due_at datetime(3) NOT NULL, response text NULL, created_by varchar(100) NULL, handled_by varchar(100) NULL, closed_at datetime(3) NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX idx_privacy_requests_status_due (status, due_at), CONSTRAINT chk_privacy_type CHECK (type IN ('ACCESS','RECTIFICATION','ERASURE','RESTRICTION','OBJECTION','PORTABILITY')), CONSTRAINT chk_privacy_status CHECK (status IN ('RECEIVED','IN_PROGRESS','COMPLETED','REJECTED')))`,
  `CREATE TABLE IF NOT EXISTS privacy_audit_events (id varchar(36) PRIMARY KEY, occurred_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), actor_id varchar(100) NULL, actor_name varchar(200) NULL, action varchar(60) NOT NULL, entity_type varchar(60) NOT NULL, entity_id varchar(100) NULL, summary text NULL, \`before\` json NULL, \`after\` json NULL, context json NULL)`,
  `DROP TRIGGER IF EXISTS trg_privacy_audit_no_update`,
  `CREATE TRIGGER trg_privacy_audit_no_update BEFORE UPDATE ON privacy_audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SIAM_IMMUTABLE: privacy_audit_events est en ajout seul'`,
  `DROP TRIGGER IF EXISTS trg_privacy_audit_no_delete`,
  `CREATE TRIGGER trg_privacy_audit_no_delete BEFORE DELETE ON privacy_audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SIAM_IMMUTABLE: privacy_audit_events est en ajout seul'`,
];

export async function ensurePrivacySchema(ds: DataSource): Promise<void> {
  const runner = ds.createQueryRunner();
  await runner.connect();
  const mysql = isMysql(ds);
  try {
    // Verrou bloquant : plusieurs copies qui démarrent ensemble ne créent les tables qu'une fois.
    await runner.query(
      mysql
        ? `SELECT GET_LOCK('siam-privacy-schema', 60)`
        : `SELECT pg_advisory_lock(hashtext('siam-privacy-schema'))`,
    );
    try {
      for (const sql of mysql ? MY : PG) await runner.query(sql);
    } finally {
      await runner.query(
        mysql
          ? `SELECT RELEASE_LOCK('siam-privacy-schema')`
          : `SELECT pg_advisory_unlock(hashtext('siam-privacy-schema'))`,
      );
    }
  } finally {
    await runner.release();
  }
}
