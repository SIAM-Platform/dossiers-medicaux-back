/* eslint-disable prettier/prettier */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import { JwksClient } from 'jwks-rsa';

/** Appelant authentifie d'une application SIAM (journalise, jamais expose). */
export interface SiamCaller {
  client: string;
  via: 'keycloak' | 'api-key';
}

/**
 * Acces machine a machine reserve aux applications SIAM habilitees, distinct de l'acces
 * des agents DMGM (comptes locaux par email et roles) :
 * - jeton Keycloak « client credentials » emis par SIAM_INTEGRATION_ISSUER, dont le client
 *   (azp) figure dans SIAM_INTEGRATION_CLIENTS ;
 * - ou, a defaut de Keycloak (developpement, raccordement transitoire), cle partagee
 *   SIAM_INTEGRATION_API_KEY (32 caracteres minimum) dans l'en-tete X-Api-Key.
 * Sans configuration, tout appel est refuse.
 */
@Injectable()
export class SiamIntegrationGuard implements CanActivate {
  private readonly logger = new Logger(SiamIntegrationGuard.name);
  private readonly jwt = new JwtService();
  private readonly issuer: string;
  private readonly clients: string[];
  private readonly apiKey: string | null;
  private readonly jwks: JwksClient | null;

  constructor(config: ConfigService) {
    const kc = `${config.get<string>('keycloak.authServerUrl')}/realms/${config.get<string>('keycloak.realm')}`;
    this.issuer = (config.get<string>('SIAM_INTEGRATION_ISSUER') || kc).replace(/\/+$/, '');
    this.clients = (config.get<string>('SIAM_INTEGRATION_CLIENTS') || '').split(',').map((c) => c.trim()).filter(Boolean);
    const key = config.get<string>('SIAM_INTEGRATION_API_KEY') || '';
    if (key && key.length < 32) this.logger.warn('SIAM_INTEGRATION_API_KEY ignorée : 32 caractères minimum');
    this.apiKey = key.length >= 32 ? key : null;
    this.jwks = this.clients.length ? new JwksClient({ jwksUri: `${this.issuer}/protocol/openid-connect/certs`, cache: true, rateLimit: true, jwksRequestsPerMinute: 10 }) : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; siamCaller?: SiamCaller }>();
    const presented = req.headers['x-api-key'];
    if (presented && this.apiKey) {
      const a = createHash('sha256').update(presented).digest();
      const b = createHash('sha256').update(this.apiKey).digest();
      if (!timingSafeEqual(a, b)) throw new UnauthorizedException('Clé d’intégration invalide');
      req.siamCaller = { client: 'api-key', via: 'api-key' };
      return true;
    }
    const auth = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token || !this.jwks) throw new UnauthorizedException('Jeton de service requis');
    const decoded = this.jwt.decode<{ header?: { kid?: string } } | null>(token, { complete: true });
    const kid = decoded?.header?.kid;
    if (!kid) throw new UnauthorizedException('Jeton de service invalide');
    let payload: { azp?: string };
    try {
      const signingKey = await this.jwks.getSigningKey(kid);
      payload = await this.jwt.verifyAsync(token, { publicKey: signingKey.getPublicKey(), algorithms: ['RS256'], issuer: this.issuer });
    } catch {
      throw new UnauthorizedException('Jeton de service invalide');
    }
    if (!payload.azp || !this.clients.includes(payload.azp)) throw new ForbiddenException('Application non habilitée à consulter l’aptitude');
    req.siamCaller = { client: payload.azp, via: 'keycloak' };
    return true;
  }
}
