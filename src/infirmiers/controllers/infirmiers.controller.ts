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
import { InfirmiersService } from '../services/infirmiers.service';
import { CreateInfirmierDto } from '../dto/create-infirmier.dto';
import { UpdateInfirmierDto } from '../dto/update-infirmier.dto';
import { RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('infirmiers')
export class InfirmiersController {
  constructor(private readonly infirmiersService: InfirmiersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INFIRMIER_LIST)
  findAll() {
    return this.infirmiersService.findAll();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infirmiersService.findOne(id);
  }

  @Get('email/:email')
  @RequirePermission(PERMISSIONS.PERSONNEL_READ)
  findByEmail(@Param('email') email: string) {
    return this.infirmiersService.findByEmail(email);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PERSONNEL_MANAGE)
  create(@Body() createDto: CreateInfirmierDto) {
    return this.infirmiersService.create(createDto);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateInfirmierDto) {
    return this.infirmiersService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PERSONNEL_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.infirmiersService.remove(id);
  }
}