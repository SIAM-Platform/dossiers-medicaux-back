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
import { MedecinsService } from '../services/medecins.service';
import { CreateMedecinDto } from '../dto/create-medecin.dto';
import { UpdateMedecinDto } from '../dto/update-medecin.dto';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('medecins')
@UseGuards(KeycloakAuthGuard)
export class MedecinsController {
  constructor(private readonly medecinsService: MedecinsService) {}

  @Get()
  @Roles('admin', 'medecin')
  findAll() {
    return this.medecinsService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'medecin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.medecinsService.findOne(id);
  }

  @Get('email/:email')
  @Roles('admin', 'medecin')
  findByEmail(@Param('email') email: string) {
    return this.medecinsService.findByEmail(email);
  }

  @Post()
  @Roles('admin','medecin')
  create(@Body() createDto: CreateMedecinDto) {
    return this.medecinsService.create(createDto);
  }

  @Put(':id')
  @Roles('admin','medecin')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateMedecinDto) {
    return this.medecinsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.medecinsService.remove(id);
  }
}