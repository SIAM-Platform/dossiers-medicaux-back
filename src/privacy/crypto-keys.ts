import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  decryptField,
  encryptField,
  ENCRYPTING_TRANSFORMERS,
  encryptedJson,
  keyIdOf,
} from './field-cipher';
import {
  activeDataKey,
  fingerprint,
  initialBlindKey,
  installKeyring,
  keyringInstalled,
  masterKey,
  newDataKey,
  unwrapKey,
  wrapKey,
} from './keyring';
import { ident, isMysql, run } from './sql';

/**
 * Trousseau du chiffrement des champs, version autonome des services hors socle (PostgreSQL ou
 * MySQL) : même format et même logique que le socle SIAM (`src/core/crypto` des services du socle).
 * La table `crypto_keys` est créée au démarrage si elle n'existe pas.
 */

type Env = Record<string, string | undefined>;
const LOCK = 'siam-crypto-keys';
const BLIND_ID = 'blind-index';

interface KeyRow {
  id: string;
  status: 'ACTIVE' | 'RETIRED' | 'BLIND';
  wrapped: string;
}

export interface EncryptedColumn {
  table: string;
  column: string;
  primaryKeys: string[];
  json: boolean;
  sqlType: string;
}

export function encryptedColumns(ds: DataSource): EncryptedColumn[] {
  const out: EncryptedColumn[] = [];
  for (const meta of ds.entityMetadatas) {
    for (const col of meta.columns) {
      const t = col.transformer;
      if (!t || Array.isArray(t) || !ENCRYPTING_TRANSFORMERS.includes(t))
        continue;
      out.push({
        table: meta.tableName,
        column: col.databaseName,
        primaryKeys: meta.primaryColumns.map((p) => p.databaseName),
        json: t === encryptedJson,
        sqlType: String(col.type),
      });
    }
  }
  return out;
}

async function ensureTable(ds: DataSource, m: EntityManager): Promise<void> {
  await m.query(
    isMysql(ds)
      ? `CREATE TABLE IF NOT EXISTS crypto_keys (id varchar(32) PRIMARY KEY, status varchar(10) NOT NULL, wrapped text NOT NULL, master_fingerprint varchar(16) NOT NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), retired_at datetime(3) NULL)`
      : `CREATE TABLE IF NOT EXISTS crypto_keys (id varchar(32) PRIMARY KEY, status varchar(10) NOT NULL CHECK (status IN ('ACTIVE','RETIRED','BLIND')), wrapped text NOT NULL, master_fingerprint varchar(16) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz)`,
  );
}

/** Exclusion entre copies : verrou consultatif (PostgreSQL) ou nommé (MySQL), puis transaction. */
async function withLock<T>(
  ds: DataSource,
  fn: (m: EntityManager) => Promise<T>,
): Promise<T> {
  const runner = ds.createQueryRunner();
  await runner.connect();
  const mysql = isMysql(ds);
  try {
    await runner.query(
      mysql
        ? `SELECT GET_LOCK(?, 60)`
        : `SELECT pg_advisory_lock(hashtext($1))`,
      [LOCK],
    );
    try {
      await ensureTable(ds, runner.manager);
      await runner.startTransaction();
      try {
        const r = await fn(runner.manager);
        await runner.commitTransaction();
        return r;
      } catch (e) {
        await runner.rollbackTransaction();
        throw e;
      }
    } finally {
      await runner
        .query(
          mysql
            ? `SELECT RELEASE_LOCK(?)`
            : `SELECT pg_advisory_unlock(hashtext($1))`,
          [LOCK],
        )
        .catch(() => undefined);
    }
  } finally {
    await runner.release();
  }
}

const insertKey = (
  ds: DataSource,
  m: EntityManager,
  id: string,
  status: string,
  wrapped: string,
  fp: string,
) =>
  run(
    ds,
    m,
    `INSERT INTO crypto_keys (id, status, wrapped, master_fingerprint) VALUES ($1, $2, $3, $4)`,
    [id, status, wrapped, fp],
  );

