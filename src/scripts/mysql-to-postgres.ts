/**
 * Transfert unique des données DMGM de MySQL/MariaDB vers PostgreSQL, vérifié ligne par ligne.
 *
 *   MYSQL_HOST=… MYSQL_PORT=3306 MYSQL_USER=… MYSQL_PASSWORD=… MYSQL_DB=siam_dmgm \
 *   DB_HOST=… DB_PORT=5432 DB_USERNAME=… DB_PASSWORD=… DB_NAME=siam_dmgm \
 *   npm run db:transfer-mysql            (production : node dist/scripts/mysql-to-postgres.js)
 *
 * Déroulé :
 *  1. applique les migrations PostgreSQL et crée les tables RGPD et du trousseau de clés ;
 *  2. refuse de continuer si une table cible contient déjà des données (aucun écrasement) ;
 *  3. copie toutes les tables dans l'ordre des dépendances, identifiants compris, dans UNE
 *     transaction (tout ou rien) : les valeurs chiffrées, les clés de chiffrement (protégées par la
 *     clé maître, inchangée) et le journal d'audit chaîné sont copiés tels quels ;
 *  4. recale les compteurs d'identifiants ;
 *  5. relit les deux bases et compare chaque ligne de chaque table (valeurs normalisées) puis
 *     vérifie la chaîne d'audit ; tout écart fait échouer le transfert (code de sortie 1).
 * La base MySQL n'est jamais modifiée.
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { createConnection, Connection, RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../config/database.config';
import { ensurePrivacySchema } from '../privacy/schema';

/** Tables dans l'ordre des dépendances (parents d'abord). */
export const TRANSFER_TABLES = [
  'role',
  'user',
  'user_roles_role',
  'typevisite',
  'fonction_a_bord',
  'typenavire',
  'categorieautodeclaration',
  'questionautodeclaration',
  'medecin',
  'infirmier',
  'marin',
  'visitemedicale',
  'constante',
  'examenclinique',
  'conclusion',
  'vaccination',
  'test_drogue',
  'commentairecategorie',
  'reponseautodeclaration',
  'certificat',
  'examcomplementaire',
  'crypto_keys',
  'audit_events',
  'audit_chain_head',
  'privacy_retention_policies',
  'privacy_counters',
  'privacy_requests',
  'privacy_audit_events',
];

interface TargetColumn {
  name: string;
  type: string;
}

const q = (n: string) => `"${n.replace(/"/g, '""')}"`;

/** JSON à clés triées : `jsonb` ne conserve pas l'ordre des clés, le contenu seul est comparé. */
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
        )
      : v;

/** Valeur MySQL convertie pour la colonne PostgreSQL cible. */
export function convert(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (Buffer.isBuffer(value)) return value[0] === 1;
    return Number(value) === 1 || value === '1' || value === 'true';
  }
  if (type === 'json' || type === 'jsonb')
    return typeof value === 'string' ? value : JSON.stringify(value);
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  // Date MySQL (base d'avant la 2.0, colonne DATETIME) copiée dans une colonne devenue TEXT
  // (chiffrée) : écrite en ISO, comme le fait l'application ; le chiffrement suit au démarrage.
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Forme comparable d'une valeur, identique quelle que soit la base d'origine. */
export function canonical(value: unknown, type: string): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (type === 'boolean') return String(convert(value, 'boolean'));
  if (type === 'json' || type === 'jsonb') {
    const v: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(sorted(v));
  }
  if (type.startsWith('timestamp') || type === 'date')
    return new Date(value as string).toISOString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- valeur scalaire (nombre, texte)
  return String(value);
}

async function targetColumns(
  pg: DataSource,
  table: string,
): Promise<TargetColumn[]> {
  const rows: { column_name: string; data_type: string }[] = await pg.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, type: r.data_type }));
}

