/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfirmiersController } from '../controllers/infirmiers.controller';
import { InfirmiersService } from '../services/infirmiers.service';
import { Infirmier } from '../entities/infirmiers.entity'; 
import { User } from '../../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Infirmier, User])],
  providers: [InfirmiersService],
  controllers: [InfirmiersController],
  exports: [InfirmiersService],
})
export class InfirmiersModule {}