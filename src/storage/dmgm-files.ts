import { IMAGES, UploadPolicy } from './storage.policies';

export { FILE_REF_PREFIX, fileIdOf } from './file-ref';

/** Scans d'examens complémentaires : images, PDF, Word (.docx). */
export const DMGM_SCAN_POLICY: UploadPolicy = {
  mimeTypes: [...IMAGES, 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxBytes: 20 * 1024 * 1024,
};
