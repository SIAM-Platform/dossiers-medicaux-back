/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { VisiteMedicale } from '../visites/entities/visite-medicale.entity';
import { Marin } from '../marins/entities/marin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VisiteMedicale, Marin])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}