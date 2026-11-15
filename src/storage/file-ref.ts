/** Référence d'un fichier de la bibliothèque dans une colonne métier : `siam-file:<id>`. */
export const FILE_REF_PREFIX = 'siam-file:';

export const fileRef = (id: string): string => `${FILE_REF_PREFIX}${id}`;

export const fileIdOf = (ref: string | null | undefined): string | null =>
  ref && ref.startsWith(FILE_REF_PREFIX) ? ref.slice(FILE_REF_PREFIX.length) : null;
