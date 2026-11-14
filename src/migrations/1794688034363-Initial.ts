import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1794688034363 implements MigrationInterface {
  name = 'Initial1794688034363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "infirmier" ("id" SERIAL NOT NULL, "nom" character varying(191) NOT NULL, "prenom" character varying(191) NOT NULL, "email" character varying(191) NOT NULL, CONSTRAINT "UQ_59df8d97c06a6c9a740d3305d9a" UNIQUE ("email"), CONSTRAINT "PK_c3a4105542b7c2f8bce2244a8a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "typevisite" ("id_type" SERIAL NOT NULL, "libele" character varying(191) NOT NULL, CONSTRAINT "PK_14ee7087d04d7fc3611c5c4d948" PRIMARY KEY ("id_type"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "constante" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "infirmier_id" character varying(191), "taille_cm" text, "poids_kg" text, "imc" text, "frequence_respiratoire" text, "date_prise" TIMESTAMP NOT NULL DEFAULT now(), "albumine" text, "diastolique" text, "sucre" text, "systolique" text, "pouls" text, "temperature" text, "test_grossesse" text, CONSTRAINT "REL_0fc25cb1a3faa5ca31da6bb50a" UNIQUE ("visite_id"), CONSTRAINT "PK_07af35c6dfdf81dd160737a0d4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "examenclinique" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "medecin_id" character varying(191), "prothese" text, "oeil_g_vp_corr" text, "oeil_d_vp_corr" text, "oeil_g_vl_corr" text, "oeil_d_vl_corr" text, "oeil_g_vp_sans_corr" text, "oeil_d_vp_sans_corr" text, "oeil_g_vl_sans_corr" text, "oeil_d_vl_sans_corr" text, "perception_couleur" text, "perception_couleur_commentaire" text, "teguments" text, "moteur" text, "endocrine" text, "rhino_pharynx" text, "respiratoire" text, "urinaire" text, "cardiovasculaire" text, "genital" text, "digestif" text, "systeme_nerveux" text, "hematologique" text, "psychisme" text, "date_examen" TIMESTAMP NOT NULL DEFAULT now(), "autres_examens" text, "ch_od" text, "ch_og" text, "champ_visuel_oeil_d" text, "champ_visuel_oeil_g" text, "date_radio_pul" text, "parole_od" text, "parole_og" text, "radio_pul" text, "resultat_autres_examens" text, "resultat_radio_pul" text, "cardiovasculaire_commentaire" text, "digestif_commentaire" text, "endocrine_commentaire" text, "genital_commentaire" text, "hematologique_commentaire" text, "moteur_commentaire" text, "psychisme_commentaire" text, "respiratoire_commentaire" text, "rhino_pharynx_commentaire" text, "systeme_nerveux_commentaire" text, "teguments_commentaire" text, "urinaire_commentaire" text, "autres" text, "autres_commentaire" text, "champ_visuel_oeil_d_commentaire" text, "champ_visuel_oeil_g_commentaire" text, "d_1000hz" text, "d_2000hz" text, "d_3000hz" text, "d_500hz" text, "g_1000hz" text, "g_2000hz" text, "g_3000hz" text, "g_500hz" text, "perception_couleur_date_examen" text, "url_scan_autre_examen" text, CONSTRAINT "REL_9071ac24a42db6cf5ddfc0903d" UNIQUE ("visite_id"), CONSTRAINT "PK_ba7ceba0ca6b48d408e7ce36a4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conclusion_decision_enum" AS ENUM('demande_examens_complementaires', 'apte', 'inapte')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conclusion" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "medecin_id" character varying(191), "decision" "public"."conclusion_decision_enum" NOT NULL, "commentaires" text, "date_conclusion" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_2d59618e639121b28118b57593" UNIQUE ("visite_id"), CONSTRAINT "PK_7b3240c7efffcd60656c23550af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "vaccination" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "fievre_jaune" text, "hepatite_virale" text, "tetanos" text, "meningite" text, "date_fievre_jaune" text, "date_hepatite_virale" text, "date_meningite" text, "date_tetanos" text, CONSTRAINT "REL_608ad7a9fb470383db576b62dd" UNIQUE ("visite_id"), CONSTRAINT "PK_bcf2c2e82bfb8f6e07c1d038b58" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "test_drogue" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "benzodiazepines" text, "methadone" text, "phencyclidine" text, "cannabisTHC" text, "amphetamines" text, "methamphetamines" text, "barbituriques" text, "morphineOpiaces" text, "cocaine" text, "ecstasy" text, "alcool" text, "dateAnalyse" text, "laboratoire" text, CONSTRAINT "REL_bf481fac871a9b425e25737a47" UNIQUE ("visite_id"), CONSTRAINT "PK_5cbfdbe17000e64a7543d8aa2be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "commentairecategorie" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "categorie_id" integer NOT NULL, "commentaire" text, CONSTRAINT "PK_f8381ecf334b9e321044fd89a07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "categorieautodeclaration" ("id" SERIAL NOT NULL, "nom" character varying(191) NOT NULL, CONSTRAINT "PK_61d1b363395c708f2c365b4b0ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "questionautodeclaration" ("id" SERIAL NOT NULL, "libelle" character varying(191) NOT NULL, "categorie_id" integer NOT NULL, CONSTRAINT "PK_3793dbe2197d029c2e98270c9de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reponseautodeclaration" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "question_id" integer NOT NULL, "reponse" text, "commentaire" text, CONSTRAINT "PK_ad3d0e465d258604b1348cf3469" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."certificat_type_certificat_enum" AS ENUM('aptitude_physique', 'aptitude_aller_en_mer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "certificat" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "type_certificat" "public"."certificat_type_certificat_enum" NOT NULL, "url_pdf" character varying(191) NOT NULL, "date_emission" TIMESTAMP NOT NULL, "date_expiration" TIMESTAMP NOT NULL, "numero_matricule" character varying(191), CONSTRAINT "PK_dd13c790cff3864fd93a5fe5aaf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "examcomplementaire" ("id" SERIAL NOT NULL, "visite_id" integer NOT NULL, "type_exam" text, "resultat" text, "date_examen" TIMESTAMP, CONSTRAINT "PK_24304de26bed5d476c0fa004300" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "fonction_a_bord" ("id" SERIAL NOT NULL, "libele" character varying(191) NOT NULL, CONSTRAINT "PK_95275ad23fa1c1f0240b172120a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "typenavire" ("id" SERIAL NOT NULL, "libele" character varying(191) NOT NULL, CONSTRAINT "PK_94d5c5221deeced2ea2e8cdd998" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."visitemedicale_status_enum" AS ENUM('en_cours', 'attente_examens', 'terminé')`,
    );
    await queryRunner.query(
      `CREATE TABLE "visitemedicale" ("id" SERIAL NOT NULL, "marin_id" integer NOT NULL, "date_visite" TIMESTAMP NOT NULL, "status" "public"."visitemedicale_status_enum" NOT NULL, "date_expiration" TIMESTAMP, "numero_matricule" character varying(191), "reconvocation" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "type_visiteid_type" integer, "fonction_a_bord_id" integer, "type_navire_id" integer, CONSTRAINT "PK_6f29fcdb2e34326bcd209992f8c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."marin_sexe_enum" AS ENUM('Homme', 'Femme')`,
    );
    await queryRunner.query(
      `CREATE TABLE "marin" ("id" SERIAL NOT NULL, "nom" text, "prenom" text, "date_naissance" text, "sexe" "public"."marin_sexe_enum" NOT NULL, "nationalite" character varying, "telephone" text, "email" text, "date_creation" TIMESTAMP NOT NULL DEFAULT now(), "victime_guerre" text, "accident_travail" text, "travailleur_handicape" text, "situation_matrimoniale" text, "activites_professionnelles" text, "adresse" text, "numero_cni" text, "numero_ins_mar" text, "lieu_naissance" text, "numero_ins_mar_index" character varying(22), "numero_cni_index" character varying(22), "nom_index" text, CONSTRAINT "PK_3b23648b40b19fa9e80df042af6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_marin_numero_ins_mar_index" ON "marin"  ("numero_ins_mar_index") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_marin_numero_cni_index" ON "marin"  ("numero_cni_index") `,
    );
    await queryRunner.query(
      `CREATE TABLE "medecin" ("id" SERIAL NOT NULL, "nom" character varying(191) NOT NULL, "prenom" character varying(191) NOT NULL, "email" character varying(191) NOT NULL, CONSTRAINT "UQ_697b29494b1d8925f2c1b3feda0" UNIQUE ("email"), CONSTRAINT "PK_63e21a668ce1ac0b1e32bb8edd8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "firstName" character varying, "lastName" character varying, "keycloakId" character varying, CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles_role" ("userId" integer NOT NULL, "roleId" integer NOT NULL, CONSTRAINT "PK_b47cd6c84ee205ac5a713718292" PRIMARY KEY ("userId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f9286e6c25594c6b88c108db7" ON "user_roles_role"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4be2f7adf862634f5f803d246b" ON "user_roles_role"  ("roleId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "constante" ADD CONSTRAINT "FK_0fc25cb1a3faa5ca31da6bb50ac" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "examenclinique" ADD CONSTRAINT "FK_9071ac24a42db6cf5ddfc0903d4" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conclusion" ADD CONSTRAINT "FK_2d59618e639121b28118b57593f" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vaccination" ADD CONSTRAINT "FK_608ad7a9fb470383db576b62dd0" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_drogue" ADD CONSTRAINT "FK_bf481fac871a9b425e25737a477" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commentairecategorie" ADD CONSTRAINT "FK_7c9c6b40057a58a4bd07dc13c5a" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commentairecategorie" ADD CONSTRAINT "FK_fc182cdf260815d439dae07e7b9" FOREIGN KEY ("categorie_id") REFERENCES "categorieautodeclaration"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "questionautodeclaration" ADD CONSTRAINT "FK_c84f52c99503a0e1c323d07b54b" FOREIGN KEY ("categorie_id") REFERENCES "categorieautodeclaration"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reponseautodeclaration" ADD CONSTRAINT "FK_33c69764856f90b049623a773e7" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reponseautodeclaration" ADD CONSTRAINT "FK_1101c217264c6ce70367b2b5bb7" FOREIGN KEY ("question_id") REFERENCES "questionautodeclaration"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificat" ADD CONSTRAINT "FK_8f68f57e942235e59ef36f62f7c" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "examcomplementaire" ADD CONSTRAINT "FK_d69364bfa47118c0dc5cad3b0c3" FOREIGN KEY ("visite_id") REFERENCES "visitemedicale"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" ADD CONSTRAINT "FK_cff762b09aee0f07b5efa566412" FOREIGN KEY ("marin_id") REFERENCES "marin"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" ADD CONSTRAINT "FK_b0eea297492cf88e323b5139fd4" FOREIGN KEY ("type_visiteid_type") REFERENCES "typevisite"("id_type") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" ADD CONSTRAINT "FK_86874221a17618371b5e61996f1" FOREIGN KEY ("fonction_a_bord_id") REFERENCES "fonction_a_bord"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" ADD CONSTRAINT "FK_ac62d61f3ce1f015c56a66f7e15" FOREIGN KEY ("type_navire_id") REFERENCES "typenavire"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles_role" ADD CONSTRAINT "FK_5f9286e6c25594c6b88c108db77" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles_role" ADD CONSTRAINT "FK_4be2f7adf862634f5f803d246b8" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_roles_role" DROP CONSTRAINT "FK_4be2f7adf862634f5f803d246b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles_role" DROP CONSTRAINT "FK_5f9286e6c25594c6b88c108db77"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" DROP CONSTRAINT "FK_ac62d61f3ce1f015c56a66f7e15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" DROP CONSTRAINT "FK_86874221a17618371b5e61996f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" DROP CONSTRAINT "FK_b0eea297492cf88e323b5139fd4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitemedicale" DROP CONSTRAINT "FK_cff762b09aee0f07b5efa566412"`,
    );
    await queryRunner.query(
      `ALTER TABLE "examcomplementaire" DROP CONSTRAINT "FK_d69364bfa47118c0dc5cad3b0c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificat" DROP CONSTRAINT "FK_8f68f57e942235e59ef36f62f7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reponseautodeclaration" DROP CONSTRAINT "FK_1101c217264c6ce70367b2b5bb7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reponseautodeclaration" DROP CONSTRAINT "FK_33c69764856f90b049623a773e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "questionautodeclaration" DROP CONSTRAINT "FK_c84f52c99503a0e1c323d07b54b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commentairecategorie" DROP CONSTRAINT "FK_fc182cdf260815d439dae07e7b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commentairecategorie" DROP CONSTRAINT "FK_7c9c6b40057a58a4bd07dc13c5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_drogue" DROP CONSTRAINT "FK_bf481fac871a9b425e25737a477"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vaccination" DROP CONSTRAINT "FK_608ad7a9fb470383db576b62dd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conclusion" DROP CONSTRAINT "FK_2d59618e639121b28118b57593f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "examenclinique" DROP CONSTRAINT "FK_9071ac24a42db6cf5ddfc0903d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "constante" DROP CONSTRAINT "FK_0fc25cb1a3faa5ca31da6bb50ac"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4be2f7adf862634f5f803d246b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f9286e6c25594c6b88c108db7"`,
    );
    await queryRunner.query(`DROP TABLE "user_roles_role"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "medecin"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_marin_numero_cni_index"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_marin_numero_ins_mar_index"`,
    );
    await queryRunner.query(`DROP TABLE "marin"`);
    await queryRunner.query(`DROP TYPE "public"."marin_sexe_enum"`);
    await queryRunner.query(`DROP TABLE "visitemedicale"`);
    await queryRunner.query(`DROP TYPE "public"."visitemedicale_status_enum"`);
    await queryRunner.query(`DROP TABLE "typenavire"`);
    await queryRunner.query(`DROP TABLE "fonction_a_bord"`);
    await queryRunner.query(`DROP TABLE "examcomplementaire"`);
    await queryRunner.query(`DROP TABLE "certificat"`);
    await queryRunner.query(
      `DROP TYPE "public"."certificat_type_certificat_enum"`,
    );
    await queryRunner.query(`DROP TABLE "reponseautodeclaration"`);
    await queryRunner.query(`DROP TABLE "questionautodeclaration"`);
    await queryRunner.query(`DROP TABLE "categorieautodeclaration"`);
    await queryRunner.query(`DROP TABLE "commentairecategorie"`);
    await queryRunner.query(`DROP TABLE "test_drogue"`);
    await queryRunner.query(`DROP TABLE "vaccination"`);
    await queryRunner.query(`DROP TABLE "conclusion"`);
    await queryRunner.query(`DROP TYPE "public"."conclusion_decision_enum"`);
    await queryRunner.query(`DROP TABLE "examenclinique"`);
    await queryRunner.query(`DROP TABLE "constante"`);
    await queryRunner.query(`DROP TABLE "typevisite"`);
    await queryRunner.query(`DROP TABLE "infirmier"`);
  }
}
