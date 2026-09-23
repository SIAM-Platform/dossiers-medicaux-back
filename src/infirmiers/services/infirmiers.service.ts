/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Infirmier } from '../entities/infirmiers.entity'; 
import { CreateInfirmierDto } from '../dto/create-infirmier.dto';
import { UpdateInfirmierDto } from '../dto/update-infirmier.dto';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class InfirmiersService {
  constructor(
    @InjectRepository(Infirmier)
    private infirmierRepo: Repository<Infirmier>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<Infirmier[]> {
    return this.infirmierRepo.find();
  }

  async findOne(id: number): Promise<Infirmier> {
    const infirmier = await this.infirmierRepo.findOne({
      where: { id }
    });
    if (!infirmier) throw new NotFoundException(`Infirmier #${id} not found`);
    return infirmier;
  }

  async findByEmail(email: string): Promise<Infirmier> {
    const infirmier = await this.infirmierRepo.findOne({ where: { email } });
    if (!infirmier) throw new NotFoundException(`Infirmier with email ${email} not found`);
    return infirmier;
  }

  async create(createDto: CreateInfirmierDto): Promise<Infirmier> {
    // Vérifier que l'email existe dans la table User
    const user = await this.userRepo.findOne({ where: { email: createDto.email } });
    if (!user) {
      throw new ConflictException(`Aucun utilisateur avec l'email ${createDto.email} n'existe`);
    }

    // Vérifier que l'infirmier n'existe pas déjà (email unique)
    const existing = await this.infirmierRepo.findOne({ where: { email: createDto.email } });
    if (existing) {
      throw new ConflictException(`Un infirmier avec l'email ${createDto.email} existe déjà`);
    }

    const infirmier = this.infirmierRepo.create(createDto);
    return this.infirmierRepo.save(infirmier);
  }

  async update(id: number, updateDto: UpdateInfirmierDto): Promise<Infirmier> {
    const infirmier = await this.findOne(id);
    // Si l'email est modifié, vérifier qu'il existe dans User
    if (updateDto.email && updateDto.email !== infirmier.email) {
      const user = await this.userRepo.findOne({ where: { email: updateDto.email } });
      if (!user) {
        throw new ConflictException(`Aucun utilisateur avec l'email ${updateDto.email} n'existe`);
      }
      // Vérifier que le nouvel email n'est pas déjà utilisé par un autre infirmier
      const existing = await this.infirmierRepo.findOne({ where: { email: updateDto.email } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`L'email ${updateDto.email} est déjà utilisé par un autre infirmier`);
      }
    }
    Object.assign(infirmier, updateDto);
    return this.infirmierRepo.save(infirmier);
  }

  async remove(id: number): Promise<void> {
    const infirmier = await this.findOne(id);
    await this.infirmierRepo.remove(infirmier);
  }
}