/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medecin } from '../entities/medecin.entity';
import { CreateMedecinDto } from '../dto/create-medecin.dto';
import { UpdateMedecinDto } from '../dto/update-medecin.dto';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class MedecinsService {
  constructor(
    @InjectRepository(Medecin)
    private medecinRepo: Repository<Medecin>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<Medecin[]> {
    return this.medecinRepo.find();
  }

  async findOne(id: number): Promise<Medecin> {
    const medecin = await this.medecinRepo.findOne({
      where: { id }
    });
    if (!medecin) throw new NotFoundException(`Medecin #${id} not found`);
    return medecin;
  }

  async findByEmail(email: string): Promise<Medecin> {
    const medecin = await this.medecinRepo.findOne({ where: { email } });
    if (!medecin) throw new NotFoundException(`Medecin with email ${email} not found`);
    return medecin;
  }

  async create(createDto: CreateMedecinDto): Promise<Medecin> {
    // Vérifier que l'email existe dans la table User
    const user = await this.userRepo.findOne({ where: { email: createDto.email } });
    if (!user) {
      throw new ConflictException(`Aucun utilisateur avec l'email ${createDto.email} n'existe`);
    }

    // Vérifier que le médecin n'existe pas déjà (email unique)
    const existing = await this.medecinRepo.findOne({ where: { email: createDto.email } });
    if (existing) {
      throw new ConflictException(`Un médecin avec l'email ${createDto.email} existe déjà`);
    }

    const medecin = this.medecinRepo.create(createDto);
    return this.medecinRepo.save(medecin);
  }

  async update(id: number, updateDto: UpdateMedecinDto): Promise<Medecin> {
    const medecin = await this.findOne(id);
    if (updateDto.email && updateDto.email !== medecin.email) {
      const user = await this.userRepo.findOne({ where: { email: updateDto.email } });
      if (!user) {
        throw new ConflictException(`Aucun utilisateur avec l'email ${updateDto.email} n'existe`);
      }
      const existing = await this.medecinRepo.findOne({ where: { email: updateDto.email } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`L'email ${updateDto.email} est déjà utilisé par un autre médecin`);
      }
    }
    Object.assign(medecin, updateDto);
    return this.medecinRepo.save(medecin);
  }

  async remove(id: number): Promise<void> {
    const medecin = await this.findOne(id);
    await this.medecinRepo.remove(medecin);
  }
}