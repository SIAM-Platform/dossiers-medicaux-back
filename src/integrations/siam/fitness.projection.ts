/* eslint-disable prettier/prettier */
/**
 * Statut minimal d'aptitude publie a l'ecosysteme SIAM (Titres & Certifications,
 * Registre des gens de mer). Seuls ces champs sortent de DMGM : aucun diagnostic,
 * antecedent, constante, resultat d'examen, commentaire ni observation.
 */
export type FitnessStatus = 'FIT' | 'UNFIT' | 'PENDING' | 'EXPIRED' | 'NONE';

export interface FitnessStatusDto {
  status: FitnessStatus;
  /** Numero du certificat d'aptitude a aller en mer, s'il a ete enregistre. */
  certificateNumber: string | null;
  /** Reference de la visite qui fonde le statut (VM-<id>), sans contenu medical. */
  visitReference: string | null;
  issuedAt: string | null;
  expiryDate: string | null;
  /** false : DMGM n'a enregistre aucune date de validite pour cette aptitude. */
  expiryRecorded: boolean;
  verifiedAt: string;
}

/** Sous-ensemble strict des donnees lues pour le calcul (jamais renvoye tel quel). */
export interface VisitFacts {
  id: number;
  date_visite: Date | string | null;
  status: string | null;
  date_expiration: Date | string | null;
  decision: string | null;
  date_conclusion: Date | string | null;
  certificats: { type_certificat: string; numero_matricule: string | null; date_emission: Date | string | null; date_expiration: Date | string | null }[];
}

const day = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
};

/**
 * Regles (pures, testees) :
 * - aucune visite : NONE ;
 * - derniere visite conclue « inapte » : UNFIT ;
 * - derniere visite conclue « apte » : FIT, ou EXPIRED si la validite enregistree est depassee ;
 *   une visite de renouvellement en cours ne retire pas une aptitude encore valide ;
 * - aucune visite conclue, ou aptitude expiree avec une visite en cours : PENDING.
 * La validite est celle du certificat « aptitude_aller_en_mer » de la visite, a defaut
 * la date d'expiration de la visite ; sinon elle est signalee comme non enregistree.
 */
export function projectFitness(visits: VisitFacts[], today = new Date().toISOString().slice(0, 10), verifiedAt = new Date().toISOString()): FitnessStatusDto {
  const empty = { certificateNumber: null, visitReference: null, issuedAt: null, expiryDate: null, expiryRecorded: false, verifiedAt };
  if (!visits.length) return { status: 'NONE', ...empty };
  const byDate = [...visits].sort((a, b) => String(day(b.date_visite)).localeCompare(String(day(a.date_visite))) || b.id - a.id);
  const ongoing = byDate.some((v) => v.status === 'en_cours' || v.status === 'attente_examens' || v.decision === 'demande_examens_complementaires');
  const concluded = byDate.find((v) => v.decision === 'apte' || v.decision === 'inapte');
  if (!concluded) return { status: 'PENDING', ...empty };
  const ref = `VM-${concluded.id}`;
  if (concluded.decision === 'inapte') {
    return { ...empty, status: 'UNFIT', visitReference: ref, issuedAt: day(concluded.date_conclusion) };
  }
  const cert = [...concluded.certificats]
    .filter((c) => c.type_certificat === 'aptitude_aller_en_mer')
    .sort((a, b) => String(day(b.date_emission)).localeCompare(String(day(a.date_emission))))[0];
  const expiryDate = day(cert?.date_expiration) ?? day(concluded.date_expiration);
  const expired = !!expiryDate && expiryDate < today;
  return {
    status: expired ? (ongoing ? 'PENDING' : 'EXPIRED') : 'FIT',
    certificateNumber: cert?.numero_matricule ?? null,
    visitReference: ref,
    issuedAt: day(cert?.date_emission) ?? day(concluded.date_conclusion),
    expiryDate,
    expiryRecorded: !!expiryDate,
    verifiedAt,
  };
}
