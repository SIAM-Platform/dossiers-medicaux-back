/* eslint-disable prettier/prettier */
import { projectFitness, VisitFacts } from './fitness.projection';

const TODAY = '2026-09-25';
const AT = '2026-09-25T10:00:00.000Z';
const visit = (id: number, over: Partial<VisitFacts> = {}): VisitFacts => ({
  id,
  date_visite: '2026-01-10',
  status: 'terminé',
  date_expiration: null,
  decision: 'apte',
  date_conclusion: '2026-01-10',
  certificats: [],
  ...over,
});
const cert = (date_emission: string, date_expiration: string, numero = 'APT-001') => ({ type_certificat: 'aptitude_aller_en_mer', numero_matricule: numero, date_emission, date_expiration });
const run = (v: VisitFacts[]) => projectFitness(v, TODAY, AT);

describe('projectFitness (statut minimal publié à SIAM)', () => {
  it('aucune visite : NONE', () => {
    expect(run([])).toEqual({ status: 'NONE', certificateNumber: null, visitReference: null, issuedAt: null, expiryDate: null, expiryRecorded: false, verifiedAt: AT });
  });

  it('apte avec certificat valide : FIT, numéro et dates du certificat', () => {
    expect(run([visit(7, { certificats: [cert('2026-01-12', '2028-01-11')] })])).toMatchObject({ status: 'FIT', certificateNumber: 'APT-001', visitReference: 'VM-7', issuedAt: '2026-01-12', expiryDate: '2028-01-11', expiryRecorded: true });
  });

  it('apte, validité portée par la visite à défaut de certificat', () => {
    expect(run([visit(3, { date_expiration: '2027-01-09' })])).toMatchObject({ status: 'FIT', certificateNumber: null, expiryDate: '2027-01-09', issuedAt: '2026-01-10', expiryRecorded: true });
  });

  it('apte sans validité enregistrée : FIT signalé expiryRecorded=false', () => {
    expect(run([visit(3)])).toMatchObject({ status: 'FIT', expiryDate: null, expiryRecorded: false });
  });

  it('aptitude dépassée : EXPIRED', () => {
    expect(run([visit(4, { certificats: [cert('2024-01-01', '2025-12-31')] })])).toMatchObject({ status: 'EXPIRED', expiryDate: '2025-12-31' });
  });

  it('dernière conclusion inapte : UNFIT, sans date de validité', () => {
    const r = run([visit(1, { date_visite: '2025-01-01', certificats: [cert('2025-01-02', '2027-01-01')] }), visit(2, { date_visite: '2026-05-01', decision: 'inapte', date_conclusion: '2026-05-02' })]);
    expect(r).toMatchObject({ status: 'UNFIT', visitReference: 'VM-2', issuedAt: '2026-05-02', expiryDate: null });
  });

  it('visite de renouvellement en cours : une aptitude encore valide est conservée', () => {
    const r = run([visit(1, { certificats: [cert('2026-01-12', '2026-12-31')] }), visit(2, { date_visite: '2026-09-20', status: 'en_cours', decision: null, date_conclusion: null })]);
    expect(r).toMatchObject({ status: 'FIT', visitReference: 'VM-1' });
  });

  it('aptitude expirée et visite en cours : PENDING', () => {
    const r = run([visit(1, { certificats: [cert('2024-01-01', '2025-01-01')] }), visit(2, { date_visite: '2026-09-20', status: 'attente_examens', decision: 'demande_examens_complementaires' })]);
    expect(r.status).toBe('PENDING');
  });

  it('première visite non conclue : PENDING', () => {
    expect(run([visit(1, { status: 'en_cours', decision: null, date_conclusion: null })]).status).toBe('PENDING');
  });

  it("seuls les champs du contrat minimal sortent (aucun champ médical)", () => {
    const r = run([visit(1, { certificats: [cert('2026-01-12', '2028-01-11')] })]);
    expect(Object.keys(r).sort()).toEqual(['certificateNumber', 'expiryDate', 'expiryRecorded', 'issuedAt', 'status', 'verifiedAt', 'visitReference']);
  });
});
