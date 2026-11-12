import { DataSource } from 'typeorm';
import { PrivacyDataset, Processor, SubjectExporter } from './privacy.types';
import { ident, isMysql, run, tablesWithColumn, text } from './sql';

/** Briques communes aux inventaires RGPD des services hors socle (PostgreSQL ou MySQL). */

const norm = (s: unknown) =>
  text(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
const HIDDEN = /(hash|secret|token|password|mot_de_passe|motdepasse)/i;
const strip = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !HIDDEN.test(k)));

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
    if (rows.length) out[t] = rows.map(strip);
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
    const hits = rows.filter((r) =>
      s.columns.some((c) => {
        const v = r[c];
        return norm(
          typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
        ).includes(wanted);
      }),
    );
    if (hits.length) out[s.label ?? s.table] = hits.map(strip);
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
        comptes: rows.map(strip),
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
