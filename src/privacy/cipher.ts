import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Chiffrement AES-256-GCM des champs du module RGPD (identité des demandeurs). Même format que le
 * socle SIAM (`enc:v1:`). Clé : FIELD_ENCRYPTION_KEY (32 octets en base64), obligatoire en
 * production ; en développement, clé dérivée fixe (jamais pour des données réelles).
 */
function key(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32)
      throw new Error(
        'FIELD_ENCRYPTION_KEY doit contenir 32 octets encodés en base64',
      );
    return k;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('FIELD_ENCRYPTION_KEY obligatoire en production');
  return createHash('sha256').update('siam-dev-only-field-key').digest();
}

const PREFIX = 'enc:v1:';

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return (
    PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
  );
}

export function decryptField(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}
