/* eslint-disable prettier/prettier */
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'crypto';
import { SiamIntegrationGuard } from './siam-integration.guard';

// jwks-rsa (module ES) remplace : la cle publique de test est servie sans appel reseau.
jest.mock('jwks-rsa', () => ({ JwksClient: jest.fn().mockImplementation(() => ({ getSigningKey: () => Promise.resolve({ getPublicKey: () => testPem() }) })) }));
let testPemValue = '';
const testPem = () => testPemValue;

const ISSUER = 'http://keycloak.test/realms/siam-realm';
const KEY = 'k'.repeat(40);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
testPemValue = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const sign = (payload: object, issuer = ISSUER) => new JwtService().sign(payload, { privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), algorithm: 'RS256', keyid: 'k1', issuer, expiresIn: 60 });

const guard = (env: Record<string, string>) => {
  const config = new ConfigService({ keycloak: { authServerUrl: 'http://dmgm-kc', realm: 'gestion-marins' }, ...env });
  return new SiamIntegrationGuard(config);
};
const ctx = (headers: Record<string, string>) => {
  const req = { headers } as { headers: Record<string, string>; siamCaller?: unknown };
  return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext };
};

describe("SiamIntegrationGuard (accès des applications SIAM)", () => {
  it('sans configuration : tout appel refusé', async () => {
    await expect(guard({}).canActivate(ctx({ 'x-api-key': KEY }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clé partagée valide acceptée, clé erronée refusée', async () => {
    const g = guard({ SIAM_INTEGRATION_API_KEY: KEY });
    const ok = ctx({ 'x-api-key': KEY });
    await expect(g.canActivate(ok.context)).resolves.toBe(true);
    expect(ok.req.siamCaller).toEqual({ client: 'api-key', via: 'api-key' });
    await expect(g.canActivate(ctx({ 'x-api-key': 'x'.repeat(40) }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clé trop courte ignorée', async () => {
    await expect(guard({ SIAM_INTEGRATION_API_KEY: 'court' }).canActivate(ctx({ 'x-api-key': 'court' }).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('jeton de service d’un client habilité accepté', async () => {
    const g = guard({ SIAM_INTEGRATION_ISSUER: ISSUER, SIAM_INTEGRATION_CLIENTS: 'siam-seafarer-certification-api, siam-seafarer-registry-api' });
    const c = ctx({ authorization: `Bearer ${sign({ azp: 'siam-seafarer-certification-api' })}` });
    await expect(g.canActivate(c.context)).resolves.toBe(true);
    expect(c.req.siamCaller).toEqual({ client: 'siam-seafarer-certification-api', via: 'keycloak' });
  });

  it('client non habilité : 403', async () => {
    const g = guard({ SIAM_INTEGRATION_ISSUER: ISSUER, SIAM_INTEGRATION_CLIENTS: 'siam-seafarer-certification-api' });
    await expect(g.canActivate(ctx({ authorization: `Bearer ${sign({ azp: 'autre-client' })}` }).context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('émetteur inattendu ou jeton absent : 401', async () => {
    const g = guard({ SIAM_INTEGRATION_ISSUER: ISSUER, SIAM_INTEGRATION_CLIENTS: 'siam-seafarer-certification-api' });
    await expect(g.canActivate(ctx({ authorization: `Bearer ${sign({ azp: 'siam-seafarer-certification-api' }, 'http://ailleurs/realms/x')}` }).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(g.canActivate(ctx({}).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
