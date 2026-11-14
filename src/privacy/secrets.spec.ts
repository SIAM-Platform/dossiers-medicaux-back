import { mkdtempSync, writeFileSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadSecrets } from './secrets';

const quiet = { log: () => undefined } as never;

describe('Lecture des secrets (fichier monte, coffre Vault)', () => {
  it('NOM_FILE : le secret est lu depuis le fichier, sans ecraser une valeur deja fournie', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'siam-secrets-'));
    writeFileSync(join(dir, 'k'), 'valeur-du-fichier\n');
    const env: Record<string, string | undefined> = {
      DB_PASSWORD_FILE: join(dir, 'k'),
      SMTP_PASS: 'deja',
      SMTP_PASS_FILE: join(dir, 'k'),
    };
    const r = await loadSecrets(env, quiet);
    expect(env.DB_PASSWORD).toBe('valeur-du-fichier');
    expect(env.SMTP_PASS).toBe('deja');
    expect(r.files).toEqual(['DB_PASSWORD']);
  });

  it('fichier absent : demarrage refuse', async () => {
    await expect(
      loadSecrets({ X_SECRET_FILE: '/nulle/part' }, quiet),
    ).rejects.toThrow(/illisible/);
  });

  it('une variable _FILE qui n est pas un secret est ignoree (sauf liste explicite)', async () => {
    const env: Record<string, string | undefined> = {
      SOME_TOOL_FILE: '1',
      PIP_CONFIG_FILE: '/nulle/part',
    };
    const r = await loadSecrets(env, quiet);
    expect(r.files).toEqual([]);
    expect(env.SOME_TOOL).toBeUndefined();
    await expect(
      loadSecrets(
        { SMTP_LOGIN_FILE: '/nulle/part', SECRET_FILE_VARS: 'SMTP_LOGIN' },
        quiet,
      ),
    ).rejects.toThrow(/illisible/);
  });

  describe('coffre Vault (KV v2)', () => {
    let server: Server;
    let addr: string;
    const seen: { url?: string; token?: string } = {};
    beforeAll(async () => {
      server = createServer((req, res) => {
        seen.url = req.url;
        seen.token = req.headers['x-vault-token'] as string;
        if (req.headers['x-vault-token'] !== 'jeton-test') {
          res.writeHead(403).end('{}');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            data: {
              data: {
                FIELD_MASTER_KEY: 'cle-du-coffre',
                DB_PASSWORD: 'mdp-du-coffre',
                'pas une variable': 'x',
              },
            },
          }),
        );
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      addr = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(() => new Promise((r) => server.close(r)));

    it('charge les secrets du coffre dans l environnement', async () => {
      const env: Record<string, string | undefined> = {
        VAULT_ADDR: addr,
        VAULT_TOKEN: 'jeton-test',
        VAULT_SECRET_PATH: 'siam/gum',
        DB_PASSWORD: 'local',
      };
      const r = await loadSecrets(env, quiet);
      expect(seen.url).toBe('/v1/secret/data/siam/gum');
      expect(env.FIELD_MASTER_KEY).toBe('cle-du-coffre');
      expect(env.DB_PASSWORD).toBe('local');
      expect(r.vault).toEqual(['FIELD_MASTER_KEY']);
      expect(env['pas une variable']).toBeUndefined();
    });

    it('VAULT_OVERRIDE : le coffre l emporte sur l environnement', async () => {
      const env: Record<string, string | undefined> = {
        VAULT_ADDR: addr,
        VAULT_TOKEN: 'jeton-test',
        VAULT_SECRET_PATH: 'siam/gum',
        DB_PASSWORD: 'local',
        VAULT_OVERRIDE: 'true',
      };
      await loadSecrets(env, quiet);
      expect(env.DB_PASSWORD).toBe('mdp-du-coffre');
    });

    it('coffre qui refuse : demarrage refuse', async () => {
      await expect(
        loadSecrets(
          {
            VAULT_ADDR: addr,
            VAULT_TOKEN: 'mauvais',
            VAULT_SECRET_PATH: 'siam/gum',
          },
          quiet,
        ),
      ).rejects.toThrow(/Vault/);
    });
  });
});
