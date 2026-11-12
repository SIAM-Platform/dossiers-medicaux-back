import { DataSource } from 'typeorm';
import {
  agentExporter,
  COMMON_PROCESSORS,
  CONTROLLER,
  requestsDataset,
} from './helpers';
import { PrivacyInventory } from './privacy.types';
import { run } from './sql';

/**
 * Registre des traitements du service Dossiers médicaux des gens de mer (DMGM).
 * Données de santé : catégorie particulière (RGPD art. 9). Les durées par défaut sont des
 * propositions de l'éditeur, « à valider par l'autorité sanitaire » du pays, qui les fixe
 * ensuite dans l'écran RGPD (chaque changement est tracé).
 */
const MEDICAL_DETAIL_TABLES = [
  'constante',
  'examenclinique',
  'examcomplementaire',
  'test_drogue',
  'vaccination',
  'reponseautodeclaration',
  'commentairecategorie',
];
const OLD_VISITS = `visite_id IN (SELECT id FROM visitemedicale WHERE date_visite < $1)`;

export const PRIVACY_INVENTORY_DATA: PrivacyInventory = {
  service: 'SIAM Dossiers médicaux des gens de mer',
  controller: CONTROLLER,
  datasets: [
    {
      code: 'MARINS',
      label: 'Identité des gens de mer suivis',
      purpose:
        "Identifier le marin examiné et rattacher ses visites d'aptitude",
      legalBasis:
        'Obligation légale (art. 6.1.c) : aptitude médicale des gens de mer (MLC 2006, règle 1.2 ; STCW, règle I/9)',
      subjects: 'Gens de mer',
      categories: ['IDENTITE', 'CONTACT', 'PIECE_IDENTITE'],
      storage:
        'marin (nom, prénom, naissance, CNI, inscription maritime, adresse, téléphone, e-mail)',
      recipients: [
        'Médecins et infirmiers habilités',
        'Registre des gens de mer (statut d’aptitude seulement)',
      ],
      retention: {
        key: 'marins-identite',
        defaultDays: null,
        action: 'KEEP',
        justification:
          "Conservée tant que des visites ou certificats du marin sont conservés (preuve de l'aptitude) ; rectification sur demande",
      },
    },
    {
      code: 'DOSSIER_MEDICAL',
      label: "Mesures, examens, tests et réponses d'auto-déclaration",
      purpose: "Établir l'aptitude médicale du marin à la navigation",
      legalBasis:
        'Obligation légale (art. 6.1.c) et médecine du travail (art. 9.2.h) ; secret médical',
      subjects: 'Gens de mer',
      categories: ['SANTE'],
      storage: MEDICAL_DETAIL_TABLES.join(', '),
      recipients: [
        'Médecins et infirmiers habilités du centre (jamais transmis aux autres applications)',
      ],
      retention: {
        key: 'dossier-medical-detail',
        defaultDays: 7300,
        action: 'DELETE',
        justification:
          "20 ans après la visite (proposition, à valider par l'autorité sanitaire) ; la conclusion et le certificat restent",
        purges: MEDICAL_DETAIL_TABLES.map((table) => ({
          table,
          condition: OLD_VISITS,
        })),
      },
    },
    {
      code: 'APTITUDE',
      label: "Visites, conclusions d'aptitude et certificats médicaux",
      purpose:
        "Prouver l'aptitude délivrée et permettre la vérification d'un certificat",
      legalBasis:
        "Obligation légale (art. 6.1.c) ; exception au droit à l'effacement (art. 17.3.b)",
      subjects: 'Gens de mer ; médecins signataires',
      categories: ['IDENTITE', 'SANTE', 'PROFESSIONNEL'],
      storage: 'visitemedicale, conclusion, certificat',
      recipients: [
        'Médecins habilités',
        'Vérification publique du certificat (validité seulement, aucune donnée médicale)',
      ],
      retention: {
        key: 'aptitude-et-certificats',
        defaultDays: null,
        action: 'KEEP',
        justification:
          "Acte médico-administratif : durée fixée par l'autorité sanitaire (à valider) ; pas de purge automatique",
      },
    },
    {
      code: 'PERSONNEL_MEDICAL',
      label: 'Comptes des médecins, infirmiers et agents',
      purpose:
        'Gestion des accès et traçabilité des actes (qui a examiné, qui a conclu)',
      legalBasis: "Mission d'intérêt public (art. 6.1.e)",
      subjects: 'Personnel du centre médical',
      categories: ['IDENTITE', 'CONTACT', 'PROFESSIONNEL'],
      storage: 'user, medecin, infirmier, user_roles_role',
      recipients: [
        "Administrateurs de l'application",
        'Keycloak (authentification)',
      ],
      retention: {
        key: 'personnel-medical',
        defaultDays: null,
        action: 'KEEP',
        justification:
          "Le nom du professionnel reste attaché aux actes qu'il a signés ; désactivation par l'administrateur",
      },
    },
    {
      code: 'JOURNAL_AUDIT',
      label:
        "Journal d'audit des consultations et modifications du dossier médical",
      purpose:
        'Savoir qui a consulté ou modifié le dossier d’un marin, et quand (secret médical, sécurité)',
      legalBasis:
        'Sécurité du traitement (art. 32) et obligation de traçabilité des accès aux données de santé',
      subjects:
        'Personnel du centre médical ; marins (par leur identifiant technique)',
      categories: ['IDENTITE', 'CONNEXION'],
      storage:
        'audit_events (ajout seul, chaîne SHA-256 ; noms des champs, jamais les valeurs ; CNI, e-mail et adresse IP pseudonymisés)',
      recipients: ['Administrateurs', 'Délégué à la protection des données'],
      retention: {
        key: 'journal-audit',
        defaultDays: null,
        action: 'KEEP',
        justification:
          'Preuve des accès au dossier médical ; aucune donnée médicale ni identité de marin en clair',
      },
    },
    requestsDataset,
  ],
  processors: COMMON_PROCESSORS,
  exporters: [
    agentExporter({
      table: 'user',
      emailColumn: 'email',
      idColumns: ['id', 'keycloakId', 'username'],
    }),
    {
      type: 'marin',
      label: 'Marin (dossier médical complet)',
      refHint: "Numéro d'inscription maritime ou numéro de CNI du marin",
      async find(ds: DataSource, ref: string) {
        const [marin] = await run<Record<string, unknown>>(
          ds,
          ds,
          `SELECT * FROM marin WHERE numero_ins_mar = $1 OR numero_cni = $1 LIMIT 1`,
          [ref],
        );
        if (!marin) return { found: false };
        const visites = await run<Record<string, unknown>>(
          ds,
          ds,
          `SELECT * FROM visitemedicale WHERE marin_id = $1 ORDER BY date_visite`,
          [marin.id],
        );
        const ids = visites.map((v) => v.id);
        const detail: Record<string, unknown[]> = {};
        if (ids.length) {
          const marks = ids.map((_, i) => `$${i + 1}`).join(', ');
          for (const t of [
            ...MEDICAL_DETAIL_TABLES,
            'conclusion',
            'certificat',
          ]) {
            const rows = await run(
              ds,
              ds,
              `SELECT * FROM ${t} WHERE visite_id IN (${marks})`,
              ids,
            );
            if (rows.length) detail[t] = rows;
          }
        }
        return { found: true, marin, visites, ...detail };
      },
    },
  ],
};
