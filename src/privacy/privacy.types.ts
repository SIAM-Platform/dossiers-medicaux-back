import { DataSource } from 'typeorm';

/** Catégories de données personnelles (RGPD art. 4 et 9). */
export type PersonalCategory =
  | 'IDENTITE' // nom, prénom, date et lieu de naissance, nationalité
  | 'CONTACT' // e-mail, téléphone, adresse
  | 'PIECE_IDENTITE' // numéro de passeport, de pièce d'identité des gens de mer
  | 'SANTE' // donnée de santé (catégorie particulière, art. 9)
  | 'PROFESSIONNEL' // fonction, grade, organisation
  | 'CONNEXION' // adresse IP, navigateur, horodatage d'action
  | 'PHOTO';

/** Ce que devient une donnée arrivée au terme de sa durée de conservation. */
export type RetentionAction =
  | 'DELETE' // suppression des lignes
  | 'ANONYMIZE' // effacement des seules données personnelles, la ligne reste (statistiques, intégrité)
  | 'KEEP'; // conservation justifiée (acte administratif, preuve, obligation légale) : aucune purge automatique

export interface RetentionRule {
  /** Clé de la règle, modifiable par pays dans `privacy_retention_policies`. */
  key: string;
  /** Durée par défaut en jours ; null = pas de durée (KEEP). */
  defaultDays: number | null;
  action: RetentionAction;
  /** Point de départ et justification, repris tels quels dans le registre des traitements. */
  justification: string;
  /**
   * Requête de purge (code, jamais de saisie utilisateur). `$1` = date limite (traduit en `?` pour
   * MySQL) : les lignes dont la condition est vraie pour cette date sont purgées. `set` : colonnes
   * effacées (ANONYMIZE).
   */
  purge?: Purge;
  /** Plusieurs tables pour un même traitement (ex. dossier médical : constantes, examens…). */
  purges?: Purge[];
}

/** Requête de purge écrite dans le dialecte SQL de la base du service (PostgreSQL ou MySQL). */
export interface Purge {
  table: string;
  condition: string;
  set?: Record<string, string>;
}

/** Un traitement de données personnelles, au sens du registre (RGPD art. 30). */
export interface PrivacyDataset {
  code: string;
  label: string;
  purpose: string;
  legalBasis: string;
  /** Catégories de personnes concernées. */
  subjects: string;
  categories: PersonalCategory[];
  /** Où la donnée est stockée (tables, champs). */
  storage: string;
  /** Champs chiffrés au repos. */
  encrypted?: boolean;
  /** Destinataires internes et externes. */
  recipients: string[];
  retention: RetentionRule;
}

/** Service externe qui reçoit des données personnelles (sous-traitant, RGPD art. 28). */
export interface Processor {
  name: string;
  role: string;
  data: string;
  location: string;
  /** Variable d'environnement qui active ce service ; absent = toujours utilisé. */
  enabledBy?: string;
}

/** Export des données d'une personne (droit d'accès, art. 15 ; portabilité, art. 20). */
export interface SubjectExporter {
  type: string;
  label: string;
  /** Ce qu'il faut saisir pour retrouver la personne. */
  refHint: string;
  find(ds: DataSource, ref: string): Promise<Record<string, unknown>>;
}

export interface PrivacyInventory {
  service: string;
  controller: string;
  datasets: PrivacyDataset[];
  processors: Processor[];
  exporters: SubjectExporter[];
}
