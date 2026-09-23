/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitesController } from '../controllers/visites.controller';
import { VisitesService } from '../services/visites.service';
import { VisiteMedicale } from '../entities/visite-medicale.entity';
import { Marin } from '../../marins/entities/marin.entity';
import { Constante } from '../entities/constante.entity';
import { ExamenClinique } from '../entities/examen-clinique.entity';
import { Vaccination } from '../entities/vaccination.entity';
import { TestDrogue } from '../entities/test-drogue.entity';
import { ReponseAutoDeclaration } from '../entities/reponse-auto-declaration.entity';
import { CommentaireCategorie } from '../entities/commentaire-categorie.entity';
import { Certificat } from '../entities/certificat.entity';
import { ExamenComplementaire } from '../entities/examen-complementaire.entity';
import { Conclusion } from '../entities/conclusion.entity';
// Import des entités référentielles pour les relations
import { CategorieAutoDeclaration } from '../../referentiels/entities/categorie-auto-declaration.entity';
import { QuestionAutoDeclaration } from '../../referentiels/entities/question-auto-declaration.entity';
import { ReferentielsModule } from '../../referentiels/modules/referentiels.module';
import { MarinsModule } from '../../marins/modules/marins.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisiteMedicale,
      Marin,
      Constante,
      ExamenClinique,
      Vaccination,
      TestDrogue,
      ReponseAutoDeclaration,
      CommentaireCategorie,
      Certificat,
      ExamenComplementaire,
      Conclusion,
      CategorieAutoDeclaration,   
      QuestionAutoDeclaration,  
    ]),
    ReferentielsModule,
     forwardRef(() => MarinsModule),
  ],
  providers: [VisitesService],
  controllers: [VisitesController],
  exports: [VisitesService],
})
export class VisitesModule {}