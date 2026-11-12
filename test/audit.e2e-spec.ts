import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditModule } from '../src/audit/audit.module';
import { AuditService } from '../src/audit/audit.service';
import { KeycloakAuthGuard } from '../src/auth/guards/keycloak-auth.guard';

/**
 * Journal d'audit du dossier médical contre la vraie base MySQL :
 *   PRIVACY_TEST_DB_URL=mysql://… npx jest --config test/jest-e2e.json audit
 */
const URL = process.env.PRIVACY_TEST_DB_URL;

/** Authentification simulée : rôle passé dans l'en-tête `x-test-role`. */
@Injectable()
class TestAuth implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user?: unknown }>();
    req.user = {
      sub: 'kc-test',
      localUser: {
        id: 4242,
        firstName: 'Médecin',
        lastName: 'Test',
        roles: [{ name: req.headers['x-test-role'] ?? 'medecin' }],
      },
    };
    return true;
  }
}

/** Routes de même forme que celles du service. */
@Controller('visites')
class FakeVisites {
  @Get(':id') one(@Param('id') id: string) {
    if (id === '0') throw new NotFoundException();
    return { id };
  }
  @Put(':id/constante') constante(
    @Param('id') id: string,
    @Body() b: Record<string, unknown>,
  ) {
    return { id, ...b };
  }
}
@Controller('marins')
class FakeMarins {
  @Get('numero-cni/:numero_cni') byCni(@Param('numero_cni') cni: string) {
    return { cni };
  }
}

(URL ? describe : describe.skip)("Journal d'audit DMGM", () => {
  let app: INestApplication;
  let ds: DataSource;
  let audit: AuditService;
  const flush = () => new Promise((r) => setTimeout(r, 300));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          url: URL,
          entities: [],
          synchronize: false,
        }),
        AuditModule,
      ],
      controllers: [FakeVisites, FakeMarins],
      providers: [{ provide: APP_GUARD, useClass: TestAuth }],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useClass(TestAuth)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
    audit = app.get(AuditService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('trace la consultation et la modification, sans aucune valeur médicale', async () => {
    await request(app.getHttpServer()).get('/visites/777001').expect(200);
    await request(app.getHttpServer())
      .put('/visites/777001/constante')
      .send({ poids_kg: 81.37, systolique: 13.9, password: 'x' })
      .expect(200);
    await flush();
    const rows = (await ds.query(
      `SELECT * FROM audit_events WHERE entity_type = 'visites' AND entity_id = '777001' ORDER BY seq`,
    )) as Record<string, unknown>[];
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining(['CONSULTATION', 'MODIFICATION CONSTANTE']),
    );
    const put = rows.find((r) => r.action === 'MODIFICATION CONSTANTE')!;
    const fields =
      typeof put.fields === 'string'
        ? (JSON.parse(put.fields) as string[])
        : (put.fields as string[]);
    expect(fields).toEqual(['poids_kg', 'systolique']);
    expect(JSON.stringify(put)).not.toContain('81.37');
    expect(put.actor_id).toBe('4242');
    expect(put.actor_name).toBe('Médecin Test');
  });

  it('pseudonymise les identifiants de recherche et trace les échecs', async () => {
    await request(app.getHttpServer())
      .get('/marins/numero-cni/1234567890123')
      .expect(200);
    await request(app.getHttpServer()).get('/visites/0').expect(404);
    await flush();
    const [cni] = (await ds.query(
      `SELECT * FROM audit_events WHERE route LIKE '%numero-cni%' ORDER BY seq DESC LIMIT 1`,
    )) as Record<string, unknown>[];
    expect(JSON.stringify(cni)).not.toContain('1234567890123');
    expect(JSON.stringify(cni.context)).toContain('psd:');
    const [ko] = (await ds.query(
      `SELECT status FROM audit_events WHERE entity_type = 'visites' AND entity_id = '0' ORDER BY seq DESC LIMIT 1`,
    )) as { status: number }[];
    expect(Number(ko.status)).toBe(404);
  });

  it('la chaîne est intacte, et le journal ne peut être ni modifié ni effacé', async () => {
    expect((await audit.verify()).ok).toBe(true);
    await expect(
      ds.query(`UPDATE audit_events SET actor_name = 'x'`),
    ).rejects.toThrow(/SIAM_IMMUTABLE/);
    await expect(ds.query(`DELETE FROM audit_events`)).rejects.toThrow(
      /SIAM_IMMUTABLE/,
    );
  });

  it('écritures concurrentes : la chaîne reste continue', async () => {
    const before = await audit.verify();
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        audit.record({
          actorId: 'test',
          actorName: 'Test',
          action: 'CONSULTATION',
          entityType: 'visites',
          entityId: String(900000 + i),
          route: 'GET /visites/:id',
          status: 200,
          fields: [],
          context: {},
          ip: null,
        }),
      ),
    );
    const after = await audit.verify();
    expect(after).toMatchObject({
      ok: true,
      brokenAt: null,
      entries: before.entries + 30,
    });
  });

  it('lecture du journal réservée', async () => {
    await request(app.getHttpServer())
      .get('/audit')
      .set('x-test-role', 'infirmier')
      .expect(403);
    const res = await request(app.getHttpServer())
      .get('/audit?entityType=visites')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const v = await request(app.getHttpServer())
      .get('/audit/verify')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(v.body.ok).toBe(true);
  });
});
