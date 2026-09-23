/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VisiteMedicale } from '../entities/visite-medicale.entity';
import { Marin } from '../../marins/entities/marin.entity';
import { Constante } from '../entities/constante.entity';
import { ExamenClinique } from '../entities/examen-clinique.entity';
import { Vaccination } from '../entities/vaccination.entity';
import { TestDrogue } from '../entities/test-drogue.entity';
import { ReponseAutoDeclaration } from '../entities/reponse-auto-declaration.entity';
import { CreateVisiteDto } from '../dto/create-visite.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Conclusion } from '../entities/conclusion.entity';
import { UpdateConclusionDto } from '../entities/update-conclusion.dto';

@Injectable()
export class VisitesService {
  constructor(
    @InjectRepository(VisiteMedicale)
    private visiteRepo: Repository<VisiteMedicale>,
    @InjectRepository(Marin)
    private marinRepo: Repository<Marin>,
    @InjectRepository(Constante)
    private constanteRepo: Repository<Constante>,
    @InjectRepository(ExamenClinique)
    private examenCliniqueRepo: Repository<ExamenClinique>,
    @InjectRepository(Vaccination)
    private vaccinationRepo: Repository<Vaccination>,
    @InjectRepository(TestDrogue)
    private testDrogueRepo: Repository<TestDrogue>,
    @InjectRepository(ReponseAutoDeclaration)
    private reponseRepo: Repository<ReponseAutoDeclaration>,
    private dataSource: DataSource,
  ) { }

