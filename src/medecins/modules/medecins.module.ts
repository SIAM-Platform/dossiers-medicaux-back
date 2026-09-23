/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedecinsController } from '../controllers/medecins.controller';
import { MedecinsService } from '../services/medecins.service';
import { Medecin } from '../entities/medecin.entity';
import { User } from '../../users/entities/user.entity';
import { Conclusion } from 'src/visites/entities/conclusion.entity';

@Module({
 imports: [TypeOrmModule.forFeature([Medecin, User, Conclusion])],
  providers: [MedecinsService],
  controllers: [MedecinsController],
  exports: [MedecinsService],
})
export class MedecinsModule {}