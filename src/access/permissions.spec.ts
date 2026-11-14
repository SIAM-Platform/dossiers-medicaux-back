import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from './permissions';

const codes = (role: string) =>
  (DEFAULT_ROLE_PERMISSIONS[role] ?? []).map((p) => p.code);

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return controllers(p);
    return /\.(controller|module)\.ts$/.test(f) ? [p] : [];
  });
}

describe('Catalogue et attribution par défaut des permissions', () => {
  it('codes uniques', () => {
    const all = ALL_PERMISSIONS.map((p) => p.code);
    expect(new Set(all).size).toBe(all.length);
  });

  it("seul l'administrateur gère les comptes, les rôles et la matrice", () => {
    const admin: string[] = [
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.ROLE_ASSIGN,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.PERMISSION_MANAGE,
    ].map((p) => p.code);
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS).filter(
      (r) => r !== 'admin',
    )) {
      expect(codes(role).filter((c) => admin.includes(c))).toEqual([]);
    }
  });

  it("seuls le médecin et l'administrateur concluent une visite (décision d'aptitude)", () => {
    const who = Object.keys(DEFAULT_ROLE_PERMISSIONS).filter((r) =>
      codes(r).includes(PERMISSIONS.VISITE_CONCLUDE.code),
    );
    expect(who.sort()).toEqual(['admin', 'medecin']);
  });

  it("l'infirmier n'accède ni aux fiches du personnel ni au journal d'audit", () => {
    expect(codes('infirmier')).not.toContain(PERMISSIONS.PERSONNEL_READ.code);
    expect(codes('infirmier')).not.toContain(PERMISSIONS.AUDIT_READ.code);
  });

  it('chaque route déclare son accès (permission connue, public ou connecté)', () => {
    const known = new Set(Object.keys(PERMISSIONS));
    for (const file of controllers(join(__dirname, '..'))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/RequirePermission\(PERMISSIONS\.(\w+)\)/g))
        expect(known.has(m[1])).toBe(true);
      expect(src).not.toMatch(/@Roles\(/);
    }
  });
});
