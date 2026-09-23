/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marin } from '../entities/marin.entity';
import { CreateMarinDto } from '../dto/create-marin.dto';
import { UpdateMarinDto } from '../dto/update-marin.dto';

@Injectable()
export class MarinsService {
  constructor(
    @InjectRepository(Marin)
    private marinRepo: Repository<Marin>,
  ) {}

  async findAll(): Promise<Marin[]> {
    return this.marinRepo.find({ relations: { visites: true } });
  }

  async findOne(id: number): Promise<Marin> {
    const marin = await this.marinRepo.findOne({
      where: { id },
      relations: { visites: true },
    });
    if (!marin) throw new NotFoundException(`Marin #${id} not found`);
    return marin;
  }

  async findByNumeroInsMar(numero_ins_mar: string): Promise<Marin> {
    const marin = await this.marinRepo.findOne({ where: { numero_ins_mar } });
    if (!marin) throw new NotFoundException(`Marin with numero_ins_mar ${numero_ins_mar} not found`);
    return marin;
  }

  async findByNumeroCni(numero_cni: string): Promise<Marin> {
    const marin = await this.marinRepo.findOne({ where: { numero_cni } });
    if (!marin) throw new NotFoundException(`Marin with numero_cni ${numero_cni} not found`);
    return marin;
  }

  async create(createDto: CreateMarinDto): Promise<Marin> {
    // Vérifier l'unicité du numéro d'inscription maritime s'il est fourni
    if (createDto.numero_ins_mar) {
      const existing = await this.marinRepo.findOne({
        where: { numero_ins_mar: createDto.numero_ins_mar },
      });
      if (existing) {
        throw new ConflictException(
          `Un marin avec le numéro d'inscription ${createDto.numero_ins_mar} existe déjà`,
        );
      }
    }

    // Vérifier l'unicité du CNI s'il est fourni
    if (createDto.numero_cni) {
      const existing = await this.marinRepo.findOne({
        where: { numero_cni: createDto.numero_cni },
      });
      if (existing) {
        throw new ConflictException(
          `Un marin avec le CNI ${createDto.numero_cni} existe déjà`,
        );
      }
    }

    // Convertir la date string en Date
    const data = {
      ...createDto,
      date_naissance: new Date(createDto.date_naissance),
    };

    const marin = this.marinRepo.create(data);
    return this.marinRepo.save(marin);
  }

  async update(id: number, updateDto: UpdateMarinDto): Promise<Marin> {
    const marin = await this.findOne(id);

    // Si mise à jour du numéro d'inscription, vérifier l'unicité
    if (updateDto.numero_ins_mar && updateDto.numero_ins_mar !== marin.numero_ins_mar) {
      const existing = await this.marinRepo.findOne({
        where: { numero_ins_mar: updateDto.numero_ins_mar },
      });
      if (existing) {
        throw new ConflictException(
          `Un marin avec le numéro d'inscription ${updateDto.numero_ins_mar} existe déjà`,
        );
      }
    }

    if (updateDto.numero_cni && updateDto.numero_cni !== marin.numero_cni) {
      const existing = await this.marinRepo.findOne({
        where: { numero_cni: updateDto.numero_cni },
      });
      if (existing) {
        throw new ConflictException(
          `Un marin avec le CNI ${updateDto.numero_cni} existe déjà`,
        );
      }
    }

    // Si date_naissance est fournie, la convertir
    if (updateDto.date_naissance) {
      updateDto.date_naissance = new Date(updateDto.date_naissance) as any;
    }

    Object.assign(marin, updateDto);
    return this.marinRepo.save(marin);
  }

  async remove(id: number): Promise<void> {
    const marin = await this.findOne(id);
    await this.marinRepo.remove(marin);
  }

  // Recherche par nom ou prénom (optionnel)
  async search(query: string): Promise<Marin[]> {
    return this.marinRepo
      .createQueryBuilder('marin')
      .where('marin.nom LIKE :query', { query: `%${query}%` })
      .orWhere('marin.prenom LIKE :query', { query: `%${query}%` })
      .orWhere('marin.numero_ins_mar LIKE :query', { query: `%${query}%` })
      .getMany();
  }
}