async function sourceRows(
  my: Connection,
  table: string,
): Promise<Record<string, unknown>[]> {
  const [exists] = await my.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  if (!Number(exists[0].n)) return [];
  const [rows] = await my.query<RowDataPacket[]>(`SELECT * FROM \`${table}\``);
  return rows;
}

/** Clé de tri stable d'une ligne (clé primaire ou ligne entière). */
function rowKey(row: Record<string, unknown>, cols: TargetColumn[]): string {
  return cols.map((c) => canonical(row[c.name], c.type)).join('\u0001');
}

function digest(
  rows: Record<string, unknown>[],
  cols: TargetColumn[],
): { count: number; hash: string } {
  const keys = rows.map((r) => rowKey(r, cols)).sort();
  return {
    count: rows.length,
    hash: createHash('sha256').update(keys.join('\n')).digest('hex'),
  };
}

export async function transfer(
  env: NodeJS.ProcessEnv,
  log: (s: string) => void = console.log,
): Promise<boolean> {
  const my = await createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DB,
    // Dates relues dans le fuseau du serveur applicatif, comme le faisait l'application.
    timezone: 'local',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const pg = await new DataSource({
    ...databaseOptions(env),
    migrationsRun: false,
  }).initialize();
  try {
    await pg.runMigrations({ transaction: 'each' });
    await ensurePrivacySchema(pg);
    await pg.query(
      `CREATE TABLE IF NOT EXISTS crypto_keys (id varchar(32) PRIMARY KEY, status varchar(10) NOT NULL CHECK (status IN ('ACTIVE','RETIRED','BLIND')), wrapped text NOT NULL, master_fingerprint varchar(16) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz)`,
    );

    const plan: {
      table: string;
      cols: TargetColumn[];
      rows: Record<string, unknown>[];
    }[] = [];
    for (const table of TRANSFER_TABLES) {
      const cols = await targetColumns(pg, table);
      if (!cols.length) throw new Error(`Table cible absente : ${table}`);
      const filled = table === 'audit_chain_head' ? `WHERE seq > 0` : '';
      const [{ n }]: { n: number }[] = await pg.query(
        `SELECT COUNT(*)::int AS n FROM ${q(table)} ${filled}`,
      );
      if (n > 0)
        throw new Error(
          `La table cible ${table} contient déjà ${n} ligne(s) : transfert refusé (aucun écrasement).`,
        );
      const rows = await sourceRows(my, table);
      const srcCols = rows.length ? Object.keys(rows[0]) : [];
      const missing = srcCols.filter((c) => !cols.some((t) => t.name === c));
      if (missing.length)
        throw new Error(
          `Colonnes MySQL sans équivalent dans ${table} : ${missing.join(', ')}`,
        );
      plan.push({
        table,
        cols: cols.filter((c) => !rows.length || srcCols.includes(c.name)),
        rows,
      });
    }

    await pg.transaction(async (m) => {
      for (const { table, cols, rows } of plan) {
        if (table === 'audit_chain_head') {
          for (const r of rows)
            await m.query(
              `UPDATE "audit_chain_head" SET seq = $1, hash = $2 WHERE id = $3`,
              [r.seq, r.hash, r.id],
            );
          continue;
        }
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const params: unknown[] = [];
          const values = chunk.map(
            (r) =>
              `(${cols.map((c) => `$${params.push(convert(r[c.name], c.type))}`).join(', ')})`,
          );
          await m.query(
            `INSERT INTO ${q(table)} (${cols.map((c) => q(c.name)).join(', ')}) VALUES ${values.join(', ')}`,
            params,
          );
        }
        log(`  ${table} : ${rows.length} ligne(s)`);
      }
      // Compteurs d'identifiants recalés sur la plus grande valeur copiée.
      const serials: {
        table_name: string;
        column_name: string;
        seq: string;
      }[] = await m.query(
        `SELECT c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq FROM information_schema.columns c WHERE c.table_schema = current_schema() AND c.column_default LIKE 'nextval%'`,
      );
      for (const s of serials) {
        if (!s.seq) continue;
        await m.query(
          `SELECT setval($1, COALESCE((SELECT MAX(${q(s.column_name)}) FROM ${q(s.table_name)}), 0) + 1, false)`,
          [s.seq],
        );
      }
    });

    // Vérification : chaque table relue des deux côtés, valeurs normalisées et comparées.
    let ok = true;
    for (const { table, cols } of plan) {
      // Tête de la chaîne d'audit : la migration crée une tête vide (seq 0) ; une base d'avant la
      // 2.0 n'a pas de journal. Seules les têtes non vides sont comparées.
      const kept = (rows: Record<string, unknown>[]) =>
        table === 'audit_chain_head'
          ? rows.filter((r) => Number(r.seq) > 0)
          : rows;
      const src = digest(kept(await sourceRows(my, table)), cols);
      const dst = digest(
        kept(await pg.query(`SELECT * FROM ${q(table)}`)),
        cols,
      );
      const same = src.count === dst.count && src.hash === dst.hash;
      if (!same) ok = false;
      log(
        `${same ? 'IDENTIQUE' : 'ÉCART   '}  ${table} : ${src.count} → ${dst.count}`,
      );
    }
    // Marque posée seulement après une vérification réussie : le démarrage ne relance plus le transfert.
    if (ok) {
      await pg.query(
        `CREATE TABLE IF NOT EXISTS ${TRANSFER_MARK} (done_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL)`,
      );
      await pg.query(`INSERT INTO ${TRANSFER_MARK} (source) VALUES ($1)`, [
        `${env.MYSQL_HOST || 'localhost'}/${env.MYSQL_DB ?? ''}`,
      ]);
    }
    return ok;
  } finally {
    await my.end();
    await pg.destroy();
  }
}