  /**
   * Crée une visite médicale complète avec toutes ses entités liées.
   */
  async create(createDto: CreateVisiteDto): Promise<VisiteMedicale> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        type_visite,
        infos,
        constantes,
        app_auditif,
        app_occulaire,
        other_app,
        vaccination,
        radio,
        autre_examen,
        toxicologie,
        auto_declaration,
      } = createDto;

      let fileUrl = '';
      if (autre_examen?.image) {
        fileUrl = await this.saveFile(autre_examen.image);
      }

      const marin = await this.createMarin(infos, queryRunner);

      const visite = await this.createVisiteMedicale(
        marin.id,
        type_visite,
        infos,
        queryRunner,
      );

      await this.createOrUpdateConstante(visite.id, constantes, queryRunner);

      await this.createOrUpdateExamenClinique(
        visite.id,
        app_auditif,
        app_occulaire,
        other_app,
        radio,
        autre_examen,
        fileUrl,
        queryRunner,
      );

      await this.createOrUpdateVaccination(visite.id, vaccination, queryRunner);

      await this.createOrUpdateTestDrogue(visite.id, toxicologie, queryRunner);

      if (auto_declaration && auto_declaration.length > 0) {
        await this.createAutoDeclarations(visite.id, auto_declaration, queryRunner);
      }

      await queryRunner.commitTransaction();

      return this.findOne(visite.id);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Erreur lors de la création: ${message}`);
    } finally {
      await queryRunner.release();
    }
  }

  // -------------------- Méthodes privées --------------------

  private async createMarin(infos: any, queryRunner: any): Promise<Marin> {
    let marin: Marin | null = null;
    if (infos.cni) {
      marin = await queryRunner.manager.findOne(Marin, {
        where: { numero_cni: infos.cni },
      });
    }
    if (!marin && infos.nim) {
      marin = await queryRunner.manager.findOne(Marin, {
        where: { numero_ins_mar: infos.nim },
      });
    }

    if (marin) {
      Object.assign(marin, {
        nom: infos.nom,
        prenom: infos.prenom,
        date_naissance: new Date(infos.date_naissance),
        lieu_naissance: infos.lieu_naissance || marin.lieu_naissance,
        sexe: infos.sexe,
        nationalite: infos.nationalite || marin.nationalite,
        telephone: infos.telephone || marin.telephone,
        email: infos.email || marin.email,
        victime_guerre: infos.victime_guerre ?? false,
        accident_travail: infos.accident_travail ?? false,
        travailleur_handicape: infos.travailleur_handicape ?? false,
        situation_matrimoniale: infos.situation_matrimoniale || marin.situation_matrimoniale,
        activites_professionnelles: infos.activites_professionnelles || marin.activites_professionnelles,
        adresse: infos.adresse || marin.adresse,
      });
      return queryRunner.manager.save(Marin, marin);
    }

    const newMarin = new Marin();
    newMarin.nom = infos.nom;
    newMarin.prenom = infos.prenom;
    newMarin.date_naissance = new Date(infos.date_naissance);
    newMarin.lieu_naissance = infos.lieu_naissance || null;
    newMarin.sexe = infos.sexe;
    newMarin.nationalite = infos.nationalite || null;
    newMarin.telephone = infos.telephone || null;
    newMarin.email = infos.email || null;
    newMarin.numero_cni = infos.cni || null;
    newMarin.numero_ins_mar = infos.nim || null;
    newMarin.victime_guerre = infos.victime_guerre ?? false;
    newMarin.accident_travail = infos.accident_travail ?? false;
    newMarin.travailleur_handicape = infos.travailleur_handicape ?? false;
    newMarin.situation_matrimoniale = infos.situation_matrimoniale || null;
    newMarin.activites_professionnelles = infos.activites_professionnelles || null;
    newMarin.adresse = infos.adresse || null;

    return queryRunner.manager.save(Marin, newMarin);
  }

  private async createVisiteMedicale(
    marinId: number,
    typeVisite: any,
    infos: any,
    queryRunner: any,
  ): Promise<VisiteMedicale> {
    const visite = new VisiteMedicale();
    visite.marinId = marinId;
    visite.date_visite = new Date();
    visite.status = 'en_cours';
    visite.numero_matricule = infos.numero_matricule || null;
    visite.reconvocation = infos.reconvocation || false;

    const toNumber = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    visite.typeVisiteId = toNumber(typeVisite.type_visite);
    visite.fonction_a_bord_id = toNumber(typeVisite.fonction_a_bord);
    visite.type_navire_id = toNumber(typeVisite.type_navire);

    return queryRunner.manager.save(VisiteMedicale, visite);
  }

  // -------------------------------------------------------------------------
  // Méthodes createOrUpdate pour chaque entité OneToOne
  // -------------------------------------------------------------------------

  private async createOrUpdateConstante(
    visiteId: number,
    constantes: any,
    queryRunner: any,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(Constante, {
      where: { visiteId },
    });

    if (existing) {
      Object.assign(existing, {
        infirmierId: constantes.infirmier_id || null,
        taille_cm: constantes.taille_cm,
        poids_kg: constantes.poids_kg,
        imc: constantes.imc,
        frequence_respiratoire: constantes.frequence_respiratoire,
        pouls: constantes.pouls || 0,
        systolique: constantes.systolique,
        diastolique: constantes.diastolique,
        albumine: constantes.glycemie_albumine,
        sucre: constantes.glycemie_sucre,
        temperature: constantes.temperature || null,
        test_grossesse: constantes.test_grossesse || false,
      });
      await queryRunner.manager.save(Constante, existing);
    } else {
      const constante = new Constante();
      constante.visiteId = visiteId;
      constante.infirmierId = constantes.infirmier_id || null;
      constante.taille_cm = constantes.taille_cm;
      constante.poids_kg = constantes.poids_kg;
      constante.imc = constantes.imc;
      constante.frequence_respiratoire = constantes.frequence_respiratoire;
      constante.pouls = constantes.pouls || 0;
      constante.systolique = constantes.systolique;
      constante.diastolique = constantes.diastolique;
      constante.albumine = constantes.glycemie_albumine;
      constante.sucre = constantes.glycemie_sucre;
      constante.temperature = constantes.temperature || null;
      constante.test_grossesse = constantes.test_grossesse || false;
      await queryRunner.manager.save(Constante, constante);
    }
  }

  private async createOrUpdateExamenClinique(
    visiteId: number,
    appAuditif: any,
    appOculaire: any,
    otherApp: any,
    radio: any,
    autreExamen: any,
    fileUrl: string,
    queryRunner: any,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(ExamenClinique, {
      where: { visiteId },
    });

    const examenData = {
      prothese: appAuditif.prothese || false,
      g_500hz: appAuditif.g_500hz || null,
      d_500hz: appAuditif.d_500hz || null,
      g_1000hz: appAuditif.g_1000hz || null,
      d_1000hz: appAuditif.d_1000hz || null,
      g_2000hz: appAuditif.g_2000hz || null,
      d_2000hz: appAuditif.d_2000hz || null,
      g_3000hz: appAuditif.g_3000hz || null,
      d_3000hz: appAuditif.d_3000hz || null,
      parole_og: appAuditif.parole_og || null,
      parole_od: appAuditif.parole_od || null,
      ch_od: appAuditif.chuchotement_od || null,
      ch_og: appAuditif.chuchotement_og || null,
      oeil_g_vp_corr: appOculaire.oeil_g_vp_corr || null,
      oeil_d_vp_corr: appOculaire.oeil_d_vp_corr || null,
      oeil_g_vl_corr: appOculaire.oeil_g_vl_corr || null,
      oeil_d_vl_corr: appOculaire.oeil_d_vl_corr || null,
      oeil_g_vp_sans_corr: appOculaire.oeil_g_vp_sans_corr || null,
      oeil_d_vp_sans_corr: appOculaire.oeil_d_vp_sans_corr || null,
      oeil_g_vl_sans_corr: appOculaire.oeil_g_vl_sans_corr || null,
      oeil_d_vl_sans_corr: appOculaire.oeil_d_vl_sans_corr || null,
      champ_visuel_oeil_d: appOculaire.champ_visuel_resultat_d || null,
      champ_visuel_oeil_g: appOculaire.champ_visuel_resultat_g || null,
      champ_visuel_oeil_d_commentaire: appOculaire.champ_visuel_commentaire_d || null,
      champ_visuel_oeil_g_commentaire: appOculaire.champ_visuel_commentaire_g || null,
      perception_couleur: appOculaire.perception_couleur || null,
      perception_couleur_commentaire: appOculaire.perception_couleur_commentaire || null,
      perception_couleur_date_examen: appOculaire.date_test_couleur || null,
      teguments: otherApp.teguments || null,
      moteur: otherApp.moteur || null,
      endocrine: otherApp.endocrine || null,
      rhino_pharynx: otherApp.rhino_pharynx || null,
      respiratoire: otherApp.respiratoire || null,
      urinaire: otherApp.urinaire || null,
      cardiovasculaire: otherApp.cardiovasculaire || null,
      genital: otherApp.genital || null,
      digestif: otherApp.digestif || null,
      systeme_nerveux: otherApp.systeme_nerveux || null,
      hematologique: otherApp.hematologique || null,
      psychisme: otherApp.psychisme || null,
      autres: otherApp.autres || null,
      radio_pul: radio.radio_pul || false,
      resultat_radio_pul: radio.resultat_radio_pul || null,
      date_radio_pul: radio.date_radio_pul ? new Date(radio.date_radio_pul) : null,
      autres_examens: autreExamen.autre_examen || autreExamen.autre_examen_autre || null,
      url_scan_autre_examen: fileUrl || null,
    };

    if (existing) {
      Object.assign(existing, examenData);
      await queryRunner.manager.save(ExamenClinique, existing);
    } else {
      const examen = new ExamenClinique();
      examen.visiteId = visiteId;
      Object.assign(examen, examenData);
      await queryRunner.manager.save(ExamenClinique, examen);
    }
  }

  private async createOrUpdateVaccination(
    visiteId: number,
    vaccinationData: any,
    queryRunner: any,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(Vaccination, {
      where: { visiteId },
    });

    if (existing) {
      Object.assign(existing, {
        fievre_jaune: vaccinationData.fievre_jaune || false,
        date_fievre_jaune: vaccinationData.date_fievre_jaune || null,
        hepatite_virale: vaccinationData.hepatite_virale || false,
        date_hepatite_virale: vaccinationData.date_hepatite_virale || null,
        tetanos: vaccinationData.tetanos || false,
        date_tetanos: vaccinationData.date_tetanos || null,
        meningite: vaccinationData.meningite || false,
        date_meningite: vaccinationData.date_meningite || null,
      });
      await queryRunner.manager.save(Vaccination, existing);
    } else {
      const vacc = queryRunner.manager.create(Vaccination, {
        visiteId: visiteId,
        fievre_jaune: vaccinationData.fievre_jaune || false,
        date_fievre_jaune: vaccinationData.date_fievre_jaune || null,
        hepatite_virale: vaccinationData.hepatite_virale || false,
        date_hepatite_virale: vaccinationData.date_hepatite_virale || null,
        tetanos: vaccinationData.tetanos || false,
        date_tetanos: vaccinationData.date_tetanos || null,
        meningite: vaccinationData.meningite || false,
        date_meningite: vaccinationData.date_meningite || null,
      });
      await queryRunner.manager.save(Vaccination, vacc);
    }
  }

  private async createOrUpdateTestDrogue(
    visiteId: number,
    toxicologie: any,
    queryRunner: any,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(TestDrogue, {
      where: { visiteId },
    });

    if (existing) {
      // Mise à jour
      Object.assign(existing, {
        benzodiazepines: toxicologie.benzodiazepines || false,
        methadone: toxicologie.methadone || false,
        phencyclidine: toxicologie.phencyclidine || false,
        cannabisTHC: toxicologie.cannabisTHC || false,
        amphetamines: toxicologie.amphetamines || false,
        methamphetamines: toxicologie.methamphetamines || false,
        barbituriques: toxicologie.barbituriques || false,
        morphineOpiaces: toxicologie.morphineOpiaces || false,
        cocaine: toxicologie.cocaine || false,
        ecstasy: toxicologie.ecstasy || false,
        alcool: toxicologie.alcool || false,
        dateAnalyse: toxicologie.dateAnalyse ? new Date(toxicologie.dateAnalyse) : null,
        laboratoire: toxicologie.laboratoire || null,
      });
      await queryRunner.manager.save(TestDrogue, existing);
    } else {
      // Insertion explicite avec new
      const test = new TestDrogue();
      test.visiteId = visiteId; // ← assignation explicite
      test.benzodiazepines = toxicologie.benzodiazepines || false;
      test.methadone = toxicologie.methadone || false;
      test.phencyclidine = toxicologie.phencyclidine || false;
      test.cannabisTHC = toxicologie.cannabisTHC || false;
      test.amphetamines = toxicologie.amphetamines || false;
      test.methamphetamines = toxicologie.methamphetamines || false;
      test.barbituriques = toxicologie.barbituriques || false;
      test.morphineOpiaces = toxicologie.morphineOpiaces || false;
      test.cocaine = toxicologie.cocaine || false;
      test.ecstasy = toxicologie.ecstasy || false;
      test.alcool = toxicologie.alcool || false;
      test.dateAnalyse = toxicologie.dateAnalyse ? new Date(toxicologie.dateAnalyse) : null;
      test.laboratoire = toxicologie.laboratoire || null;

      await queryRunner.manager.save(TestDrogue, test);
    }
  }

  private async createAutoDeclarations(
    visiteId: number,
    autoDeclarations: any[],
    queryRunner: any,
  ): Promise<void> {
    for (const item of autoDeclarations) {
      const reponse = new ReponseAutoDeclaration();
      reponse.visiteId = visiteId;
      reponse.questionId = item.question_id;
      reponse.reponse = item.reponse;
      reponse.commentaire = item.commentaire || null;
      await queryRunner.manager.save(ReponseAutoDeclaration, reponse);
    }
  }

  /**
   * Sauvegarde un fichier (base64) et retourne l'URL.
   */
  private async saveFile(base64Data: string): Promise<string> {
    if (!base64Data.startsWith('data:')) {
      throw new BadRequestException('Le fichier doit être encodé en base64');
    }

    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException('Format base64 invalide');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    let extension = 'bin';
    switch (mimeType) {
      case 'application/pdf':
        extension = 'pdf';
        break;
      case 'application/msword':
        extension = 'doc';
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        extension = 'docx';
        break;
      default:
        if (mimeType.startsWith('image/')) {
          extension = mimeType.split('/')[1];
        } else {
          throw new BadRequestException(`Type MIME non supporté: ${mimeType}`);
        }
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `file_${Date.now()}.${extension}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    const appUrl = process.env.APP_URL || 'http://localhost:3008';
    return `${appUrl}/uploads/${filename}`;
  }

  // -------------------- Méthodes de récupération --------------------

  async findAll(page: number = 1, limit: number = 10): Promise<any> {
    const skip = (page - 1) * limit;
    const [data, totalCount] = await this.visiteRepo.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' },
      relations: { marin: true, constante: true , conclusion : true},
    });

    return {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      data,
    };
  }

  async findOne(id: number): Promise<VisiteMedicale> {
    const visite = await this.visiteRepo.findOne({
      where: { id },
      relations: {
        marin: true,
        constante: true,
        examenClinique: true,
        vaccination: true,
        testDrogue: true,
        typeVisite: true,
        conclusion: true,
        fonction_a_bord: true,
        type_navire: true,
        reponsesAutoDeclaration: { question: true },
        certificats: true,
        examensComplementaires: true,
      },
    });

    if (!visite) {
      throw new NotFoundException(`Visite #${id} non trouvée`);
    }

    return visite;
  }

  async findByMarin(marinId: number): Promise<VisiteMedicale[]> {
    return this.visiteRepo.find({
      where: { marinId },
      relations: {
        marin: true,
        constante: true,
        examenClinique: true,
        vaccination: true,
        testDrogue: true,
        typeVisite: true,
        fonction_a_bord: true,
        type_navire: true
      },
      order: { date_visite: 'DESC' },
    });
  }

  async update(
    id: number,
    updateData: Partial<VisiteMedicale>,
  ): Promise<VisiteMedicale> {
    const visite = await this.findOne(id);
    Object.assign(visite, updateData);
    return this.visiteRepo.save(visite);
  }

  async remove(id: number): Promise<void> {
    const visite = await this.findOne(id);
    await this.visiteRepo.remove(visite);
  }

  // ==================== MÉTHODES DE MISE À JOUR PARTIELLES ====================

  /**
   * Met à jour les constantes médicales d'une visite
   */
  async updateConstante(visiteId: number, data: any): Promise<Constante> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.createOrUpdateConstante(visiteId, data, queryRunner);
      await queryRunner.commitTransaction();

      const constante = await queryRunner.manager.findOne(Constante, { where: { visiteId } });
      if (!constante) {
        throw new NotFoundException(`Constante pour la visite ${visiteId} non trouvée`);
      }

      return constante;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Met à jour l'examen clinique d'une visite
   */
  async updateExamenClinique(visiteId: number, data: any): Promise<ExamenClinique> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Récupérer l'existant
      const existing = await queryRunner.manager.findOne(ExamenClinique, { where: { visiteId } });
      if (!existing) {
        throw new NotFoundException(`Examen clinique pour la visite ${visiteId} non trouvé`);
      }

      // Mettre à jour uniquement les champs fournis
      Object.assign(existing, data);
      await queryRunner.manager.save(ExamenClinique, existing);
      await queryRunner.commitTransaction();

      const updatedExamenClinique = await queryRunner.manager.findOne(ExamenClinique, { where: { visiteId } });
      if (!updatedExamenClinique) {
        throw new NotFoundException(`Examen clinique pour la visite ${visiteId} non trouvé après mise à jour`);
      }

      return updatedExamenClinique;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Met à jour la vaccination d'une visite
   */
  async updateVaccination(visiteId: number, data: any): Promise<Vaccination> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Vérifier si une vaccination existe déjà
      let vaccination = await queryRunner.manager.findOne(Vaccination, { where: { visiteId } });

      if (vaccination) {
        // Mise à jour
        Object.assign(vaccination, {
          fievre_jaune: data.fievre_jaune !== undefined ? data.fievre_jaune : vaccination.fievre_jaune,
          date_fievre_jaune: data.date_fievre_jaune ? new Date(data.date_fievre_jaune) : vaccination.date_fievre_jaune,
          hepatite_virale: data.hepatite_virale !== undefined ? data.hepatite_virale : vaccination.hepatite_virale,
          date_hepatite_virale: data.date_hepatite_virale ? new Date(data.date_hepatite_virale) : vaccination.date_hepatite_virale,
          tetanos: data.tetanos !== undefined ? data.tetanos : vaccination.tetanos,
          date_tetanos: data.date_tetanos ? new Date(data.date_tetanos) : vaccination.date_tetanos,
          meningite: data.meningite !== undefined ? data.meningite : vaccination.meningite,
          date_meningite: data.date_meningite ? new Date(data.date_meningite) : vaccination.date_meningite,
        });
        await queryRunner.manager.save(Vaccination, vaccination);
      } else {
        // Création
        vaccination = new Vaccination();
        vaccination.visiteId = visiteId;
        vaccination.fievre_jaune = data.fievre_jaune || false;
        vaccination.date_fievre_jaune = data.date_fievre_jaune ? new Date(data.date_fievre_jaune) : new Date(0);
        vaccination.hepatite_virale = data.hepatite_virale || false;
        vaccination.date_hepatite_virale = data.date_hepatite_virale ? new Date(data.date_hepatite_virale) : new Date(0);
        vaccination.tetanos = data.tetanos || false;
        vaccination.date_tetanos = data.date_tetanos ? new Date(data.date_tetanos) : new Date(0);
        vaccination.meningite = data.meningite || false;
        vaccination.date_meningite = data.date_meningite ? new Date(data.date_meningite) : new Date(0);
        await queryRunner.manager.save(Vaccination, vaccination);
      }

      await queryRunner.commitTransaction();
      return vaccination;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Met à jour le test de drogue d'une visite
   */
  async updateTestDrogue(visiteId: number, data: any): Promise<TestDrogue> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(TestDrogue, { where: { visiteId } });
      if (!existing) {
        throw new NotFoundException(`Test de drogue pour la visite ${visiteId} non trouvé`);
      }

      Object.assign(existing, data);
      await queryRunner.manager.save(TestDrogue, existing);
      await queryRunner.commitTransaction();

      const updatedTestDrogue = await queryRunner.manager.findOne(TestDrogue, { where: { visiteId } });
      if (!updatedTestDrogue) {
        throw new NotFoundException(`Test de drogue pour la visite ${visiteId} non trouvé après mise à jour`);
      }

      return updatedTestDrogue;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Met à jour l'auto-déclaration : supprime les anciennes réponses et crée les nouvelles
   */
  async updateAutoDeclaration(visiteId: number, data: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Supprimer les anciennes réponses
      await queryRunner.manager.delete(ReponseAutoDeclaration, { visiteId });

      // Déterminer si data est un tableau ou un objet avec une propriété reponses
      const reponses = Array.isArray(data) ? data : (data.reponses || []);

      for (const item of reponses) {
        const reponse = new ReponseAutoDeclaration();
        reponse.visiteId = visiteId;
        reponse.questionId = item.question_id;
        reponse.reponse = item.reponse === true || item.reponse === 1 || item.reponse === 'true';
        reponse.commentaire = item.commentaire || null;
        await queryRunner.manager.save(ReponseAutoDeclaration, reponse);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateRadio(visiteId: number, data: any): Promise<ExamenClinique> {
    // Récupérer l'examen clinique existant
    const examen = await this.examenCliniqueRepo.findOne({ where: { visiteId } });
    if (!examen) {
      throw new NotFoundException(`Examen clinique pour la visite ${visiteId} non trouvé`);
    }

    // Mettre à jour uniquement les champs radio
    Object.assign(examen, {
      radio_pul: data.radio_pul !== undefined ? data.radio_pul : examen.radio_pul,
      resultat_radio_pul: data.resultat_radio_pul !== undefined ? data.resultat_radio_pul : examen.resultat_radio_pul,
      date_radio_pul: data.date_radio_pul ? new Date(data.date_radio_pul) : examen.date_radio_pul,
    });

    return this.examenCliniqueRepo.save(examen);
  }

  async updateAutreExamen(visiteId: number, data: any): Promise<ExamenClinique> {
    const examen = await this.examenCliniqueRepo.findOne({ where: { visiteId } });
    if (!examen) {
      throw new NotFoundException(`Examen clinique pour la visite ${visiteId} non trouvé`);
    }

    // Gérer le fichier image si présent
    let fileUrl = examen.url_scan_autre_examen;
    if (data.image) {
      fileUrl = await this.saveFile(data.image);
    }

    Object.assign(examen, {
      autres_examens: data.autre_examen || data.autre_examen_autre || examen.autres_examens,
      url_scan_autre_examen: fileUrl,
    });

    return this.examenCliniqueRepo.save(examen);
  }

  /**
   * Met à jour ou crée une conclusion pour une visite
   * Met également à jour le statut de la visite :
   * - 'apte' ou 'inapte' → 'terminé'
   * - 'demande_examens_complementaires' → 'attente_examens'
   */
  async updateConclusion(visiteId: number, data: UpdateConclusionDto): Promise<Conclusion> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Vérifier que la visite existe
      const visite = await queryRunner.manager.findOne(VisiteMedicale, { where: { id: visiteId } });
      if (!visite) {
        throw new NotFoundException(`Visite #${visiteId} non trouvée`);
      }

      // 2. Gérer la conclusion
      let conclusion = await queryRunner.manager.findOne(Conclusion, { where: { visiteId } });
      if (conclusion) {
        // Mise à jour
        conclusion.decision = data.decision;
        if (data.commentaires !== undefined) conclusion.commentaires = data.commentaires;
        if (data.medecin_id) conclusion.medecinId = data.medecin_id;
        if (data.date_conclusion) conclusion.date_conclusion = new Date(data.date_conclusion);
        await queryRunner.manager.save(Conclusion, conclusion);
      } else {
        // Création
        conclusion = new Conclusion();
        conclusion.visiteId = visiteId;
        conclusion.decision = data.decision;
        conclusion.medecinId = (data.medecin_id ?? null) as unknown as string;
        conclusion.date_conclusion = data.date_conclusion ? new Date(data.date_conclusion) : new Date();
        conclusion.commentaires = data.commentaires ?? '';
        await queryRunner.manager.save(Conclusion, conclusion);
      }

      // 3. Mettre à jour le statut de la visite selon la décision
      if (data.decision === 'apte' || data.decision === 'inapte') {
        visite.status = 'terminé';
      } else if (data.decision === 'demande_examens_complementaires') {
        visite.status = 'attente_examens';
      }
      // Si une autre décision est ajoutée plus tard, on pourrait ne pas changer le statut
      await queryRunner.manager.save(VisiteMedicale, visite);

      await queryRunner.commitTransaction();
      return conclusion;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}