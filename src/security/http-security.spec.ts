import { corsOrigins, LOCALHOST, SIAM_DOMAIN, swaggerEnabled } from './http-security';

describe('Sécurité HTTP commune', () => {
  it('origines CORS : liste explicite, jamais « * »', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'https://a.siam-platform.com, *, https://b.siam-platform.com/', NODE_ENV: 'production' })).toEqual([
      'https://a.siam-platform.com',
      'https://b.siam-platform.com',
    ]);
  });
  it('origines CORS : anciennes variables du service reprises', () => {
    expect(corsOrigins({ FRONTEND_URL: 'https://x.example.org', NODE_ENV: 'production' })).toEqual(['https://x.example.org']);
    expect(corsOrigins({ CORS_ORIGIN: 'https://y.example.org' })).toEqual(['https://y.example.org', LOCALHOST]);
  });
  it('sans configuration : sous-domaines SIAM seulement en production', () => {
    const prod = corsOrigins({ NODE_ENV: 'production' });
    expect(prod).toEqual([SIAM_DOMAIN]);
    expect(SIAM_DOMAIN.test('https://enquetes.siam-platform.com')).toBe(true);
    expect(SIAM_DOMAIN.test('https://siam-platform.com.evil.io')).toBe(false);
    expect(SIAM_DOMAIN.test('http://enquetes.siam-platform.com')).toBe(false);
  });
  it('Swagger fermé par défaut en production', () => {
    expect(swaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(swaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(true);
    expect(swaggerEnabled({})).toBe(true);
  });
});
