import { randomBytes } from 'crypto';
import {
  decryptField,
  encryptField,
  encryptedJson,
  isEncrypted,
  keyIdOf,
} from './field-cipher';
import { installKeyring, masterKey, resetKeyring } from './keyring';

describe('Chiffrement des champs sensibles', () => {
  afterEach(() => resetKeyring());

  it('chiffre de facon non deterministe et dechiffre a l identique', () => {
    const a = encryptField('SSO : Capt. Diallo +221 77 000 00 00');
    const b = encryptField('SSO : Capt. Diallo +221 77 000 00 00');
    expect(a).not.toEqual(b);
    expect(decryptField(a)).toBe('SSO : Capt. Diallo +221 77 000 00 00');
  });

  it('avant le trousseau : ancien format v1 ; apres : v2 avec l identifiant de la cle', () => {
    const v1 = encryptField('Awa Ndiaye');
    expect(v1.startsWith('enc:v1:')).toBe(true);
    installKeyring(new Map([['k1', randomBytes(32)]]), 'k1', masterKey());
    const v2 = encryptField('Awa Ndiaye');
    expect(v2.startsWith('enc:v2:k1:')).toBe(true);
    expect(keyIdOf(v2)).toBe('k1');
    expect(keyIdOf(v1)).toBe('v1');
    expect(keyIdOf('en clair')).toBeNull();
    // L'ancien format reste lisible apres l'installation du trousseau.
    expect(decryptField(v1)).toBe('Awa Ndiaye');
    expect(decryptField(v2)).toBe('Awa Ndiaye');
  });

  it('une cle retiree reste lisible ; une cle inconnue est refusee', () => {
    const k1 = randomBytes(32);
    installKeyring(new Map([['k1', k1]]), 'k1', masterKey());
    const old = encryptField('donnee');
    installKeyring(
      new Map([
        ['k1', k1],
        ['k2', randomBytes(32)],
      ]),
      'k2',
      masterKey(),
    );
    expect(encryptField('x').startsWith('enc:v2:k2:')).toBe(true);
    expect(decryptField(old)).toBe('donnee');
    installKeyring(new Map([['k3', randomBytes(32)]]), 'k3', masterKey());
    expect(() => decryptField(old)).toThrow(/inconnue/);
  });

  it('detecte toute alteration (authentification GCM)', () => {
    installKeyring(new Map([['k1', randomBytes(32)]]), 'k1', masterKey());
    const enc = encryptField('secret');
    const head = 'enc:v2:k1:';
    const raw = Buffer.from(enc.slice(head.length), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => decryptField(head + raw.toString('base64'))).toThrow();
  });

  it('colonne JSON : objet chiffre en entier, lecture des anciens contenus en clair', () => {
    const stored = encryptedJson.to({ a: 1 }) as { enc: string };
    expect(isEncrypted(stored.enc)).toBe(true);
    expect(encryptedJson.from(stored)).toEqual({ a: 1 });
    expect(encryptedJson.from({ a: 2 })).toEqual({ a: 2 });
  });
});
