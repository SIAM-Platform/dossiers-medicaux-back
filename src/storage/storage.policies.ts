const MB = 1024 * 1024;

export interface UploadPolicy {
  /** Types MIME acceptés, déterminés à partir du contenu. */
  mimeTypes: string[];
  /** Types texte sans signature binaire (CSV…), acceptés selon l'extension. */
  textTypes?: Record<string, string>;
  maxBytes: number;
  /** Tout type accepté (reprise de pièces existantes uniquement : preuves, archives). */
  anyType?: boolean;
}

export const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const OFFICE = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/** Extensions admises pour chaque type : un nom dont l'extension contredit le contenu est refusé. */
export const EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic', '.heif'],
  'image/gif': ['.gif'],
  'image/tiff': ['.tif', '.tiff'],
  'audio/mpeg': ['.mp3'],
  'audio/vnd.wave': ['.wav'],
  'audio/x-m4a': ['.m4a'],
  'audio/mp4': ['.m4a', '.mp4'],
  'application/zip': ['.zip'],
  'application/xml': ['.xml'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
};

/** Politiques d'upload par défaut (liste blanche). Le plafond global UPLOAD_MAX_MB s'applique aussi. */
export const UPLOAD_POLICIES = {
  PROFILE_PHOTO: { mimeTypes: IMAGES, maxBytes: 5 * MB },
  EVIDENCE: { mimeTypes: [...IMAGES, ...OFFICE, 'video/mp4', 'video/quicktime'], maxBytes: 100 * MB },
  DOCUMENT: { mimeTypes: [...IMAGES, ...OFFICE], textTypes: { '.csv': 'text/csv', '.txt': 'text/plain' }, maxBytes: 50 * MB },
  SCAN: { mimeTypes: [...IMAGES, 'application/pdf'], maxBytes: 20 * MB },
} satisfies Record<string, UploadPolicy>;