export async function loadKeyring(
  ds: DataSource,
  env: Env = process.env,
  logger = new Logger('Crypto'),
): Promise<void> {
  const kek = masterKey(env);
  const fp = fingerprint(kek);
  await withLock(ds, async (m) => {
    const read = async () =>
      run<KeyRow>(
        ds,
        m,
        `SELECT id, status, wrapped FROM crypto_keys ORDER BY created_at`,
      );
    let rows = await read();
    if (!rows.some((r) => r.status === 'ACTIVE')) {
      const k = newDataKey();
      await insertKey(ds, m, k.id, 'ACTIVE', wrapKey(kek, k.id, k.key), fp);
      logger.log(`Première clé de données créée (${k.id})`);
    }
    if (!rows.some((r) => r.status === 'BLIND'))
      await insertKey(
        ds,
        m,
        BLIND_ID,
        'BLIND',
        wrapKey(kek, BLIND_ID, initialBlindKey(kek)),
        fp,
      );
    rows = await read();
    const keys = new Map<string, Buffer>();
    let blind: Buffer | undefined;
    for (const r of rows) {
      const k = unwrapKey(kek, r.id, r.wrapped);
      if (r.status === 'BLIND') blind = k;
      else keys.set(r.id, k);
    }
    const active = rows.find((r) => r.status === 'ACTIVE')!;
    installKeyring(keys, active.id, kek, blind);
    logger.log(
      `Trousseau chargé : clé active ${active.id}, ${keys.size} clé(s) de données, clé maître ${fp}`,
    );
  });
}

export async function rotateDataKey(
  ds: DataSource,
  env: Env = process.env,
): Promise<{ previous: string | null; active: string }> {
  const kek = masterKey(env);
  const res = await withLock(ds, async (m) => {
    const [prev] = await run<{ id: string }>(
      ds,
      m,
      `SELECT id FROM crypto_keys WHERE status = 'ACTIVE'`,
    );
    await run(
      ds,
      m,
      `UPDATE crypto_keys SET status = 'RETIRED', retired_at = $1 WHERE status = 'ACTIVE'`,
      [new Date()],
    );
    const k = newDataKey();
    await insertKey(
      ds,
      m,
      k.id,
      'ACTIVE',
      wrapKey(kek, k.id, k.key),
      fingerprint(kek),
    );
    return { previous: prev?.id ?? null, active: k.id };
  });
  await loadKeyring(ds, env);
  return res;
}

export async function rewrapKeys(
  ds: DataSource,
  env: Env = process.env,
): Promise<{ keys: number; from: string; to: string }> {
  const oldKek = masterKey(env, 'FIELD_MASTER_KEY_PREVIOUS');
  const newKek = masterKey(env);
  const res = await withLock(ds, async (m) => {
    const rows = await run<KeyRow>(
      ds,
      m,
      `SELECT id, status, wrapped FROM crypto_keys`,
    );
    for (const r of rows)
      await run(
        ds,
        m,
        `UPDATE crypto_keys SET wrapped = $1, master_fingerprint = $2 WHERE id = $3`,
        [
          wrapKey(newKek, r.id, unwrapKey(oldKek, r.id, r.wrapped)),
          fingerprint(newKek),
          r.id,
        ],
      );
    return {
      keys: rows.length,
      from: fingerprint(oldKek),
      to: fingerprint(newKek),
    };
  });
  await loadKeyring(ds, env);
  return res;
}

export async function keyUsage(ds: DataSource): Promise<
  {
    table: string;
    column: string;
    byKey: Record<string, number>;
    clear: number;
  }[]
> {
  const out: {
    table: string;
    column: string;
    byKey: Record<string, number>;
    clear: number;
  }[] = [];
  const mysql = isMysql(ds);
  for (const c of encryptedColumns(ds)) {
    const col = c.json
      ? mysql
        ? `JSON_UNQUOTE(JSON_EXTRACT(${ident(ds, c.column)}, '$.enc'))`
        : `(${ident(ds, c.column)}->>'enc')`
      : ident(ds, c.column);
    const keyOf = mysql
      ? `SUBSTRING_INDEX(SUBSTRING_INDEX(${col}, ':', 3), ':', -1)`
      : `split_part(${col}, ':', 3)`;
    const rows = await run<{ k: string; n: number | string }>(
      ds,
      ds,
      `SELECT CASE WHEN ${col} LIKE 'enc:v2:%' THEN ${keyOf} WHEN ${col} LIKE 'enc:v1:%' THEN 'v1' ELSE 'clair' END AS k, count(*) AS n
         FROM ${ident(ds, c.table)} WHERE ${ident(ds, c.column)} IS NOT NULL AND ${ident(ds, c.column)} <> '' GROUP BY 1`,
    );
    const byKey: Record<string, number> = {};
    let clear = 0;
    for (const r of rows) {
      if (r.k === 'clair') clear = Number(r.n);
      else byKey[r.k] = Number(r.n);
    }
    out.push({ table: c.table, column: c.column, byKey, clear });
  }
  return out;
}

