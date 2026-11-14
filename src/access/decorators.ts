import { SetMetadata } from '@nestjs/common';
import type { PermissionDefinition } from './permissions';

export const PERMISSIONS_KEY = 'siam:permissions';
export const AUTHENTICATED_KEY = 'siam:authenticated';

/** Permissions exigées (toutes). Une route sans décorateur d'accès est refusée. */
export const RequirePermission = (...permissions: PermissionDefinition[]) =>
  SetMetadata(
    PERMISSIONS_KEY,
    permissions.map((p) => p.code),
  );

/** Route ouverte à tout utilisateur connecté (profil courant, préférences). */
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);
