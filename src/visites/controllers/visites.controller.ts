/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
  Query,
} from '@nestjs/common';
import { VisitesService } from '../services/visites.service';
import { CreateVisiteDto } from '../dto/create-visite.dto';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UpdateAutoDeclarationDto } from '../dto/update-auto-declaration.dto';
import { UpdateConstanteDto } from '../dto/update-constante.dto';
import { UpdateExamenCliniqueDto } from '../dto/update-examen-clinique.dto';
import { UpdateTestDrogueDto } from '../dto/update-test-drogue.dto';
import { UpdateVaccinationDto } from '../dto/update-vaccination.dto';
import { UpdateAutreExamenDto } from '../dto/update-autre-examen.dto';
import { UpdateRadioDto } from '../dto/update-radio.dto';
import { UpdateConclusionDto } from '../entities/update-conclusion.dto';

@Controller('visites')
@UseGuards(KeycloakAuthGuard)
export class VisitesController {
  constructor(private readonly visitesService: VisitesService) { }

  @Post()
  @Roles('admin', 'medecin', 'infirmier')
  create(@Body() createDto: CreateVisiteDto) {
    return this.visitesService.create(createDto);
  }

  @Get()
  @Roles('admin', 'medecin', 'infirmier','ci','IT')
  findAll(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ) {
    return this.visitesService.findAll(page, limit);
  }

  @Get(':id')
  @Roles('admin', 'medecin', 'infirmier')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.visitesService.findOne(id);
  }

  @Get('marin/:marinId')
  @Roles('admin', 'medecin', 'infirmier')
  findByMarin(@Param('marinId', ParseIntPipe) marinId: number) {
    return this.visitesService.findByMarin(marinId);
  }

  @Put(':id')
  @Roles('admin', 'medecin','infirmier')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<CreateVisiteDto>,
  ) {
    // Adaptez selon vos besoins
    return this.visitesService.update(id, updateData as any);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.visitesService.remove(id);
  }

  @Put(':id/constante')
  @Roles('admin', 'medecin','infirmier')
  async updateConstante(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateConstanteDto,
  ) {
    return this.visitesService.updateConstante(id, updateDto);
  }

  @Put(':id/examen-clinique')
  @Roles('admin', 'medecin','infirmier')
  async updateExamenClinique(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateExamenCliniqueDto,
  ) {
    return this.visitesService.updateExamenClinique(id, updateDto);
  }

  @Put(':id/vaccination')
  @Roles('admin', 'medecin','infirmier')
  async updateVaccination(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateVaccinationDto,
  ) {
    return this.visitesService.updateVaccination(id, updateDto);
  }

  @Put(':id/test-drogue')
  @Roles('admin', 'medecin','infirmier')
  async updateTestDrogue(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTestDrogueDto,
  ) {
    return this.visitesService.updateTestDrogue(id, updateDto);
  }

  @Put(':id/auto-declaration')
  @Roles('admin', 'medecin','infirmier')
  async updateAutoDeclaration(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutoDeclarationDto,
  ) {
    return this.visitesService.updateAutoDeclaration(id, updateDto.reponses ?? []);
  }

  @Put(':id/radio')
  @Roles('admin', 'medecin','infirmier')
  async updateRadio(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRadioDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.visitesService.updateRadio(id, updateDto);
  }

  @Put(':id/autre-examen')
  @Roles('admin', 'medecin')
  async updateAutreExamen(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutreExamenDto,
  ) {
    return this.visitesService.updateAutreExamen(id, updateDto);
  }

  @Put(':id/conclusion')
  @Roles('admin', 'medecin')
  async updateConclusion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateConclusionDto,
  ) {
    return this.visitesService.updateConclusion(id, updateDto);
  }
}