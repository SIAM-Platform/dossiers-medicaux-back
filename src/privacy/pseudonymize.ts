import { createHash, createHmac } from 'crypto';

/**
 * Clé de pseudonymisation : PRIVACY_PSEUDONYM_KEY (base64) si fournie, sinon dérivée de la clé de
 * chiffrement des champs. Distincte de la clé de chiffrement : un pseudonyme ne permet pas de
 * retrouver la valeur, mais deux valeurs identiques donnent le même pseudonyme (traçabilité).
 */
function key(): Buffer {
  const raw = process.env.PRIVACY_PSEUDONYM_KEY;
  if (raw) return Buffer.from(raw, 'base64');
  const base = process.env.FIELD_ENCRYPTION_KEY ?? 'siam-dev-only-field-key';
  return createHash('sha256').update(`siam-pseudonym:${base}`).digest();
}

/** Pseudonyme stable et non réversible d'une valeur (`psd:` + 16 caractères hexadécimaux). */
export function pseudonym(value: unknown): string {
  return `psd:${createHmac('sha256', key()).update(String(value).trim().toLowerCase()).digest('hex').slice(0, 16)}`;
}

/** Clés dont la valeur est une donnée personnelle, quel que soit l'objet (insensible à la casse). */
export const PERSONAL_KEYS = new Set(
  [
    'email',
    'courriel',
    'telephone',
    'phone',
    'mobile',
    'adresse',
    'address',
    'nom',
    'prenom',
    'prenoms',
    'firstName',
    'lastName',
    'familyName',
    'givenName',
    'givenNames',
    'fullName',
    'nomComplet',
    'dateNaissance',
    'birthDate',
    'dateOfBirth',
    'lieuNaissance',
    'placeOfBirth',
    'nationalite',
    'nationality',
    'documentNumber',
    'numeroPiece',
    'passportNumber',
    'idNumber',
    'identityNumber',
    'requesterName',
    'requesterContact',
    'subjectRef',
    'recipient',
    'recipientName',
    // Elements de donnees FAL (listes d'equipage et de passagers) : CREW.FAMILY_NAME, PAX.ID_DOC_NUMBER...
    'FAMILY_NAME',
    'GIVEN_NAMES',
    'BIRTH_DATE',
    'BIRTH_PLACE',
    'ID_DOC_NUMBER',
    'MASTER_NAME',
  ].map((k) => normalizeKey(k)),
);

/** `CREW.FAMILY_NAME`, `familyName` et `family-name` désignent le même champ. */
function normalizeKey(k: string): string {
  return (k.split('.').pop() ?? k).replace(/[_-]/g, '').toLowerCase();
}

export const isPersonalKey = (k: string): boolean =>
  PERSONAL_KEYS.has(normalizeKey(k));

/**
 * Copie d'un objet où chaque donnée personnelle est remplacée par son pseudonyme (journal d'audit).
 * Les autres valeurs sont conservées telles quelles.
 */
export function maskPersonal<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 8) return value;
  if (Array.isArray(value))
    return (value as unknown[]).map((v) => maskPersonal(v, depth + 1)) as T;
  if (typeof value !== 'object' || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      isPersonalKey(k) &&
      v !== null &&
      v !== undefined &&
      v !== '' &&
      typeof v !== 'object'
    )
      out[k] = pseudonym(v);
    else out[k] = maskPersonal(v, depth + 1);
  }
  return out as T;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Numéros au format international uniquement (+221 77 …) : les références métier (2026-00284) ne sont jamais touchées. */
const PHONE = /\+\d{1,3}(?:[\s.-]?\d){7,12}/g;

/** Retire e-mails et numéros de téléphone d'un texte libre (journaux techniques). */
export function redactText(text: string): string {
  return text
    .replace(EMAIL, (m) => pseudonym(m))
    .replace(PHONE, '[téléphone masqué]');
}
