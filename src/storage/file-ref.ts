/**
 * Référence d'un fichier de la bibliothèque dans une colonne métier : `siam-file:<id>`, ou
 * `siam-file:<id>/<nom affiché>` quand l'interface a besoin du nom (pièces jointes).
 */
export const FILE_REF_PREFIX = 'siam-file:';

export const fileRef = (id: string, name?: string | null): string =>
  `${FILE_REF_PREFIX}${id}${name ? `/${name.replace(/[\\/,]/g, '_')}` : ''}`;

export const fileIdOf = (ref: string | null | undefined): string | null => {
  if (!ref || !ref.startsWith(FILE_REF_PREFIX)) return null;
  const m = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(ref.slice(FILE_REF_PREFIX.length));
  return m ? m[0].toLowerCase() : null;
};

export const fileNameOf = (ref: string | null | undefined): string | null => {
  if (!fileIdOf(ref)) return null;
  const rest = ref!.slice(FILE_REF_PREFIX.length + 36);
  return rest.startsWith('/') ? rest.slice(1) : null;
};
