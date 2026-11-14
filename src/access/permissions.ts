/**
 * Catalogue des permissions de DMGM (même modèle que le socle SIAM : le catalogue est défini en
 * code, une permission n'a de sens que si une route la vérifie ; l'attribution aux rôles est une
 * donnée en base, table `role_permission`, modifiable par l'administration).
 *
 * L'attribution par défaut reproduit exactement les accès de la version précédente (décorateurs
 * @Roles), vérifiés route par route par le banc avant/après. La gestion des comptes reste ouverte
 * au médecin (écran « Administration »), mais une règle anti-escalade s'applique à tous : on ne
 * peut attribuer un rôle, ni gérer un compte, qui donne plus de droits que les siens (un médecin
 * ne peut plus se donner le rôle admin ni modifier un compte administrateur).
 */
export interface PermissionDefinition {
  code: string;
  label: string;
  /** Tracée même en lecture. */
  sensitive?: boolean;
  /** Exige une authentification forte (claim acr/amr) quand MFA_ENFORCED=true. */
  requiresMfa?: boolean;
}

export const PERMISSIONS = {
  // Marins
  MARIN_LIST: { code: 'marin.list', label: 'Lister les marins' },
  MARIN_READ: {
    code: 'marin.read',
    label: "Consulter le dossier d'un marin et le rechercher",
  },
  MARIN_CREATE: { code: 'marin.create', label: 'Enregistrer un marin' },
  MARIN_UPDATE: {
    code: 'marin.update',
    label: "Modifier l'identité d'un marin",
  },
  MARIN_DELETE: {
    code: 'marin.delete',
    label: 'Supprimer un marin',
    sensitive: true,
  },
  // Visites médicales
  VISITE_LIST: { code: 'visite.list', label: 'Lister les visites médicales' },
  VISITE_READ: {
    code: 'visite.read',
    label: 'Consulter une visite médicale',
    sensitive: true,
  },
  VISITE_CREATE: { code: 'visite.create', label: 'Ouvrir une visite médicale' },
  VISITE_UPDATE: {
    code: 'visite.update',
    label:
      'Saisir les constantes, examens, vaccinations, tests et auto-déclaration',
  },
  VISITE_OTHER_EXAM: {
    code: 'visite.other_exam',
    label: 'Saisir les autres examens complémentaires',
  },
  VISITE_CONCLUDE: {
    code: 'visite.conclude',
    label: "Conclure une visite (décision d'aptitude)",
    sensitive: true,
    requiresMfa: true,
  },
  VISITE_DELETE: {
    code: 'visite.delete',
    label: 'Supprimer une visite médicale',
    sensitive: true,
  },
  // Référentiels
  REFERENTIEL_READ: {
    code: 'referentiel.read',
    label: 'Consulter les référentiels',
  },
  REFERENTIEL_EDIT: {
    code: 'referentiel.edit',
    label: 'Créer ou modifier une entrée de référentiel',
  },
  REFERENTIEL_DELETE: {
    code: 'referentiel.delete',
    label: 'Supprimer une entrée de référentiel',
  },
  // Personnel de santé
  INFIRMIER_LIST: { code: 'infirmier.list', label: 'Lister les infirmiers' },
  PERSONNEL_READ: {
    code: 'personnel.read',
    label: 'Consulter les fiches des médecins et infirmiers',
  },
  PERSONNEL_MANAGE: {
    code: 'personnel.manage',
    label: 'Créer ou modifier une fiche de médecin ou d’infirmier',
  },
  PERSONNEL_DELETE: {
    code: 'personnel.delete',
    label: 'Supprimer une fiche de médecin ou d’infirmier',
  },
  // Tableau de bord
  DASHBOARD_READ: {
    code: 'dashboard.read',
    label: 'Consulter le tableau de bord',
  },
  // Administration
  USER_READ: { code: 'user.read', label: 'Consulter les comptes' },
  USER_MANAGE: {
    code: 'user.manage',
    label: 'Créer ou modifier un compte',
    sensitive: true,
  },
  ROLE_ASSIGN: {
    code: 'role.assign',
    label: 'Attribuer des rôles',
    sensitive: true,
    requiresMfa: true,
  },
  USER_DELETE: {
    code: 'user.delete',
    label: 'Supprimer un compte',
    sensitive: true,
  },
  PERMISSION_READ: {
    code: 'permission.read',
    label: 'Consulter la matrice rôles / permissions',
  },
  PERMISSION_MANAGE: {
    code: 'permission.manage',
    label: 'Modifier la matrice rôles / permissions',
    sensitive: true,
    requiresMfa: true,
  },
  AUDIT_READ: { code: 'audit.read', label: "Consulter le journal d'audit" },
  // Protection des données (RGPD)
  PRIVACY_READ: {
    code: 'privacy.read',
    label:
      'Consulter le registre des traitements et les durées de conservation',
  },
  PRIVACY_MANAGE: {
    code: 'privacy.manage',
    label: 'Gérer les durées de conservation et les demandes des personnes',
    sensitive: true,
    requiresMfa: true,
  },
  PRIVACY_EXPORT: {
    code: 'privacy.export',
    label: "Exporter toutes les données d'une personne",
    sensitive: true,
    requiresMfa: true,
  },
} as const satisfies Record<string, PermissionDefinition>;

export type PermissionCode =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['code'];

export const ALL_PERMISSIONS: PermissionDefinition[] =
  Object.values(PERMISSIONS);

const P = PERMISSIONS;
/** Lecture des listes : rôles « ci » et « IT » (consultation seule) compris. */
const LIST_READERS = [P.MARIN_LIST, P.VISITE_LIST, P.DASHBOARD_READ];
const SOIGNANT = [
  ...LIST_READERS,
  P.MARIN_READ,
  P.MARIN_CREATE,
  P.MARIN_UPDATE,
  P.VISITE_READ,
  P.VISITE_CREATE,
  P.VISITE_UPDATE,
  P.REFERENTIEL_READ,
];
const MEDECIN = [
  ...SOIGNANT,
  P.VISITE_OTHER_EXAM,
  P.VISITE_CONCLUDE,
  P.REFERENTIEL_EDIT,
  P.INFIRMIER_LIST,
  P.PERSONNEL_READ,
  P.PERSONNEL_MANAGE,
  // Écran « Administration » des comptes (borné par la règle anti-escalade).
  P.USER_READ,
  P.USER_MANAGE,
  P.ROLE_ASSIGN,
];

/**
 * Attribution par défaut, appliquée une seule fois par rôle (à sa première rencontre) : une
 * modification faite ensuite par l'administration n'est jamais écrasée.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionDefinition[]> =
  {
    admin: [
      ...MEDECIN,
      P.MARIN_DELETE,
      P.VISITE_DELETE,
      P.REFERENTIEL_DELETE,
      P.PERSONNEL_DELETE,
      P.USER_DELETE,
      P.PERMISSION_READ,
      P.PERMISSION_MANAGE,
      P.AUDIT_READ,
      P.PRIVACY_READ,
      P.PRIVACY_MANAGE,
      P.PRIVACY_EXPORT,
    ],
    medecin: MEDECIN,
    infirmier: SOIGNANT,
    ci: [...LIST_READERS, P.INFIRMIER_LIST],
    IT: [...LIST_READERS, P.INFIRMIER_LIST],
    PRIVACY_OFFICER: [
      P.PRIVACY_READ,
      P.PRIVACY_MANAGE,
      P.PRIVACY_EXPORT,
      P.AUDIT_READ,
    ],
  };
