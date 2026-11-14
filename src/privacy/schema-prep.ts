import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { encryptedColumns } from './crypto-keys';
import { ident, isMysql, run } from './sql';

/**
 * Prépare les colonnes chiffrées **avant** la synchronisation automatique du schéma (TypeORM
 * `synchronize`). Une valeur chiffrée est du texte (`enc:v2:…`) : chaque colonne chiffrée doit être
 * de type TEXT et nullable. Or, quand le type d'une colonne change, la synchronisation de TypeORM
 * **supprime puis recrée** la colonne, ce qui effacerait les données. On convertit donc ici les
 * colonnes avec `ALTER … MODIFY / ALTER TYPE`, qui **conserve les valeurs** (converties en texte,
 * relues par les transformers `encryptedNumber`, `encryptedBoolean`, `encryptedDate`) ; la
 * synchronisation ne voit ensuite plus aucune différence.
 *
 * Les index posés sur ces colonnes (unicité d'un numéro, par exemple) sont supprimés : une valeur
 * chiffrée est différente à chaque écriture, l'unicité passe par les colonnes d'index aveugle.
 * Idempotent : sans effet quand tout est déjà converti.
 */
export async function prepareEncryptedColumns(
  ds: DataSource,
  logger = new Logger('Crypto'),
): Promise<string[]> {
  const mysql = isMysql(ds);
  const changed: string[] = [];
  for (const c of encryptedColumns(ds)) {
    if (c.json) continue; // colonne JSON : l'objet chiffré reste du JSON ({ "enc": "…" }), type inchangé
    const [info] = await run<{
      data_type?: string;
      DATA_TYPE?: string;
      is_nullable?: string;
      IS_NULLABLE?: string;
    }>(
      ds,
      ds,
      mysql
        ? `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = $1 AND column_name = $2`
        : `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
      [c.table, c.column],
    );
    if (!info) continue; // table ou colonne pas encore créée : la synchronisation la créera en TEXT
    const type = String(info.data_type ?? info.DATA_TYPE).toLowerCase();
    const nullable =
      String(info.is_nullable ?? info.IS_NULLABLE).toUpperCase() === 'YES';
    if (type === 'text' && nullable) continue;
    const t = ident(ds, c.table);
    const col = ident(ds, c.column);
    if (mysql) {
      const idx = await run<{ name?: string; NAME?: string }>(
        ds,
        ds,
        `SELECT DISTINCT index_name AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = $1 AND column_name = $2 AND index_name <> 'PRIMARY'`,
        [c.table, c.column],
      );
      for (const i of idx)
        await ds.query(
          `ALTER TABLE ${t} DROP INDEX ${ident(ds, String(i.name ?? i.NAME))}`,
        );
      await ds.query(`ALTER TABLE ${t} MODIFY ${col} TEXT NULL`);
    } else {
      const cons = await run<{ name: string }>(
        ds,
        ds,
        `SELECT tc.constraint_name AS name FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage cu ON cu.constraint_name = tc.constraint_name
          WHERE tc.table_name = $1 AND cu.column_name = $2 AND tc.constraint_type = 'UNIQUE'`,
        [c.table, c.column],
      );
      for (const k of cons)
        await ds.query(`ALTER TABLE ${t} DROP CONSTRAINT ${ident(ds, k.name)}`);
      await ds.query(
        `ALTER TABLE ${t} ALTER COLUMN ${col} DROP DEFAULT, ALTER COLUMN ${col} TYPE text USING ${col}::text, ALTER COLUMN ${col} DROP NOT NULL`,
      );
    }
    changed.push(`${c.table}.${c.column}`);
  }
  if (changed.length)
    logger.log(
      `Colonnes préparées pour le chiffrement (TEXT, données conservées) : ${changed.join(', ')}`,
    );
  return changed;
}

/**
 * Chiffre les valeurs encore en clair dans les colonnes chiffrées (données antérieures au
 * chiffrement), par lots, sans toucher aux valeurs déjà chiffrées. Idempotent.
 */
export async function encryptPlaintext(
  ds: DataSource,
  encrypt: (v: string) => string,
  batch = 500,
): Promise<number> {
  let total = 0;
  for (const c of encryptedColumns(ds)) {
    const t = ident(ds, c.table);
    const col = ident(ds, c.column);
    const pk = c.primaryKeys.map((k) => ident(ds, k)).join(', ');
    for (;;) {
      const n = await ds.transaction(async (m) => {
        const pending = c.json
          ? isMysql(ds)
            ? `JSON_EXTRACT(${col}, '$.enc') IS NULL`
            : `NOT (jsonb_typeof(${col}::jsonb) = 'object' AND ${col}::jsonb ? 'enc')`
          : `${col} <> '' AND ${col} NOT LIKE 'enc:%'`;
        const rows = await run<Record<string, unknown>>(
          ds,
          m,
          `SELECT ${pk}, ${col} AS v FROM ${t} WHERE ${col} IS NOT NULL AND ${pending} LIMIT ${batch} FOR UPDATE`,
        );
        for (const r of rows) {
          const where = c.primaryKeys
            .map((k, i) => `${ident(ds, k)} = $${i + 2}`)
            .join(' AND ');
          const plain = c.json
            ? typeof r.v === 'string'
              ? r.v
              : JSON.stringify(r.v)
            : String(r.v);
          const next = c.json
            ? JSON.stringify({ enc: encrypt(plain) })
            : encrypt(plain);
          await run(ds, m, `UPDATE ${t} SET ${col} = $1 WHERE ${where}`, [
            next,
            ...c.primaryKeys.map((k) => r[k]),
          ]);
        }
        return rows.length;
      });
      total += n;
      if (n < batch) break;
    }
  }
  return total;
}
