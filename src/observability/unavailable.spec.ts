import { isUnavailable } from './unavailable';

describe('Panne d’une dépendance reconnue (503)', () => {
  it('connexion refusée, coupée ou base en arrêt', () => {
    expect(isUnavailable(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isUnavailable(new Error('Connection terminated unexpectedly'))).toBe(true);
    expect(isUnavailable({ driverError: { code: '57P01', message: 'terminating connection due to administrator command' } })).toBe(true);
    expect(isUnavailable({ errors: [{ code: 'ECONNREFUSED' }] })).toBe(true);
  });
  it('erreur métier ou SQL ordinaire : pas une panne', () => {
    expect(isUnavailable({ driverError: { code: '23505' } })).toBe(false);
    expect(isUnavailable(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isUnavailable(null)).toBe(false);
  });
});
