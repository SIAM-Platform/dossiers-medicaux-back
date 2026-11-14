import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'crypto';

type Env = Record<string, string | undefined>;

/**
 * Trousseau de clés du chiffrement des champs (chiffrement d'enveloppe).
 *
 * - **Clé maître** (KEK) : fournie par l'exploitant (`FIELD_MASTER_KEY`, 32 octets en base64), lue
 *   depuis le coffre, un fichier monté ou l'environnement (voir `secrets.ts`). Elle ne chiffre
 *   jamais de données : elle protège seulement les clés de données. Pour une installation existante,
 *   `FIELD_ENCRYPTION_KEY` sert de clé maître si `FIELD_MASTER_KEY` est absente.
 * - **Clés de données** (DEK) : générées par le service, stockées en base **chiffrées par la clé
 *   maître** (table `crypto_keys`), versionnées. Chaque valeur chiffrée porte l'identifiant de sa
 *   clé (`enc:v2:<id>:…`) : on peut changer de clé active à tout moment, les anciennes restent
 *   lisibles jusqu'au re-chiffrement.
 * - **Clé d'index aveugle** : sert aux empreintes de recherche ; stockée dans `crypto_keys` (ligne
 *   `blind-index`, chiffrée par la clé maître), donc stable quand la clé maître change.
 * - **Clé historique** (`enc:v1:`) : `FIELD_ENCRYPTION_KEY`, pour relire les valeurs chiffrées
 *   avant l'introduction du trousseau.
 *
 * Changer la clé maître = re-chiffrer les seules clés de données (`rewrap`), sans toucher aux
 * données ; changer la clé de données = `rotate` puis `reencrypt` (voir `key-admin.ts`).
 */

const DEV_SEED = 'siam-dev-only-field-key';

function decodeKey(name: string, raw: string): Buffer {
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32)
    throw new Error(`${name} doit contenir 32 octets encodés en base64`);
  return k;
}

const isProduction = (env: Env) => env.NODE_ENV === 'production';

/** Clé de l'ancien format `enc:v1:` (et clé de repli avant installation du trousseau). */
export function legacyKey(env: Env = process.env): Buffer {
  if (env.FIELD_ENCRYPTION_KEY)
    return decodeKey('FIELD_ENCRYPTION_KEY', env.FIELD_ENCRYPTION_KEY);
  if (isProduction(env))
    throw new Error(
      'FIELD_ENCRYPTION_KEY obligatoire en production pour relire les valeurs chiffrées avant le trousseau (enc:v1)',
    );
  return createHash('sha256').update(DEV_SEED).digest();
}

/** Clé maître (KEK). */
export function masterKey(
  env: Env = process.env,
  name = 'FIELD_MASTER_KEY',
): Buffer {
  const raw =
    env[name] ??
    (name === 'FIELD_MASTER_KEY' ? env.FIELD_ENCRYPTION_KEY : undefined);
  if (raw) return decodeKey(name, raw);
  if (isProduction(env)) throw new Error(`${name} obligatoire en production`);
  return createHash('sha256').update(DEV_SEED).digest();
}

/** Empreinte publique d'une clé maître (permet de savoir quelle clé a protégé quoi, sans la révéler). */
export const fingerprint = (key: Buffer): string =>
  createHmac('sha256', key)
    .update('siam-key-fingerprint')
    .digest('hex')
    .slice(0, 16);

const hkdf = (key: Buffer, info: string): Buffer =>
  Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), info, 32));

/** Chiffre une clé de données par la clé maître (AES-256-GCM, lié à l'identifiant de la clé). */
export function wrapKey(kek: Buffer, id: string, dek: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', kek, iv);
  c.setAAD(Buffer.from(`siam-dek:${id}`));
  const data = Buffer.concat([c.update(dek), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function unwrapKey(kek: Buffer, id: string, wrapped: string): Buffer {
  const buf = Buffer.from(wrapped, 'base64');
  const d = createDecipheriv('aes-256-gcm', kek, buf.subarray(0, 12));
  d.setAAD(Buffer.from(`siam-dek:${id}`));
  d.setAuthTag(buf.subarray(12, 28));
  try {
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
  } catch {
    throw new Error(
      `Clé de données ${id} illisible : la clé maître fournie n'est pas celle qui l'a protégée`,
    );
  }
}

export const newDataKey = (): { id: string; key: Buffer } => ({
  id: `k${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${randomBytes(3).toString('hex')}`,
  key: randomBytes(32),
});

interface State {
  keys: Map<string, Buffer>;
  active: string;
  blind: Buffer;
  masterFingerprint: string;
}

let state: State | null = null;

/** Installe les clés en mémoire (au démarrage, après lecture de `crypto_keys`). */
export function installKeyring(
  keys: Map<string, Buffer>,
  active: string,
  master: Buffer,
  blind?: Buffer,
): void {
  if (!keys.has(active))
    throw new Error(`Clé de données active ${active} absente du trousseau`);
  state = {
    keys,
    active,
    blind: blind ?? initialBlindKey(master),
    masterFingerprint: fingerprint(master),
  };
}

/**
 * Valeur initiale de la clé d'index aveugle, dérivée de la clé maître à la création du trousseau,
 * puis **stockée** (chiffrée) dans `crypto_keys` : un changement de clé maître ne la modifie pas,
 * les empreintes de recherche restent valables.
 */
export const initialBlindKey = (master: Buffer): Buffer =>
  hkdf(master, 'siam-blind-index-v1');

export const keyringInstalled = (): boolean => state !== null;

/** Pour les tests : retour à l'état « trousseau non chargé ». */
export function resetKeyring(): void {
  state = null;
}

export function activeDataKey(): { id: string; key: Buffer } | null {
  return state
    ? { id: state.active, key: state.keys.get(state.active)! }
    : null;
}

export function dataKey(id: string): Buffer {
  const k = state?.keys.get(id);
  if (!k)
    throw new Error(
      `Clé de données ${id} inconnue (trousseau non chargé ou clé détruite)`,
    );
  return k;
}

/**
 * Clé des index aveugles. Avant installation du trousseau (tests unitaires), valeur initiale dérivée
 * de la clé maître, identique à celle que le trousseau crée au premier démarrage. En production, le
 * trousseau doit être chargé : une empreinte calculée avec une autre clé ne retrouverait rien.
 */
export function blindKey(env: Env = process.env): Buffer {
  if (state) return state.blind;
  if (isProduction(env))
    throw new Error('Trousseau non chargé : index aveugle impossible');
  return initialBlindKey(masterKey(env));
}

export function keyringStatus(): {
  installed: boolean;
  active: string | null;
  keys: string[];
  masterFingerprint: string | null;
} {
  return {
    installed: !!state,
    active: state?.active ?? null,
    keys: state ? [...state.keys.keys()] : [],
    masterFingerprint: state?.masterFingerprint ?? null,
  };
}
