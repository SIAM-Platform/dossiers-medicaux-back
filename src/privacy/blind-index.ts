import { createHmac } from 'crypto';
import { blindKey } from './keyring';

/**
 * Index aveugles : rechercher une donnée chiffrée **sans la déchiffrer**.
 *
 * - `blindIndex` : empreinte HMAC-SHA256 (clé secrète, distincte par usage) d'une valeur normalisée.
 *   Permet la recherche **exacte** (numéro de passeport, téléphone, date de naissance…) et l'unicité,
 *   par simple égalité SQL sur une colonne indexée. Sans la clé, l'empreinte ne permet ni de retrouver
 *   la valeur ni de tester une valeur supposée.
 * - `trigramIndex` : empreintes des trigrammes d'un nom normalisé (même découpage que pg_trgm). La
 *   ressemblance entre deux noms se mesure par le recouvrement des deux ensembles (indice de Jaccard,
 *   la formule de `similarity()` de pg_trgm) : recherche approchée et **détection des doublons** sans
 *   nom en clair dans la base. Empreintes courtes (48 bits) : de rares collisions ne font qu'ajouter
 *   un candidat, le score final est calculé sur les valeurs déchiffrées.
 *
 * Limite connue (documentée) : des valeurs égales ont la même empreinte. C'est le prix de la recherche
 * exacte ; la clé d'index est séparée de celle des données et dérivée par usage (`domain`).
 */

const b64url = (b: Buffer) =>
  b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Empreinte de recherche exacte (22 caractères, 128 bits). `domain` sépare les usages (ex. `passport`). */
export function blindIndex(
  value: string | null | undefined,
  domain: string,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  return b64url(
    createHmac('sha256', blindKey()).update(`${domain}\u0000${value}`).digest(),
  ).slice(0, 22);
}

/**
 * Trigrammes d'un texte normalisé, comme pg_trgm : chaque mot est entouré de deux espaces devant, un
 * derrière. `prefix` : le dernier mot peut être un début de mot (saisie en cours) ; ses trigrammes de
 * fin de mot sont alors omis, pour que « dio » retrouve « Diop ».
 */
export function trigrams(
  normalized: string,
  opts: { prefix?: boolean } = {},
): string[] {
  const out = new Set<string>();
  const words = normalized
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  words.forEach((word, n) => {
    const w = `  ${word} `;
    for (let i = 0; i + 3 <= w.length; i++) {
      const t = w.slice(i, i + 3);
      if (opts.prefix && n === words.length - 1 && t.endsWith(' ')) continue;
      out.add(t);
    }
  });
  return [...out];
}

/** Empreintes des trigrammes (12 caractères chacune, 72 bits). */
export function trigramIndex(
  normalized: string | null | undefined,
  domain: string,
  opts: { prefix?: boolean } = {},
): string[] {
  if (!normalized) return [];
  const key = blindKey();
  return trigrams(normalized, opts)
    .map((t) =>
      b64url(
        createHmac('sha256', key).update(`${domain}\u0001${t}`).digest(),
      ).slice(0, 12),
    )
    .sort();
}

/** Ressemblance de deux ensembles d'empreintes (indice de Jaccard, 0 à 1). */
export function trigramSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  return inter / (sa.size + new Set(b).size - inter);
}
