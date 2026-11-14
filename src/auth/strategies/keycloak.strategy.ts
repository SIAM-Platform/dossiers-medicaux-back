/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/services/users.service';
import { AccessService } from '../../access/access.service';
import * as jwksRsa from 'jwks-rsa';

/** Authentification forte constatée sur le jeton (claims acr / amr), comme dans le socle. */
export function isMfa(payload: { acr?: string; amr?: string[] }): boolean {
  const acr = (process.env.MFA_ACR_VALUES ?? 'mfa,2,gold')
    .split(',')
    .map((v) => v.trim());
  if (payload.acr && acr.includes(String(payload.acr))) return true;
  return (
    Array.isArray(payload.amr) &&
    payload.amr.some((m) =>
      ['otp', 'totp', 'webauthn', 'mfa', 'hwk'].includes(m),
    )
  );
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private accessService: AccessService,
  ) {
    const authServerUrl = configService.get('keycloak.authServerUrl');
    const realm = configService.get('keycloak.realm');
    // Dans la configuration de la stratégie
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${authServerUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      audience: 'account',
      issuer: `${authServerUrl}/realms/${realm}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.usersService.findFromKeycloak({
        username: payload.preferred_username,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        sub: payload.sub,
      });
      // Permissions effectives (union des permissions des rôles, table role_permission).
      const permissions = await this.accessService.permissionsOf(
        (user.roles ?? []).map((r) => r.id),
      );
      return {
        ...payload,
        permissions,
        mfa: isMfa(payload),
        localUser: { ...user, permissions },
      };
    } catch (error) {
      // L'utilisateur n'existe pas, on renvoie une erreur 401
      throw new UnauthorizedException(
        'Accès non autorisé : utilisateur non enregistré',
      );
    }
  }
}
