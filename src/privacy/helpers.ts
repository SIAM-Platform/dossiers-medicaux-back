import { DataSource } from 'typeorm';
import { PrivacyDataset, Processor, SubjectExporter } from './privacy.types';
import { ident, isMysql, run, tablesWithColumn, text } from './sql';
import { decryptField, isEncrypted } from './field-cipher';

/** Briques communes aux inventaires RGPD des services hors socle (PostgreSQL ou MySQL). */

const norm = (s: unknown) =>
  text(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
const HIDDEN = /(hash|secret|token|password|mot_de_passe|motdepasse)/i;
/** Ligne exportable : secrets retirés, champs chiffrés déchiffrés (export au titre du droit d'accès). */
export const exportRow = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => !HIDDEN.test(k) && !/_index$/.test(k))
      .map(([k, v]) => [k, isEncrypted(v) ? safeDecrypt(v as string) : v]),
  );
const safeDecrypt = (v: string): string => {
  try {
    return decryptField(v);
  } catch {
    return '[illisible : clé de chiffrement différente]';
  }
};

/** Toutes les lignes des tables qui portent `column = value` (sauf `exclude`). */
export async function rowsByColumn(
  ds: DataSource,
  column: string,
  value: string,
  exclude: string[] = [],
): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of await tablesWithColumn(ds, column)) {
    if (exclude.includes(t)) continue;
    const cast = isMysql(ds) ? ident(ds, column) : `${ident(ds, column)}::text`;
    const rows = await run(
      ds,
      ds,
      `SELECT * FROM ${ident(ds, t)} WHERE ${cast} = $1 LIMIT 1000`,
      [value],
    );
    if (rows.length) out[t] = rows.map(exportRow);
  }
  return out;
}

/** Recherche d'une personne citée dans des colonnes (nom, contact…), comparaison sans accents ni casse. */
export async function searchColumns(
  ds: DataSource,
  specs: { table: string; columns: string[]; label?: string }[],
  ref: string,
): Promise<Record<string, unknown[]>> {
  const wanted = norm(ref);
  const out: Record<string, unknown[]> = {};
  for (const s of specs) {
    const rows = await run<Record<string, unknown>>(
      ds,
      ds,
      `SELECT * FROM ${ident(ds, s.table)} LIMIT 20000`,
    );
    const hits = rows.map(exportRow).filter((r) =>
      s.columns.some((c) => {
        const v = r[c];
        return norm(
          typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
        ).includes(wanted);
      }),
    );
    if (hits.length) out[s.label ?? s.table] = hits;
  }
  return out;
}

/** Exporteur « agent » pour la table des comptes du service. */
export function agentExporter(opts: {
  table: string;
  emailColumn: string;
  idColumns: string[];
}): SubjectExporter {
  return {
    type: 'agent',
    label: 'Agent (compte utilisateur)',
    refHint: "Adresse e-mail ou identifiant de l'agent",
    async find(ds: DataSource, ref: string) {
      const t = ident(ds, opts.table);
      const conds = [
        `lower(${ident(ds, opts.emailColumn)}) = lower($1)`,
        ...opts.idColumns.map((c) =>
          isMysql(ds) ? `${ident(ds, c)} = $1` : `${ident(ds, c)}::text = $1`,
        ),
      ];
      const rows = await run(
        ds,
        ds,
        `SELECT * FROM ${t} WHERE ${conds.join(' OR ')} LIMIT 5`,
        [ref],
      );
      const actions = await run(
        ds,
        ds,
        `SELECT occurred_at, action, entity_type, summary FROM privacy_audit_events WHERE actor_id = $1 ORDER BY occurred_at DESC LIMIT 500`,
        [text((rows[0] as Record<string, unknown> | undefined)?.id ?? ref)],
      );
      return {
        found: rows.length > 0,
        comptes: rows.map(exportRow),
        actionsRgpd: actions,
      };
    },
  };
}

/** Sous-traitants communs (activés selon la configuration de l'instance). */
export const COMMON_PROCESSORS: Processor[] = [
  {
    name: 'Keycloak (SIAM)',
    role: "Fournisseur d'identité : authentification unique",
    data: 'Identifiant, nom, e-mail, facteurs d’authentification',
    location: "Infrastructure de l'exploitant",
  },
  {
    name: 'Serveur de messagerie (SMTP)',
    role: 'Envoi des e-mails',
    data: 'E-mail et nom du destinataire, contenu du message',
    location: "Choisi par l'exploitant",
    enabledBy: 'SMTP_HOST',
  },
];

export const CONTROLLER =
  "Administration du pays de déploiement (responsable de traitement) ; l'éditeur SIAM n'accède pas aux données de production";

/** Demandes d'exercice des droits tenues par le module RGPD (présent dans chaque service). */
export const requestsDataset: PrivacyDataset = {
  code: 'DEMANDES_PERSONNES',
  label: 'Demandes d’exercice des droits',
  purpose:
    'Traiter et prouver le traitement des demandes (accès, rectification, effacement, opposition)',
  legalBasis: 'Obligation légale (art. 6.1.c) : RGPD art. 12 à 21',
  subjects: 'Personnes ayant exercé un droit, demandeurs',
  categories: ['IDENTITE', 'CONTACT'],
  storage:
    'privacy_requests (identité chiffrée), privacy_audit_events (ajout seul)',
  encrypted: true,
  recipients: ['Délégué à la protection des données'],
  retention: {
    key: 'demandes-personnes',
    defaultDays: 1825,
    action: 'DELETE',
    justification: '5 ans après la clôture (preuve de la réponse)',
    purge: {
      table: 'privacy_requests',
      condition: 'closed_at IS NOT NULL AND closed_at < $1',
    },
  },
};

/**
 * Comptes des agents : identité effacée 3 ans après la désactivation (le nom reste dans les actes
 * et journaux produits, à titre de preuve). `set` : colonnes → expression SQL (déjà protégées).
 */
export function accountsDataset(opts: {
  service: string;
  table: string;
  storage: string;
  condition: string;
  set: Record<string, string>;
}): PrivacyDataset {
  return {
    code: 'COMPTES_AGENTS',
    label: 'Comptes des agents',
    purpose: `Gestion des accès à ${opts.service} et traçabilité des actions des agents`,
    legalBasis:
      "Mission d'intérêt public (art. 6.1.e) ; sécurité du système d'information",
    subjects: "Agents de l'administration et des organismes habilités",
    categories: ['IDENTITE', 'CONTACT', 'PROFESSIONNEL'],
    storage: opts.storage,
    recipients: [
      "Administrateurs de l'application",
      'Keycloak (authentification)',
    ],
    retention: {
      key: 'comptes-agents-desactives',
      defaultDays: 1095,
      action: 'ANONYMIZE',
      justification:
        "3 ans après la désactivation du compte : identité effacée ; le nom de l'agent reste dans les actes et journaux qu'il a produits (preuve)",
      purge: { table: opts.table, condition: opts.condition, set: opts.set },
    },
  };
}
