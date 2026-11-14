import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ValueTransformer } from 'typeorm';
import { activeDataKey, dataKey, legacyKey } from './keyring';

/**
 * Chiffrement applicatif AES-256-GCM des champs sensibles, champ par champ (docs/conception/04 §7).
 *
 * Format courant : `enc:v2:<id de clé>:<base64(iv | tag | texte chiffré)>`, avec la clé de données
 * active du trousseau (voir `keyring.ts`). Le format historique `enc:v1:<base64>` (clé
 * `FIELD_ENCRYPTION_KEY`) reste lisible ; l'outil `key-admin` le convertit (`reencrypt`).
 * Avant l'installation du trousseau (tests unitaires, scripts sans base), le format v1 est utilisé.
 *
 * Chaque chiffrement tire un vecteur d'initialisation aléatoire : deux valeurs égales donnent deux
 * textes chiffrés différents. Pour rechercher une valeur exacte, utiliser un index aveugle
 * (`blind-index.ts`), jamais une comparaison sur le texte chiffré.
 */

const V1 = 'enc:v1:';
const V2 = 'enc:v2:';

function seal(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function open(key: Buffer, payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptField(plain: string): string {
  const active = activeDataKey();
  if (!active) return V1 + seal(legacyKey(), plain);
  return `${V2}${active.id}:${seal(active.key, plain)}`;
}

export function decryptField(stored: string): string {
  if (stored.startsWith(V2)) {
    const rest = stored.slice(V2.length);
    const sep = rest.indexOf(':');
    return open(dataKey(rest.slice(0, sep)), rest.slice(sep + 1));
  }
  if (stored.startsWith(V1)) return open(legacyKey(), stored.slice(V1.length));
  return stored;
}

/** Identifiant de la clé qui a chiffré une valeur (`v1` pour l'ancien format, null si en clair). */
export function keyIdOf(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  if (stored.startsWith(V2))
    return stored.slice(V2.length, stored.indexOf(':', V2.length));
  if (stored.startsWith(V1)) return 'v1';
  return null;
}

export const isEncrypted = (v: unknown): boolean => keyIdOf(v) !== null;

/** Transformer TypeORM : chiffre à l'écriture, déchiffre à la lecture. */
export const encrypted: ValueTransformer = {
  to: (v?: string | null) =>
    v === null || v === undefined || v === '' ? v : encryptField(v),
  from: (v?: string | null) => (v ? decryptField(v) : v),
};

/** Transformer TypeORM pour une colonne JSON : l'objet entier est chiffré, stocké `{ "enc": "…" }`. */
export const encryptedJson: ValueTransformer = {
  to: (v?: Record<string, unknown> | null) =>
    v === undefined || v === null
      ? v
      : { enc: encryptField(JSON.stringify(v)) },
  from: (v?: Record<string, unknown> | null) =>
    v && typeof v.enc === 'string'
      ? (JSON.parse(decryptField(v.enc)) as Record<string, unknown>)
      : v,
};

const clearOrDecrypted = (v: unknown): string | null =>
  v === null || v === undefined || v === ''
    ? null
    : decryptField(typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Colonnes non textuelles chiffrées (mesures, réponses oui/non, dates) : la colonne est de type
 * texte, la valeur est chiffrée sous sa forme textuelle et rendue dans son type d'origine. Une valeur
 * historique en clair (`'175.00'`, `'1'`, `'2020-01-31 00:00:00'`) est relue de la même façon.
 */
export const encryptedNumber: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === null || v === undefined || v === '' ? v : encryptField(String(v)),
  from: (v?: string | null) => {
    const s = clearOrDecrypted(v);
    return s === null ? null : Number(s);
  },
};

export const encryptedBoolean: ValueTransformer = {
  to: (v?: boolean | null) =>
    v === null || v === undefined ? v : encryptField(v ? '1' : '0'),
  from: (v?: string | null) => {
    const s = clearOrDecrypted(v);
    return s === null ? null : s === '1' || s.toLowerCase() === 'true';
  },
};

export const encryptedDate: ValueTransformer = {
  to: (v?: Date | string | null) =>
    v === null || v === undefined || v === ''
      ? v
      : encryptField(
          v instanceof Date ? v.toISOString() : new Date(v).toISOString(),
        ),
  from: (v?: string | null) => {
    const s = clearOrDecrypted(v);
    if (s === null) return null;
    // Valeur historique MySQL « AAAA-MM-JJ hh:mm:ss » (heure locale du serveur) ou ISO.
    return new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') : s);
  },
};

/** Tous les transformers chiffrants (inventaire des colonnes chiffrées). */
export const ENCRYPTING_TRANSFORMERS: ValueTransformer[] = [
  encrypted,
  encryptedJson,
  encryptedNumber,
  encryptedBoolean,
  encryptedDate,
];
