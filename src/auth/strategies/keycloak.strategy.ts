/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/services/users.service';
import * as jwksRsa from 'jwks-rsa';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
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
      return { ...payload, localUser: user };
    } catch (error) {
      // L'utilisateur n'existe pas, on renvoie une erreur 401
      throw new UnauthorizedException('Accès non autorisé : utilisateur non enregistré');
    }
  }
}