import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { recordJob } from '../observability/metrics';

type Runner = DataSource | EntityManager | QueryRunner;

/** Dialecte de la base du service. */
export const isMysql = (ds: DataSource): boolean =>
  ['mysql', 'mariadb'].includes(ds.options.type);

/** Identifiant SQL protégé selon le dialecte. */
export const ident = (ds: DataSource, name: string): string =>
  isMysql(ds) ? `\`${name}\`` : `"${name}"`;

/**
 * Exécute une requête écrite avec `$1, $2…` (style PostgreSQL) sur PostgreSQL ou MySQL. Pour MySQL,
 * les marqueurs sont traduits en `?` et les paramètres réordonnés selon leur ordre d'apparition.
 */
export async function run<T = Record<string, unknown>>(
  ds: DataSource,
  on: Runner,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!isMysql(ds)) return (await on.query(sql, params)) as T[];
  const order: unknown[] = [];
  const converted = sql.replace(/\$(\d+)/g, (_, i: string) => {
    order.push(params[Number(i) - 1]);
    return '?';
  });
  return (await on.query(converted, order)) as T[];
}

/** Nombre de lignes modifiées par un UPDATE / DELETE, quel que soit le pilote. */
export function affected(res: unknown, fallback: number): number {
  if (Array.isArray(res) && typeof res[1] === 'number') return res[1];
  const r = res as { affectedRows?: number } | undefined;
  if (r && typeof r.affectedRows === 'number') return r.affectedRows;
  return fallback;
}

/** Tables du schéma courant qui ont la colonne donnée. */
export async function tablesWithColumn(
  ds: DataSource,
  column: string,
): Promise<string[]> {
  const rows = isMysql(ds)
    ? await run<{ t: string }>(
        ds,
        ds,
        `SELECT table_name AS t FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = $1 ORDER BY table_name`,
        [column],
      )
    : await run<{ t: string }>(
        ds,
        ds,
        `SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = $1 ORDER BY table_name`,
        [column],
      );
  return rows.map((r) => r.t ?? (r as unknown as { T: string }).T);
}

/**
 * Exécute `fn` dans une seule copie du service à la fois (verrou de session : `pg_try_advisory_lock`
 * ou `GET_LOCK` MySQL), sur une connexion dédiée. Autre copie en cours : tour sauté.
 */
export async function runExclusive<T>(
  ds: DataSource,
  name: string,
  fn: () => Promise<T>,
): Promise<{ ran: boolean; result?: T }> {
  const runner = ds.createQueryRunner();
  await runner.connect();
  const key = `siam-job:${name}`;
  try {
    const mysql = isMysql(ds);
    const [row] = (await runner.query(
      mysql
        ? 'SELECT GET_LOCK(?, 0) AS locked'
        : 'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [key],
    )) as { locked: unknown }[];
    if (!(row?.locked === true || Number(row?.locked) === 1))
      return { ran: false };
    try {
      // Durée et résultat de la tâche réellement exécutée (métriques siam_job_*).
      const started = Date.now();
      try {
        const result = await fn();
        recordJob(name, true, Date.now() - started);
        return { ran: true, result };
      } catch (e) {
        recordJob(name, false, Date.now() - started);
        throw e;
      }
    } finally {
      await runner
        .query(
          mysql
            ? 'SELECT RELEASE_LOCK(?)'
            : 'SELECT pg_advisory_unlock(hashtext($1))',
          [key],
        )
        .catch(() => undefined);
    }
  } finally {
    await runner.release();
  }
}

/** Valeur reçue (corps de requête, ligne SQL) convertie en texte, sans « [object Object] ». */
export function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint')
    return v.toString();
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}
