/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ReferentielsService } from '../services/referentiels.service';
import { CategorieDto, LibeleDto, QuestionDto } from '../dto/referentiel.dto';
import { RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('referentiels')
export class ReferentielsController {
  constructor(private readonly referentielsService: ReferentielsService) { }

  // ==================== TypeVisite ====================
  @Get('type-visites')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findAllTypeVisites() {
    return this.referentielsService.findAllTypeVisites();
  }

  @Get('type-visites/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findOneTypeVisite(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneTypeVisite(id);
  }

  @Post('type-visites')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  createTypeVisite(@Body() dto: LibeleDto) {
    return this.referentielsService.createTypeVisite({ libele: dto.libele });
  }

  @Put('type-visites/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  updateTypeVisite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LibeleDto,
  ) {
    return this.referentielsService.updateTypeVisite(id, { libele: dto.libele });
  }

  @Delete('type-visites/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_DELETE)
  removeTypeVisite(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeTypeVisite(id);
  }

  // ==================== FonctionABord ====================
  @Get('fonctions')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findAllFonctions() {
    return this.referentielsService.findAllFonctions();
  }

  @Get('fonctions/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findOneFonction(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneFonction(id);
  }

  @Post('fonctions')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  createFonction(@Body() dto: LibeleDto) {
    return this.referentielsService.createFonction({ libele: dto.libele });
  }

  @Put('fonctions/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  updateFonction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LibeleDto,
  ) {
    return this.referentielsService.updateFonction(id, { libele: dto.libele });
  }

  @Delete('fonctions/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_DELETE)
  removeFonction(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeFonction(id);
  }

  // ==================== TypeNavire ====================
  @Get('type-navires')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findAllTypeNavires() {
    return this.referentielsService.findAllTypeNavires();
  }

  @Get('type-navires/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findOneTypeNavire(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneTypeNavire(id);
  }

  @Post('type-navires')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  createTypeNavire(@Body() dto: LibeleDto) {
    return this.referentielsService.createTypeNavire({ libele: dto.libele });
  }

  @Put('type-navires/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  updateTypeNavire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LibeleDto,
  ) {
    return this.referentielsService.updateTypeNavire(id, { libele: dto.libele });
  }

  @Delete('type-navires/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_DELETE)
  removeTypeNavire(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeTypeNavire(id);
  }

  // ==================== CategorieAutoDeclaration ====================
  @Get('categories-auto-declaration')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findAllCategories() {
    return this.referentielsService.findAllCategories();
  }

  @Get('categories-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findOneCategorie(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneCategorie(id);
  }

  @Post('categories-auto-declaration')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  createCategorie(@Body() dto: CategorieDto) {
    return this.referentielsService.createCategorie({ nom: dto.nom });
  }

  @Put('categories-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  updateCategorie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CategorieDto,
  ) {
    return this.referentielsService.updateCategorie(id, { nom: dto.nom });
  }

  @Delete('categories-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_DELETE)
  removeCategorie(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeCategorie(id);
  }

  // ==================== QuestionAutoDeclaration ====================
  @Get('questions-auto-declaration')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findAllQuestions() {
    return this.referentielsService.findAllQuestions();
  }

  @Get('questions-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findOneQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.findOneQuestion(id);
  }

  @Get('questions-auto-declaration/by-categorie/:categorieId')
  @RequirePermission(PERMISSIONS.REFERENTIEL_READ)
  findQuestionsByCategorie(@Param('categorieId', ParseIntPipe) categorieId: number) {
    return this.referentielsService.findQuestionsByCategorie(categorieId);
  }

  @Post('questions-auto-declaration')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  createQuestion(@Body() dto: QuestionDto) {
    return this.referentielsService.createQuestion({ libelle: dto.libelle, categorieId: dto.categorieId });
  }

  @Put('questions-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_EDIT)
  updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuestionDto,
  ) {
    return this.referentielsService.updateQuestion(id, { libelle: dto.libelle, categorieId: dto.categorieId });
  }

  @Delete('questions-auto-declaration/:id')
  @RequirePermission(PERMISSIONS.REFERENTIEL_DELETE)
  removeQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.referentielsService.removeQuestion(id);
  }
}