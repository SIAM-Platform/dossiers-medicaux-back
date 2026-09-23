/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarinsController } from '../controllers/marins.controller';
import { MarinsService } from '../services/marins.service';
import { Marin } from '../entities/marin.entity';
import { VisitesModule } from 'src/visites/modules/visites.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marin]),
    forwardRef(() => VisitesModule), 
  ],
  providers: [MarinsService], 
  controllers: [MarinsController],
  exports: [MarinsService],
})
export class MarinsModule {}