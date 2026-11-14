import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MarinProtectionService } from '../src/marins/marin-protection.service';
import { MarinsService } from '../src/marins/services/marins.service';
import { Constante } from '../src/visites/entities/constante.entity';
import { VisiteMedicale } from '../src/visites/entities/visite-medicale.entity';
import { SiamIntegrationService } from '../src/integrations/siam/siam-integration.service';

/**
 * Dossier médical chiffré en base, sur PostgreSQL réel (application complète, schéma créé par
 * les migrations) :
 *   PRIVACY_TEST_DB_NAME=siam_dmgm_e2e npx jest --config test/jest-e2e.json medical-encryption
 * La base indiquée est recréée par le test (son nom doit contenir « e2e » ou « test »).
 */
const DB = process.env.PRIVACY_TEST_DB_NAME;

(DB && /e2e|test/.test(DB) ? describe : describe.skip)(
  'DMGM — dossier médical chiffré en base',
  () => {
    let app: INestApplicationContext;
    let ds: DataSource;
    let marins: MarinsService;

    beforeAll(async () => {
      process.env.DB_NAME = DB;
      process.env.CRYPTO_KEYRING_REFRESH_SECONDS = '0';
      const admin = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: 'postgres',
      });
      await admin.initialize();
      await admin.query(`DROP DATABASE IF EXISTS "${DB}"`);
      await admin.query(`CREATE DATABASE "${DB}"`);
      await admin.destroy();
      app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error'],
      });
      ds = app.get(DataSource);
      marins = app.get(MarinsService);
    });

    afterAll(async () => app?.close());

    let id: number;

    it('identité, situation et constantes chiffrées ; rien de lisible en SQL direct', async () => {
      const m = await marins.create({
        nom: 'Diop',
        prenom: 'Mamadou Lamine',
        date_naissance: '1988-07-14',
        sexe: 'Homme',
        nationalite: 'Sénégalaise',
        telephone: '+221 77 123 45 67',
        email: 'mamadou.diop@example.sn',
        adresse: 'Rufisque, cité Diokoul',
        numero_cni: '1 751 1988 01234',
        numero_ins_mar: 'DKR-2009-0815',
        accident_travail: true,
      });
      id = m.id;
      const visite = await ds.getRepository(VisiteMedicale).save({
        marin: { id },
        date_visite: new Date('2026-03-01'),
        status: 'en_cours',
      } as never);
      await ds.getRepository(Constante).save({
        visiteId: (visite as unknown as { id: number }).id,
        taille_cm: 178,
        poids_kg: 82.5,
        imc: 26.04,
        frequence_respiratoire: 16,
        albumine: 'négatif',
        diastolique: '8',
        sucre: 'négatif',
        systolique: '13',
        pouls: 72,
        temperature: 36.8,
        test_grossesse: false,
      } as never);

      const [raw] = await ds.query(`SELECT * FROM marin WHERE id = $1`, [id]);
      const rawText = JSON.stringify(raw);
      for (const secret of [
        'Diop',
        'Mamadou',
        '1988-07-14',
        '123 45 67',
        'mamadou.diop',
        'Diokoul',
        '01234',
        '0815',
      ])
        expect(rawText).not.toContain(secret);
      for (const col of [
        'nom',
        'prenom',
        'date_naissance',
        'telephone',
        'email',
        'adresse',
        'numero_cni',
        'numero_ins_mar',
        'accident_travail',
      ])
        expect(String(raw[col])).toMatch(/^enc:v2:/);
      const [c] = await ds.query(
        `SELECT * FROM constante WHERE visite_id = $1`,
        [(visite as unknown as { id: number }).id],
      );
      for (const col of [
        'taille_cm',
        'poids_kg',
        'imc',
        'pouls',
        'temperature',
        'test_grossesse',
        'systolique',
      ])
        expect(String(c[col])).toMatch(/^enc:v2:/);
    });

    it('relu dans son type d’origine (texte, nombre, booléen, date)', async () => {
      const m = await marins.findOne(id);
      expect(m).toMatchObject({
        nom: 'Diop',
        numero_ins_mar: 'DKR-2009-0815',
        accident_travail: true,
        victime_guerre: false,
      });
      expect(m.date_naissance.toISOString().slice(0, 10)).toBe('1988-07-14');
      const [c] = await ds.getRepository(Constante).find();
      expect(c).toMatchObject({
        taille_cm: 178,
        poids_kg: 82.5,
        imc: 26.04,
        pouls: 72,
        temperature: 36.8,
        test_grossesse: false,
      });
    });

    it.each([
      ['nom partiel', 'dio'],
      ['prénom', 'lamine'],
      ['NIM, autre écriture', 'dkr 2009 0815'],
      ['CNI sans espaces', '17511988 01234'],
    ])('recherche sans déchiffrer : %s', async (_l, q) => {
      expect((await marins.search(q)).map((x) => x.id)).toContain(id);
    });

    it('recherche sans rapport : rien', async () => {
      expect(await marins.search('Ndiaye')).toEqual([]);
    });

    it('NIM et CNI restent uniques (empreintes)', async () => {
      await expect(
        marins.create({
          nom: 'Autre',
          prenom: 'X',
          date_naissance: '1990-01-01',
          sexe: 'Homme',
          numero_ins_mar: 'DKR-2009-0815',
        }),
      ).rejects.toThrow(/existe déjà/);
      await expect(
        marins.findByNumeroInsMar('DKR-2009-0815'),
      ).resolves.toMatchObject({ id });
      await expect(
        marins.findByNumeroCni('1 751 1988 01234'),
      ).resolves.toMatchObject({ id });
    });

    it('les applications SIAM retrouvent le marin par NIM ou CNI (statut d’aptitude)', async () => {
      const r = await app
        .get(SiamIntegrationService)
        .fitness({ nim: 'DKR-2009-0815' }, { clientId: 'test' } as never);
      expect(r).toBeDefined();
    });

    it('rattrapage : un dossier antérieur au chiffrement est chiffré et indexé', async () => {
      await ds.query(
        `INSERT INTO marin (nom, prenom, date_naissance, sexe, numero_ins_mar, victime_guerre, accident_travail, travailleur_handicape) VALUES ('Faye', 'Ousmane', '1975-02-01 00:00:00', 'Homme', 'ZIG-1990-0042', '0', '1', '0')`,
      );
      expect(await marins.search('faye')).toEqual([]);
      const r = await app.get(MarinProtectionService).backfill();
      expect(r.marins).toBeGreaterThanOrEqual(1);
      const [raw] = await ds.query(
        `SELECT * FROM marin WHERE numero_ins_mar_index IS NOT NULL ORDER BY id DESC LIMIT 1`,
      );
      expect(JSON.stringify(raw)).not.toMatch(/Faye|Ousmane|ZIG-1990/);
      const [found] = await marins.search('faye');
      expect(found).toMatchObject({
        nom: 'Faye',
        prenom: 'Ousmane',
        accident_travail: true,
      });
      expect(await app.get(MarinProtectionService).backfill()).toEqual({
        values: 0,
        marins: 0,
      });
    });
  },
);
