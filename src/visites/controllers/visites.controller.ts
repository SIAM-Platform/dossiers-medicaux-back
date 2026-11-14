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
  DefaultValuePipe,
  Query,
} from '@nestjs/common';
import { VisitesService } from '../services/visites.service';
import { CreateVisiteDto } from '../dto/create-visite.dto';
import { UpdateAutoDeclarationDto } from '../dto/update-auto-declaration.dto';
import { UpdateConstanteDto } from '../dto/update-constante.dto';
import { UpdateExamenCliniqueDto } from '../dto/update-examen-clinique.dto';
import { UpdateTestDrogueDto } from '../dto/update-test-drogue.dto';
import { UpdateVaccinationDto } from '../dto/update-vaccination.dto';
import { UpdateAutreExamenDto } from '../dto/update-autre-examen.dto';
import { UpdateRadioDto } from '../dto/update-radio.dto';
import { UpdateConclusionDto } from '../entities/update-conclusion.dto';
import { RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('visites')
export class VisitesController {
  constructor(private readonly visitesService: VisitesService) { }

  @Post()
  @RequirePermission(PERMISSIONS.VISITE_CREATE)
  create(@Body() createDto: CreateVisiteDto) {
    return this.visitesService.create(createDto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.VISITE_LIST)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.visitesService.findAll(page, limit);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.VISITE_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.visitesService.findOne(id);
  }

  @Get('marin/:marinId')
  @RequirePermission(PERMISSIONS.VISITE_READ)
  findByMarin(@Param('marinId', ParseIntPipe) marinId: number) {
    return this.visitesService.findByMarin(marinId);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<CreateVisiteDto>,
  ) {
    // Adaptez selon vos besoins
    return this.visitesService.update(id, updateData as any);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.VISITE_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.visitesService.remove(id);
  }

  @Put(':id/constante')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateConstante(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateConstanteDto,
  ) {
    return this.visitesService.updateConstante(id, updateDto);
  }

  @Put(':id/examen-clinique')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateExamenClinique(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateExamenCliniqueDto,
  ) {
    return this.visitesService.updateExamenClinique(id, updateDto);
  }

  @Put(':id/vaccination')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateVaccination(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateVaccinationDto,
  ) {
    return this.visitesService.updateVaccination(id, updateDto);
  }

  @Put(':id/test-drogue')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateTestDrogue(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTestDrogueDto,
  ) {
    return this.visitesService.updateTestDrogue(id, updateDto);
  }

  @Put(':id/auto-declaration')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateAutoDeclaration(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutoDeclarationDto,
  ) {
    return this.visitesService.updateAutoDeclaration(id, updateDto.reponses ?? []);
  }

  @Put(':id/radio')
  @RequirePermission(PERMISSIONS.VISITE_UPDATE)
  async updateRadio(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRadioDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.visitesService.updateRadio(id, updateDto);
  }

  @Put(':id/autre-examen')
  @RequirePermission(PERMISSIONS.VISITE_OTHER_EXAM)
  async updateAutreExamen(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutreExamenDto,
  ) {
    return this.visitesService.updateAutreExamen(id, updateDto);
  }

  @Put(':id/conclusion')
  @RequirePermission(PERMISSIONS.VISITE_CONCLUDE)
  async updateConclusion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateConclusionDto,
  ) {
    return this.visitesService.updateConclusion(id, updateDto);
  }
}