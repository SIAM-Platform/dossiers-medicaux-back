import {
  isPersonalKey,
  maskPersonal,
  pseudonym,
  redactText,
} from './pseudonymize';

describe('Pseudonymisation (RGPD)', () => {
  it('donne un pseudonyme stable, non réversible, insensible à la casse et aux espaces', () => {
    expect(pseudonym('Awa.Diagne@demo.sn')).toBe(
      pseudonym(' awa.diagne@demo.sn '),
    );
    expect(pseudonym('a@b.sn')).not.toBe(pseudonym('c@d.sn'));
    expect(pseudonym('a@b.sn')).toMatch(/^psd:[0-9a-f]{16}$/);
  });

  it('reconnaît les champs personnels, y compris les éléments FAL (CREW.FAMILY_NAME…)', () => {
    for (const k of [
      'email',
      'Telephone',
      'nom',
      'CREW.FAMILY_NAME',
      'PAX.ID_DOC_NUMBER',
      'birth_date',
      'givenNames',
    ])
      expect(isPersonalKey(k)).toBe(true);
    for (const k of ['status', 'reference', 'SHIP.NAME', 'formCode', 'roles'])
      expect(isPersonalKey(k)).toBe(false);
  });

  it("masque les données personnelles d'un objet audité, à toute profondeur, sans toucher au reste", () => {
    const out = maskPersonal({
      email: 'x@y.sn',
      roles: ['AUDITOR'],
      crew: [{ 'CREW.FAMILY_NAME': 'NDIAYE', 'CREW.RANK': 'Capitaine' }],
      nested: { telephone: '+221771234567' },
      empty: null,
    });
    expect(out.email).toBe(pseudonym('x@y.sn'));
    expect(out.roles).toEqual(['AUDITOR']);
    expect(out.crew[0]['CREW.FAMILY_NAME']).toBe(pseudonym('NDIAYE'));
    expect(out.crew[0]['CREW.RANK']).toBe('Capitaine');
    expect(out.nested.telephone).toMatch(/^psd:/);
    expect(out.empty).toBeNull();
  });

  it('retire e-mails et téléphones internationaux d’un texte, sans toucher aux références métier', () => {
    const t = redactText(
      'Envoi à awa@demo.sn (+221 77 123 45 67) pour PC-SNDKR-2026-00284, IMO 9358125',
    );
    expect(t).not.toContain('awa@demo.sn');
    expect(t).not.toContain('123 45 67');
    expect(t).toContain('PC-SNDKR-2026-00284');
    expect(t).toContain('IMO 9358125');
  });
});