/** Table témoin d'un transfert terminé et vérifié. */
const TRANSFER_MARK = 'mysql_transfer';

/**
 * Transfert au démarrage du service (MYSQL_TRANSFER_ON_START=true), pour les plateformes où l'on
 * ne lance pas de commande avant le premier démarrage (Coolify) : exécuté avant l'application,
 * donc sur une base PostgreSQL encore vide ; ignoré une fois la marque posée. En cas d'échec, le
 * service ne démarre pas (rien n'est écrit par l'application).
 */
export async function transferOnStart(
  env: NodeJS.ProcessEnv,
  log: (s: string) => void = console.log,
): Promise<void> {
  const pg = await new DataSource({
    ...databaseOptions(env),
    migrationsRun: false,
  }).initialize();
  try {
    const [{ mark }]: { mark: string | null }[] = await pg.query(
      `SELECT to_regclass('public.${TRANSFER_MARK}')::text AS mark`,
    );
    if (mark) {
      log(
        'Transfert MySQL déjà fait : ignoré (retirer MYSQL_TRANSFER_ON_START).',
      );
      return;
    }
  } finally {
    await pg.destroy();
  }
  log('Transfert MySQL → PostgreSQL avant le démarrage…');
  if (!(await transfer(env, log)))
    throw new Error(
      'ÉCHEC du transfert : des écarts ont été trouvés (voir ci-dessus). Recréer la base PostgreSQL vide avant de relancer.',
    );
  log('Transfert terminé et vérifié : toutes les tables sont identiques.');
}

if (require.main === module) {
  transfer(process.env)
    .then((ok) => {
      console.log(
        ok
          ? 'Transfert terminé et vérifié : toutes les tables sont identiques.'
          : 'ÉCHEC : des écarts ont été trouvés (voir ci-dessus).',
      );
      process.exit(ok ? 0 : 1);
    })
    .catch((e: Error) => {
      console.error(`Transfert interrompu, rien n'a été écrit : ${e.message}`);
      process.exit(1);
    });
}
