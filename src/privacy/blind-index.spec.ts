import { randomBytes } from 'crypto';
import {
  blindIndex,
  trigramIndex,
  trigramSimilarity,
  trigrams,
} from './blind-index';
import { installKeyring, masterKey, resetKeyring } from './keyring';

describe('Index aveugles', () => {
  afterEach(() => resetKeyring());

  it('empreinte deterministe, distincte par usage, sans la valeur', () => {
    const a = blindIndex('A1234567', 'passport');
    expect(a).toBe(blindIndex('A1234567', 'passport'));
    expect(a).not.toBe(blindIndex('A1234567', 'phone'));
    expect(a).not.toContain('1234567');
    expect(a).toHaveLength(22);
    expect(blindIndex('', 'passport')).toBeNull();
  });

  it('meme empreinte avant et apres chargement du trousseau (cle derivee de la cle maitre)', () => {
    const before = blindIndex('221770000000', 'phone');
    installKeyring(new Map([['k1', randomBytes(32)]]), 'k1', masterKey());
    expect(blindIndex('221770000000', 'phone')).toBe(before);
  });

  it('change avec la cle maitre (sans la cle, aucune empreinte ne peut etre recalculee)', () => {
    const before = blindIndex('A1234567', 'passport');
    installKeyring(new Map([['k1', randomBytes(32)]]), 'k1', randomBytes(32));
    expect(blindIndex('A1234567', 'passport')).not.toBe(before);
  });

  it('recherche par debut de mot : les trigrammes du nom contiennent ceux du debut saisi', () => {
    const name = new Set(trigramIndex('DIOP MAMADOU', 'name'));
    expect(
      trigramIndex('dio', 'name', { prefix: true }).every((t) => name.has(t)),
    ).toBe(true);
    expect(trigramIndex('dio', 'name').every((t) => name.has(t))).toBe(false);
  });

  it('trigrammes identiques a pg_trgm', () => {
    expect(trigrams('cat').sort()).toEqual(['  c', ' ca', 'at ', 'cat'].sort());
  });

  it('ressemblance des noms mesuree sur les empreintes (doublons sans nom en clair)', () => {
    const t = (s: string) => trigramIndex(s, 'name');
    const same = trigramSimilarity(t('NDIAYE AWA'), t('NDIAYE AWA'));
    const close = trigramSimilarity(t('NDIAYE AWA'), t('NDIAY AWA'));
    const far = trigramSimilarity(t('NDIAYE AWA'), t('MARTIN JEAN'));
    expect(same).toBe(1);
    expect(close).toBeGreaterThan(0.5);
    expect(far).toBeLessThan(0.1);
    expect(t('NDIAYE AWA').join('')).not.toMatch(/ndi|awa/i);
  });
});
