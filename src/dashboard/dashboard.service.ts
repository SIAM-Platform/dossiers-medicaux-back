/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisiteMedicale } from '../visites/entities/visite-medicale.entity';
import { Marin } from '../marins/entities/marin.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(VisiteMedicale)
    private visiteRepo: Repository<VisiteMedicale>,
    @InjectRepository(Marin)
    private marinRepo: Repository<Marin>,
  ) { }

  async getStats(dateDebut?: string, dateFin?: string, decision?: string, status?: string): Promise<any> {
    const queryBuilder = this.visiteRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.marin', 'marin')
      .leftJoinAndSelect('v.conclusion', 'conclusion');

    // Filtres
    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      queryBuilder.andWhere('v.date_visite >= :dateDebut', { dateDebut: debut });
    }
    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('v.date_visite <= :dateFin', { dateFin: fin });
    }
    if (decision && decision !== 'all') {
      queryBuilder.andWhere('conclusion.decision = :decision', { decision });
    }
    if (status && status !== 'all') {
      queryBuilder.andWhere('v.status = :status', { status });
    }

    const visites = await queryBuilder.getMany();

    // Statistiques
    const totalVisites = visites.length;
    const totalMarins = await this.marinRepo.count();

    // Visites aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const visitesAujourdhui = visites.filter(v => {
      const date = new Date(v.date_visite);
      return date >= today && date < tomorrow;
    }).length;

    //Visies d'hier
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const visitesHier = visites.filter(v => {
      const date = new Date(v.date_visite);
      return date >= yesterday && date < today; // entre hier 00:00 et aujourd'hui 00:00
    }).length;

    // Répartition des décisions
    const repartition = { apte: 0, inapte: 0, demande_examens: 0, non_renseignee: 0 };
    visites.forEach(v => {
      if (v.conclusion?.decision === 'apte') repartition.apte++;
      else if (v.conclusion?.decision === 'inapte') repartition.inapte++;
      else if (v.conclusion?.decision === 'demande_examens_complementaires') repartition.demande_examens++;
      else repartition.non_renseignee++;
    });

    const totalAvecDecision = repartition.apte + repartition.inapte + repartition.demande_examens;
    const tauxAptitude = totalAvecDecision > 0 ? (repartition.apte / totalAvecDecision) * 100 : 0;

    // Évolution 7 jours
    const evolution7Jours = this.getEvolution7Jours(visites);

    // Tendance 12 mois
    const tendance12Mois = this.getTendance12Mois(visites);

    // Types de visite
    const typesVisite = this.getTypesVisite(visites);

    return {
      totalVisites,
      totalMarins,
      visitesAujourdhui,
      visitesHier,
      tauxAptitude,
      repartitionDecisions: repartition,
      evolution7Jours,
      tendance12Mois,
      typesVisite,
    };
  }

  private getEvolution7Jours(visites: any[]) {
    const labels: string[] = [];
    const apte: number[] = [];
    const inapte: number[] = [];
    const demande: number[] = [];

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      labels.push(date.toLocaleDateString('fr-FR', options));

      const dateStr = date.toISOString().split('T')[0];
      let apteCount = 0, inapteCount = 0, demandeCount = 0;

      visites.forEach(v => {
        const visiteDate = new Date(v.date_visite).toISOString().split('T')[0];
        if (visiteDate === dateStr) {
          const decision = v.conclusion?.decision?.toLowerCase();
          if (decision === 'apte') apteCount++;
          else if (decision === 'inapte') inapteCount++;
          else if (decision === 'demande_examens_complementaires') demandeCount++;
        }
      });

      apte.push(apteCount);
      inapte.push(inapteCount);
      demande.push(demandeCount);
    }

    return { labels, apte, inapte, demande };
  }

  private getTendance12Mois(visites: any[]) {
    const mois: string[] = [];
    const aptes: number[] = [];
    const inaptes: number[] = [];
    const demandes: number[] = [];

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push(date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));

      const moisDebut = new Date(date.getFullYear(), date.getMonth(), 1);
      const moisFin = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      let aptesCount = 0, inaptesCount = 0, demandesCount = 0;
      visites.forEach(v => {
        const visiteDate = new Date(v.date_visite);
        if (visiteDate >= moisDebut && visiteDate <= moisFin) {
          const decision = v.conclusion?.decision?.toLowerCase();
          if (decision === 'apte') aptesCount++;
          else if (decision === 'inapte') inaptesCount++;
          else if (decision === 'demande_examens_complementaires') demandesCount++;
        }
      });

      aptes.push(aptesCount);
      inaptes.push(inaptesCount);
      demandes.push(demandesCount);
    }

    return { mois, aptes, inaptes, demandes };
  }

  private getTypesVisite(visites: any[]) {
    const typeMap = new Map<string, number>();
    const colors = ['#667eea', '#764ba2', '#11998e', '#38ef7d', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

    visites.forEach(v => {
      if (v.typeVisite?.libele) {
        const label = v.typeVisite.libele;
        typeMap.set(label, (typeMap.get(label) || 0) + 1);
      }
    });

    let colorIndex = 0;
    const result = Array.from(typeMap.entries()).map(([label, count]) => ({
      label,
      count,
      color: colors[colorIndex++ % colors.length],
    }));

    return result.sort((a, b) => b.count - a.count);
  }
}