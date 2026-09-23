/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferentielsController } from '../controllers/referentiels.controller';
import { ReferentielsService } from '../services/referentiels.service';
import { TypeVisite } from '../entities/type-visite.entity';
import { FonctionABord } from '../entities/fonction-a-bord.entity';
import { TypeNavire } from '../entities/type-navire.entity';
import { CategorieAutoDeclaration } from '../entities/categorie-auto-declaration.entity';
import { QuestionAutoDeclaration } from '../entities/question-auto-declaration.entity';
// Import des entités de visites pour les relations
import { CommentaireCategorie } from '../../visites/entities/commentaire-categorie.entity';
import { ReponseAutoDeclaration } from '../../visites/entities/reponse-auto-declaration.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TypeVisite,
      FonctionABord,
      TypeNavire,
      CategorieAutoDeclaration,
      QuestionAutoDeclaration,
      CommentaireCategorie,   
      ReponseAutoDeclaration, 
    ]),
  ],
  providers: [ReferentielsService],
  controllers: [ReferentielsController],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}