import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Chiffrement des fichiers : AES-256-GCM, une clé aléatoire par fichier. Cette clé est conservée en
 * base dans une colonne elle-même chiffrée par la clé de données du service (chiffrement
 * d'enveloppe) : la rotation des clés ne re-chiffre que la petite clé du fichier, jamais le fichier.
 *
 * Format stocké : `SIAMF1` | iv (12 octets) | tag (16 octets) | contenu chiffré.
 */
const MAGIC = Buffer.from('SIAMF1', 'ascii');

export function sealFile(plain: Buffer): { blob: Buffer; fileKey: string } {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { blob: Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data]), fileKey: key.toString('base64') };
}

export function openFile(blob: Buffer, fileKey: string): Buffer {
  if (blob.length < MAGIC.length + 28 || !blob.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error('Fichier chiffré illisible (en-tête absent)');
  const key = Buffer.from(fileKey, 'base64');
  const iv = blob.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = blob.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(MAGIC.length + 28)), decipher.final()]);
}

export const isSealed = (blob: Buffer): boolean => blob.subarray(0, MAGIC.length).equals(MAGIC);
