/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ReferentielsService } from '../services/referentiels.service';
import { TypeVisite } from '../entities/type-visite.entity';
import { FonctionABord } from '../entities/fonction-a-bord.entity';
import { TypeNavire } from '../entities/type-navire.entity';
import { CategorieAutoDeclaration } from '../entities/categorie-auto-declaration.entity';
import { QuestionAutoDeclaration } from '../entities/question-auto-declaration.entity';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('referentiels')
@UseGuards(KeycloakAuthGuard)
export class ReferentielsController {
  constructor(private readonly referentielsService: ReferentielsService) { }

  // ==================== TypeVisite ====================
  @Get('type-visites')
  @Roles('admin', 'medecin', 'infirmier')
  findAllTypeVisites() {
    return this.referentielsService.findAllTypeVisites();
  }

  @Get('type-visites/:id')
  @Roles('admin', 'medecin', 'infirmier')
  findOneTypeVisite(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneTypeVisite(id);
  }

  @Post('type-visites')
  @Roles('admin', 'medecin')
  createTypeVisite(@Body() data: Partial<TypeVisite>) {
    return this.referentielsService.createTypeVisite(data);
  }

  @Put('type-visites/:id')
  @Roles('admin', 'medecin')
  updateTypeVisite(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<TypeVisite>,
  ) {
    return this.referentielsService.updateTypeVisite(id, data);
  }

  @Delete('type-visites/:id')
  @Roles('admin')
  removeTypeVisite(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeTypeVisite(id);
  }

  // ==================== FonctionABord ====================
  @Get('fonctions')
  @Roles('admin', 'medecin', 'infirmier')
  findAllFonctions() {
    return this.referentielsService.findAllFonctions();
  }

  @Get('fonctions/:id')
  @Roles('admin', 'medecin', 'infirmier')
  findOneFonction(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneFonction(id);
  }

  @Post('fonctions')
  @Roles('admin', 'medecin')
  createFonction(@Body() data: Partial<FonctionABord>) {
    return this.referentielsService.createFonction(data);
  }

  @Put('fonctions/:id')
  @Roles('admin', 'medecin')
  updateFonction(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<FonctionABord>,
  ) {
    return this.referentielsService.updateFonction(id, data);
  }

  @Delete('fonctions/:id')
  @Roles('admin')
  removeFonction(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeFonction(id);
  }

  // ==================== TypeNavire ====================
  @Get('type-navires')
  @Roles('admin', 'medecin', 'infirmier')
  findAllTypeNavires() {
    return this.referentielsService.findAllTypeNavires();
  }

  @Get('type-navires/:id')
  @Roles('admin', 'medecin', 'infirmier')
  findOneTypeNavire(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneTypeNavire(id);
  }

  @Post('type-navires')
  @Roles('admin', 'medecin')
  createTypeNavire(@Body() data: Partial<TypeNavire>) {
    return this.referentielsService.createTypeNavire(data);
  }

  @Put('type-navires/:id')
  @Roles('admin', 'medecin')
  updateTypeNavire(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<TypeNavire>,
  ) {
    return this.referentielsService.updateTypeNavire(id, data);
  }

  @Delete('type-navires/:id')
  @Roles('admin')
  removeTypeNavire(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeTypeNavire(id);
  }

  // ==================== CategorieAutoDeclaration ====================
  @Get('categories-auto-declaration')
  @Roles('admin', 'medecin', 'infirmier')
  findAllCategories() {
    return this.referentielsService.findAllCategories();
  }

  @Get('categories-auto-declaration/:id')
  @Roles('admin', 'medecin', 'infirmier')
  findOneCategorie(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneCategorie(id);
  }

  @Post('categories-auto-declaration')
  @Roles('admin', 'medecin')
  createCategorie(@Body() data: Partial<CategorieAutoDeclaration>) {
    return this.referentielsService.createCategorie(data);
  }

  @Put('categories-auto-declaration/:id')
  @Roles('admin', 'medecin')
  updateCategorie(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<CategorieAutoDeclaration>,
  ) {
    return this.referentielsService.updateCategorie(id, data);
  }

  @Delete('categories-auto-declaration/:id')
  @Roles('admin')
  removeCategorie(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeCategorie(id);
  }

  // ==================== QuestionAutoDeclaration ====================
  @Get('questions-auto-declaration')
  @Roles('admin', 'medecin', 'infirmier')
  findAllQuestions() {
    return this.referentielsService.findAllQuestions();
  }

  @Get('questions-auto-declaration/:id')
  @Roles('admin', 'medecin', 'infirmier')
  findOneQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneQuestion(id);
  }

  @Get('questions-auto-declaration/by-categorie/:categorieId')
  @Roles('admin', 'medecin', 'infirmier')
  findQuestionsByCategorie(@Param('categorieId', ParseIntPipe) categorieId: number) {
    return this.referentielsService.findQuestionsByCategorie(categorieId);
  }

  @Post('questions-auto-declaration')
  @Roles('admin', 'medecin')
  createQuestion(@Body() data: Partial<QuestionAutoDeclaration>) {
    return this.referentielsService.createQuestion(data);
  }

  @Put('questions-auto-declaration/:id')
  @Roles('admin', 'medecin')
  updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<QuestionAutoDeclaration>,
  ) {
    return this.referentielsService.updateQuestion(id, data);
  }

  @Delete('questions-auto-declaration/:id')
  @Roles('admin')
  removeQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeQuestion(id);
  }
}