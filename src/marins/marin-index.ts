import { blindIndex, trigramIndex } from '../privacy/blind-index';

/** Normalisation d'un identifiant (NIM, CNI) : majuscules, sans espace ni ponctuation. */
const normId = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const normName = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/**
 * Index aveugles du marin (voir `src/privacy/blind-index.ts`) : on cherche un marin par son NIM, sa
 * CNI ou son nom sans que ces données soient lisibles dans la base.
 */
export const marinIndex = {
  nim: (v: string | null | undefined): string | null =>
    v ? blindIndex(normId(v), 'marin-nim') : null,
  cni: (v: string | null | undefined): string | null =>
    v ? blindIndex(normId(v), 'marin-cni') : null,
  /** Empreintes des trigrammes du nom complet, séparées par des espaces. */
  name: (
    nom: string | null | undefined,
    prenom: string | null | undefined,
  ): string | null => {
    const t = trigramIndex(
      normName(`${nom ?? ''} ${prenom ?? ''}`),
      'marin-name',
    );
    return t.length ? t.join(' ') : null;
  },
  /** Empreintes des trigrammes d'un terme de recherche. */
  term: (q: string): string[] =>
    trigramIndex(normName(q), 'marin-name', { prefix: true }),
};
