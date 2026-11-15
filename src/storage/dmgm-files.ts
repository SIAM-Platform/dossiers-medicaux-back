import { IMAGES, UploadPolicy } from './storage.policies';

/** Référence d'un fichier de la bibliothèque dans une colonne métier. */
export const FILE_REF_PREFIX = 'siam-file:';

export const fileIdOf = (ref: string | null | undefined): string | null =>
  ref && ref.startsWith(FILE_REF_PREFIX) ? ref.slice(FILE_REF_PREFIX.length) : null;

/** Scans d'examens complémentaires : images, PDF, Word (.docx). */
export const DMGM_SCAN_POLICY: UploadPolicy = {
  mimeTypes: [...IMAGES, 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxBytes: 20 * 1024 * 1024,
};
