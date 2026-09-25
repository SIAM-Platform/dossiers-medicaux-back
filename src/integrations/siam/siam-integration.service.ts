/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Marin } from '../../marins/entities/marin.entity';
import { Certificat } from '../../visites/entities/certificat.entity';
import { Conclusion } from '../../visites/entities/conclusion.entity';
import { VisiteMedicale } from '../../visites/entities/visite-medicale.entity';
import { FitnessStatusDto, projectFitness, VisitFacts } from './fitness.projection';
import { SiamCaller } from './siam-integration.guard';

export interface FitnessQuery {
  nim?: string;
  cni?: string;
  patientId?: string;
}

/**
 * Consultation du statut minimal d'aptitude par les applications SIAM. Les requetes ne
 * selectionnent QUE les colonnes necessaires au calcul : aucune donnee medicale n'est lue.
 */
@Injectable()
export class SiamIntegrationService {
  private readonly logger = new Logger('SiamIntegration');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async fitness(q: FitnessQuery, caller: SiamCaller): Promise<FitnessStatusDto> {
    const nim = q.nim?.trim();
    const cni = q.cni?.trim();
    const patientId = q.patientId && /^\d{1,10}$/.test(q.patientId) ? Number(q.patientId) : null;
    if (!nim && !cni && patientId === null) throw new BadRequestException('Identifiant requis : nim, cni ou patientId');
    const marins = this.ds.getRepository(Marin);
    const found =
      (nim ? await marins.findOne({ where: { numero_ins_mar: nim }, select: { id: true } }) : null) ??
      (cni ? await marins.findOne({ where: { numero_cni: cni }, select: { id: true } }) : null) ??
      (patientId !== null ? await marins.findOne({ where: { id: patientId }, select: { id: true } }) : null);
    // Journal d'acces : application appelante et patient interne, jamais l'identifiant presente.
    if (!found) {
      this.logger.log(`aptitude consultée par ${caller.client} (${caller.via}) : marin inconnu`);
      throw new NotFoundException('Marin inconnu de DMGM');
    }
    const visits = await this.ds
      .getRepository(VisiteMedicale)
      .createQueryBuilder('v')
      .select(['v.id', 'v.date_visite', 'v.status', 'v.date_expiration'])
      .where('v.marinId = :id', { id: found.id })
      .getMany();
    const ids = visits.map((v) => v.id);
    const [conclusions, certificats] = ids.length
      ? await Promise.all([
          this.ds.getRepository(Conclusion).createQueryBuilder('c').select(['c.visiteId', 'c.decision', 'c.date_conclusion']).where('c.visiteId IN (:...ids)', { ids }).getMany(),
          this.ds
            .getRepository(Certificat)
            .createQueryBuilder('c')
            .select(['c.visiteId', 'c.type_certificat', 'c.numero_matricule', 'c.date_emission', 'c.date_expiration'])
            .where('c.visiteId IN (:...ids)', { ids })
            .getMany(),
        ])
      : [[], []];
    const facts: VisitFacts[] = visits.map((v) => {
      const c = conclusions.find((x) => x.visiteId === v.id);
      return {
        id: v.id,
        date_visite: v.date_visite,
        status: v.status,
        date_expiration: v.date_expiration ?? null,
        decision: c?.decision ?? null,
        date_conclusion: c?.date_conclusion ?? null,
        certificats: certificats.filter((x) => x.visiteId === v.id).map((x) => ({ type_certificat: x.type_certificat, numero_matricule: x.numero_matricule ?? null, date_emission: x.date_emission, date_expiration: x.date_expiration })),
      };
    });
    const result = projectFitness(facts);
    this.logger.log(`aptitude consultée par ${caller.client} (${caller.via}) : marin #${found.id} → ${result.status}`);
    return result;
  }
}
