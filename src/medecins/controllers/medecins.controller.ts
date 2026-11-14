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
import { RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('medecins')
export class MedecinsController {
  constructor(private readonly medecinsService: MedecinsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PERSONNEL_READ)
  findAll() {
    return this.medecinsService.findAll();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.medecinsService.findOne(id);
  }

  @Get('email/:email')
  @RequirePermission(PERMISSIONS.PERSONNEL_READ)
  findByEmail(@Param('email') email: string) {
    return this.medecinsService.findByEmail(email);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PERSONNEL_MANAGE)
  create(@Body() createDto: CreateMedecinDto) {
    return this.medecinsService.create(createDto);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateMedecinDto) {
    return this.medecinsService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.medecinsService.remove(id);
  }
}