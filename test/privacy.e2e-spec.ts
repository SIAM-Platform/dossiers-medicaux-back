import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PRIVACY_INVENTORY_DATA as INVENTORY } from '../src/privacy/inventory';
import { privacyModule } from '../src/privacy/privacy.module';

/**
 * Module RGPD contre la vraie base du service (PostgreSQL ou MySQL) :
 *   PRIVACY_TEST_DB_TYPE=postgres|mysql PRIVACY_TEST_DB_URL=… npx jest --config test/jest-e2e.json privacy
 * Vérifie que chaque condition de purge et chaque exporteur de l'inventaire s'exécute sur le schéma
 * réel. La purge n'est jamais appliquée par ce test (mode rapport).
 */
const URL = process.env.PRIVACY_TEST_DB_URL;
const TYPE = (process.env.PRIVACY_TEST_DB_TYPE ?? 'postgres') as
  'postgres' | 'mysql';

/** Authentification simulée : rôles passés dans l'en-tête `x-test-roles`. */
@Injectable()
class TestAuth implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    req.user = {
      id: 'test-dpo',
      firstName: 'Délégué',
      lastName: 'Test',
      roles: (req.headers['x-test-roles'] ?? '').split(',').filter(Boolean),
    };
    return true;
  }
}

(URL ? describe : describe.skip)('RGPD (hors socle)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const dpo = { 'x-test-roles': 'PRIVACY_OFFICER' };

  beforeAll(async () => {
    process.env.PRIVACY_RETENTION_MODE = 'report';
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: TYPE,
          url: URL,
          entities: [],
          synchronize: false,
        }),
        privacyModule({
          inventory: INVENTORY,
          authGuards: [TestAuth],
          access: {
            read: ['PRIVACY_OFFICER'],
            manage: ['PRIVACY_OFFICER'],
            export: ['PRIVACY_OFFICER'],
          },
        }),
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('refuse un agent sans le rôle requis', async () => {
    await request(app.getHttpServer())
      .get('/privacy/register')
      .set('x-test-roles', 'AGENT')
      .expect(403);
  });

  it('produit le registre des traitements (JSON et CSV)', async () => {
    const res = await request(app.getHttpServer())
      .get('/privacy/register')
      .set(dpo)
      .expect(200);
    expect(res.body.datasets).toHaveLength(INVENTORY.datasets.length);
    const csv = await request(app.getHttpServer())
      .get('/privacy/register.csv')
      .set(dpo)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n').length).toBeGreaterThan(
      INVENTORY.datasets.length,
    );
  });

  it('chaque règle de purge s’exécute sur le schéma réel (rapport, rien n’est supprimé)', async () => {
    const res = await request(app.getHttpServer())
      .post('/privacy/retention/run')
      .set(dpo)
      .send({ apply: true })
      .expect(200);
    expect(res.body.applied).toBe(false);
    for (const line of res.body.lines as {
      eligible: unknown;
      applied: number;
    }[]) {
      expect(typeof line.eligible).toBe('number');
      expect(line.applied).toBe(0);
    }
  });

  it('modifie une durée (tracé) et refuse une durée sur une donnée conservée', async () => {
    const del = INVENTORY.datasets.find((d) => d.retention.action !== 'KEEP');
    const keep = INVENTORY.datasets.find((d) => d.retention.action === 'KEEP');
    if (del) {
      await request(app.getHttpServer())
        .put(`/privacy/retention/${del.retention.key}`)
        .set(dpo)
        .send({
          days: del.retention.defaultDays ?? 365,
          reason: 'Contrôle automatique',
        })
        .expect(200);
    }
    if (keep) {
      await request(app.getHttpServer())
        .put(`/privacy/retention/${keep.retention.key}`)
        .set(dpo)
        .send({ days: 30, reason: 'x' })
        .expect(409);
    }
  });

  it('enregistre une demande (identité chiffrée) et exige une réponse pour la clore', async () => {
    const created = await request(app.getHttpServer())
      .post('/privacy/requests')
      .set(dpo)
      .send({
        type: 'ACCESS',
        subjectType: INVENTORY.exporters[0].type,
        subjectRef: 'ref-test-rgpd',
        requesterName: 'Demandeur Test',
        requesterContact: '+221 77 000 00 00',
      })
      .expect(201);
    expect(created.body.reference).toMatch(/^DPR-\d{4}-\d{5}$/);
    const [row] = (await ds.query(
      TYPE === 'mysql'
        ? 'SELECT subject_ref FROM privacy_requests WHERE id = ?'
        : 'SELECT subject_ref FROM privacy_requests WHERE id = $1',
      [created.body.id],
    )) as { subject_ref: string }[];
    expect(row.subject_ref.startsWith('enc:v1:')).toBe(true);
    await request(app.getHttpServer())
      .patch(`/privacy/requests/${created.body.id}`)
      .set(dpo)
      .send({ status: 'COMPLETED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/privacy/requests/${created.body.id}`)
      .set(dpo)
      .send({ status: 'COMPLETED', response: 'Données transmises' })
      .expect(200);
  });

  it('chaque exporteur s’exécute sur le schéma réel', async () => {
    for (const e of INVENTORY.exporters) {
      const res = await request(app.getHttpServer())
        .get(`/privacy/subjects/${e.type}/export`)
        .query({ ref: 'personne-inexistante-rgpd' })
        .set(dpo)
        .expect(200);
      expect(res.body.subjectType).toBe(e.type);
    }
  });

  it('le journal RGPD est en ajout seul', async () => {
    const audit = await request(app.getHttpServer())
      .get('/privacy/audit')
      .set(dpo)
      .expect(200);
    expect(audit.body.length).toBeGreaterThan(0);
    await expect(
      ds.query('UPDATE privacy_audit_events SET summary = summary'),
    ).rejects.toThrow(/SIAM_IMMUTABLE/);
    await expect(ds.query('DELETE FROM privacy_audit_events')).rejects.toThrow(
      /SIAM_IMMUTABLE/,
    );
  });
});
