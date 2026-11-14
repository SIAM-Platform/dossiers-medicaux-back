import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessService } from './access.service';
import { DEFAULT_ROLE_PERMISSIONS } from './permissions';

const codes = (role: string) =>
  DEFAULT_ROLE_PERMISSIONS[role].map((p) => p.code);
const svc = new AccessService({} as DataSource);

describe('Règle anti-escalade', () => {
  it('un médecin peut attribuer les rôles infirmier et médecin', () => {
    expect(() =>
      svc.assertWithinOwnRights(
        codes('medecin'),
        codes('infirmier'),
        'Attribution',
      ),
    ).not.toThrow();
    expect(() =>
      svc.assertWithinOwnRights(
        codes('medecin'),
        codes('medecin'),
        'Attribution',
      ),
    ).not.toThrow();
  });

  it('un médecin ne peut ni donner le rôle admin ni gérer un compte administrateur', () => {
    expect(() =>
      svc.assertWithinOwnRights(
        codes('medecin'),
        codes('admin'),
        'Attribution',
      ),
    ).toThrow(ForbiddenException);
  });

  it("l'administrateur peut tout attribuer", () => {
    for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      expect(() =>
        svc.assertWithinOwnRights(codes('admin'), codes(role), 'Attribution'),
      ).not.toThrow();
    }
  });
});