export async function reencryptAll(
  ds: DataSource,
  opts: { batch?: number; onProgress?: (msg: string) => void } = {},
): Promise<{ table: string; column: string; updated: number }[]> {
  const active = activeDataKey();
  if (!active) throw new Error('Trousseau non chargé');
  const batch = opts.batch ?? 500;
  const mysql = isMysql(ds);
  const out: { table: string; column: string; updated: number }[] = [];
  for (const c of encryptedColumns(ds)) {
    if (c.json) continue; // aucune colonne JSON chiffrée dans les services hors socle
    const col = ident(ds, c.column);
    const pk = c.primaryKeys.map((k) => ident(ds, k)).join(', ');
    let updated = 0;
    for (;;) {
      const n = await ds.transaction(async (m) => {
        const rows = await run<Record<string, unknown>>(
          ds,
          m,
          `SELECT ${pk}, ${col} AS v FROM ${ident(ds, c.table)} WHERE ${col} IS NOT NULL AND ${col} <> '' AND ${col} NOT LIKE $1 LIMIT ${batch} FOR UPDATE${mysql ? '' : ' SKIP LOCKED'}`,
          [`enc:v2:${active.id}:%`],
        );
        for (const r of rows) {
          const v = String(r.v);
          const where = c.primaryKeys
            .map((k, i) => `${ident(ds, k)} = $${i + 2}`)
            .join(' AND ');
          await run(
            ds,
            m,
            `UPDATE ${ident(ds, c.table)} SET ${col} = $1 WHERE ${where}`,
            [
              encryptField(keyIdOf(v) ? decryptField(v) : v),
              ...c.primaryKeys.map((k) => r[k]),
            ],
          );
        }
        return rows.length;
      });
      updated += n;
      if (n < batch) break;
      opts.onProgress?.(
        `${c.table}.${c.column} : ${updated} valeur(s) re-chiffrée(s)…`,
      );
    }
    out.push({ table: c.table, column: c.column, updated });
  }
  return out;
}

export async function purgeRetiredKeys(
  ds: DataSource,
  minAgeHours = Number(process.env.CRYPTO_PURGE_MIN_AGE_HOURS ?? 24),
): Promise<string[]> {
  const used = new Set(
    (await keyUsage(ds)).flatMap((u) => Object.keys(u.byKey)),
  );
  return withLock(ds, async (m) => {
    const limit = new Date(Date.now() - minAgeHours * 3600_000);
    const retired = await run<{ id: string }>(
      ds,
      m,
      `SELECT id FROM crypto_keys WHERE status = 'RETIRED' AND retired_at <= $1`,
      [limit],
    );
    const removable = retired.map((r) => r.id).filter((id) => !used.has(id));
    for (const id of removable)
      await run(ds, m, `DELETE FROM crypto_keys WHERE id = $1`, [id]);
    return removable;
  });
}

/** Charge le trousseau au démarrage et le recharge périodiquement (voir la version du socle). */
@Injectable()
export class CryptoKeysService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Crypto');
  private timer: NodeJS.Timeout | null = null;

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (!keyringInstalled())
      await loadKeyring(this.ds, process.env, this.logger);
    const every = Number(process.env.CRYPTO_KEYRING_REFRESH_SECONDS ?? 60);
    if (every > 0) {
      this.timer = setInterval(() => void this.refresh(), every * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh(): Promise<void> {
    const before = activeDataKey()?.id;
    try {
      await loadKeyring(this.ds, process.env, {
        log: () => undefined,
      } as unknown as Logger);
      const after = activeDataKey()?.id;
      if (after !== before)
        this.logger.log(`Clé de données active : ${before} -> ${after}`);
    } catch (e) {
      this.logger.error(
        `Rechargement du trousseau impossible, clés actuelles conservées : ${(e as Error).message}`,
      );
    }
  }
}
