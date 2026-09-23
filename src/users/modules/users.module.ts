/* eslint-disable prettier/prettier */
// src/users/modules/users.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Infirmier } from 'src/infirmiers/entities/infirmiers.entity'; 
import { Medecin } from '../../medecins/entities/medecin.entity';
import { Repository } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Infirmier, Medecin])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    const roles = ['admin', 'medecin', 'infirmier'];
    for (const name of roles) {
      const exists = await this.roleRepository.findOne({ where: { name } });
      if (!exists) {
        await this.roleRepository.save({ name });
        console.log(`✅ Rôle "${name}" créé`);
      }
    }
  }
}