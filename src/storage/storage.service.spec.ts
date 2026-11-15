import { createServer, Server } from 'net';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { openFile, sealFile } from './file-crypto';
import { StorageService } from './storage.service';
import { UPLOAD_POLICIES } from './storage.policies';

// Images minimales valides (signatures réelles).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Faux clamd : répond FOUND si le flux contient la chaîne EICAR, OK sinon. */
function fakeClamd(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((s) => {
      let buf = Buffer.alloc(0);
      s.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        if (buf.subarray(-4).equals(Buffer.alloc(4))) {
          s.end(buf.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

function memoryRepo() {
  const rows = new Map<string, Record<string, unknown>>();
  let n = 0;
  return {
    rows,
    create: (x: Record<string, unknown>) => x,
    save: async (x: Record<string, unknown>) => {
      if (!x.id) x.id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      if (!x.uploadedAt) x.uploadedAt = new Date();
      rows.set(x.id as string, { ...x });
      return x;
    },
    findOne: async ({ where }: { where: { id: string } }) => {
      const r = rows.get(where.id);
      return r && !r.deletedAt ? { ...r } : null;
    },
  };
}

describe('Bibliothèque de stockage SIAM', () => {
  let dir: string;
  let repo: ReturnType<typeof memoryRepo>;
  let journal: { record: jest.Mock };
  let clamd: { server: Server; port: number };

  const make = (env: Record<string, string>) => {
    Object.assign(process.env, { STORAGE_DRIVER: 'local', STORAGE_LOCAL_PATH: dir, STORAGE_ANTIVIRUS: 'optional', ...env });
    return new StorageService(repo as never, journal as never);
  };

  beforeAll(async () => {
    clamd = await fakeClamd();
  });
  afterAll(() => clamd.server.close());
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'siam-storage-'));
    repo = memoryRepo();
    journal = { record: jest.fn() };
    delete process.env.CLAMAV_HOST;
  });

  it('chiffre le fichier sur le disque et le relit à l’identique', async () => {
    const s = make({});
    const f = await s.store({ buffer: PNG, originalname: 'scan.png' }, UPLOAD_POLICIES.SCAN, null);
    const onDisk = walk(dir);
    expect(onDisk).toHaveLength(1);
    const raw = readFileSync(onDisk[0]);
    expect(raw.subarray(0, 6).toString()).toBe('SIAMF1');
    expect(raw.includes(PNG.subarray(8, 24))).toBe(false);
    expect((statSync(onDisk[0]).mode & 0o777).toString(8)).toBe('600');
    const back = await s.read(f.id);
    expect(back.data.equals(PNG)).toBe(true);
  });

  it('refuse un contenu qui ne correspond pas à son extension, ou un type non autorisé', async () => {
    const s = make({});
    await expect(s.store({ buffer: PDF, originalname: 'photo.png' }, UPLOAD_POLICIES.SCAN, null)).rejects.toThrow(/Type de fichier/);
    await expect(s.store({ buffer: Buffer.from('MZ\x90\x00binaire'), originalname: 'x.exe' }, UPLOAD_POLICIES.SCAN, null)).rejects.toThrow(/Type de fichier/);
    expect(journal.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'FICHIER_REFUSE' }));
  });

  it('refuse un fichier trop volumineux', async () => {
    const s = make({ UPLOAD_MAX_MB: '1' });
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await expect(s.store({ buffer: big, originalname: 'x.png' }, UPLOAD_POLICIES.SCAN, null)).rejects.toThrow(/trop volumineux/);
    delete process.env.UPLOAD_MAX_MB;
  });

  it('antivirus : fichier infecté refusé, antivirus injoignable ou absent (exigé) refusé', async () => {
    const eicar = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const policy = { mimeTypes: [], textTypes: { '.txt': 'text/plain' }, maxBytes: 1024 * 1024 };
    let s = make({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(clamd.port) });
    await expect(s.store({ buffer: eicar, originalname: 'a.txt' }, policy, null)).rejects.toThrow(/malveillant/);
    const ok = await s.store({ buffer: Buffer.from('bonjour'), originalname: 'a.txt' }, policy, null);
    expect(ok.avStatus).toBe('CLEAN');
    s = make({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: '1' });
    await expect(s.store({ buffer: Buffer.from('bonjour'), originalname: 'a.txt' }, policy, null)).rejects.toThrow(/antivirus indisponible/i);
    delete process.env.CLAMAV_HOST;
    s = make({ STORAGE_ANTIVIRUS: 'required' });
    await expect(s.store({ buffer: Buffer.from('bonjour'), originalname: 'a.txt' }, policy, null)).rejects.toThrow(/antivirus indisponible/i);
  });

  it('lien court : permission exigée, signature et échéance vérifiées, accès tracé', async () => {
    const s = make({});
    const f = await s.store({ buffer: PNG, originalname: 'scan.png' }, UPLOAD_POLICIES.SCAN, null, undefined, { type: 'Examen', id: 1, readPermission: 'visite.read' });
    const reader = { sub: 'u1', permissions: ['visite.read'] };
    await expect(s.createLink(f.id, { sub: 'u2', permissions: [] })).rejects.toThrow(/accès/);
    const link = await s.createLink(f.id, reader);
    expect(link.path).toMatch(/^files\/download\//);
    const got = await s.download(link.token, '10.0.0.1');
    expect(got.data.equals(PNG)).toBe(true);
    const [p, sig] = link.token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), e: 9999999999 })).toString('base64url');
    await expect(s.download(`${forged}.${sig}`, null)).rejects.toThrow(/invalide/);
    process.env.STORAGE_LINK_TTL_SECONDS = '30';
    const s2 = make({});
    const short = await s2.createLink(f.id, reader);
    jest.useFakeTimers({ now: Date.now() + 31_000 });
    await expect(s2.download(short.token, null)).rejects.toThrow(/expiré/);
    jest.useRealTimers();
    delete process.env.STORAGE_LINK_TTL_SECONDS;
    const actions = journal.record.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(expect.arrayContaining(['FICHIER_DEPOSE', 'FICHIER_ACCES_REFUSE', 'FICHIER_LIEN', 'FICHIER_TELECHARGE']));
  });

  it('détecte un fichier altéré dans le stockage', async () => {
    const s = make({});
    const f = await s.store({ buffer: PNG, originalname: 'scan.png' }, UPLOAD_POLICIES.SCAN, null);
    const row = repo.rows.get(f.id)!;
    // Remplacement du contenu par un autre fichier chiffré valide : l'empreinte trahit la substitution.
    const other = sealFile(PDF);
    require('fs').writeFileSync(walk(dir)[0], other.blob);
    row.fileKey = other.fileKey;
    await expect(s.read(f.id)).rejects.toThrow(/altéré/);
  });

  it('reprise (anyType) : tout type conservé, antivirus et chiffrement appliqués', async () => {
    const s = make({});
    const f = await s.store({ buffer: Buffer.from([0, 1, 2, 3, 250]), originalname: 'enregistreur.vdr' }, { mimeTypes: [], maxBytes: 1024, anyType: true }, null);
    expect(f.mimeType).toBe('application/octet-stream');
    expect((await s.read(f.id)).data.equals(Buffer.from([0, 1, 2, 3, 250]))).toBe(true);
    await expect(s.store({ buffer: Buffer.from([0, 1, 2]), originalname: 'x.vdr' }, { mimeTypes: [], maxBytes: 1024 }, null)).rejects.toThrow(/Type de fichier/);
  });

  it('nom de fichier UTF-8 transmis en latin1 par multer : rétabli', () => {
    const { sanitizeName } = require('./storage.service');
    expect(sanitizeName(Buffer.from('brèche côté quai.png', 'utf8').toString('latin1'))).toBe('brèche côté quai.png');
    expect(sanitizeName('déjà correct.pdf')).toBe('déjà correct.pdf');
  });

  it('le format chiffré refuse une clé erronée', () => {
    const { blob } = sealFile(PNG);
    expect(() => openFile(blob, sealFile(PNG).fileKey)).toThrow();
  });
});
