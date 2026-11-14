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
import { MarinsService } from '../services/marins.service';
import { CreateMarinDto } from '../dto/create-marin.dto';
import { UpdateMarinDto } from '../dto/update-marin.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { VisitesService } from 'src/visites/services/visites.service';
import { RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('marins')
export class MarinsController {
  constructor(private readonly marinsService: MarinsService,private readonly visitesService: VisitesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.MARIN_LIST)
  findAll() {
    return this.marinsService.findAll();
  }

  @Get('search')
  @RequirePermission(PERMISSIONS.MARIN_READ)
  search(@Query('q') query: string) {
    return this.marinsService.search(query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.MARIN_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.marinsService.findOne(id);
  }

  @Get('numero-ins-mar/:numero_ins_mar')
  @RequirePermission(PERMISSIONS.MARIN_READ)
  findByNumeroInsMar(@Param('numero_ins_mar') numero_ins_mar: string) {
    return this.marinsService.findByNumeroInsMar(numero_ins_mar);
  }

  @Get('numero-cni/:numero_cni')
  @RequirePermission(PERMISSIONS.MARIN_READ)
  findByNumeroCni(@Param('numero_cni') numero_cni: string) {
    return this.marinsService.findByNumeroCni(numero_cni);
  }

  @Post()
  @RequirePermission(PERMISSIONS.MARIN_CREATE)
  create(@Body() createDto: CreateMarinDto) {
    return this.marinsService.create(createDto);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.MARIN_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateMarinDto) {
    return this.marinsService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.MARIN_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marinsService.remove(id);
  }

  // Endpoint public de vérification d'existence : il ne renvoie QUE le booléen.
  // (Il renvoyait la fiche complète — identité, contacts, CNI, situations sensibles —
  // sans authentification.)
  @Public()
  @Get('public/check/:numero_ins_mar')
  async checkExistence(@Param('numero_ins_mar') numero_ins_mar: string) {
    try {
      await this.marinsService.findByNumeroInsMar(numero_ins_mar);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Récupère toutes les visites d'un marin
   */
  @Get(':id/visites')
  @RequirePermission(PERMISSIONS.VISITE_READ)
  async getVisites(@Param('id', ParseIntPipe) id: number) {
    return this.visitesService.findByMarin(id);
  }
}