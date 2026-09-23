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
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('infirmiers')
@UseGuards(KeycloakAuthGuard)
export class InfirmiersController {
  constructor(private readonly infirmiersService: InfirmiersService) {}

  @Get()
  @Roles('admin', 'medecin','ci','IT')
  findAll() {
    return this.infirmiersService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'medecin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.infirmiersService.findOne(id);
  }

  @Get('email/:email')
  @Roles('admin', 'medecin')
  findByEmail(@Param('email') email: string) {
    return this.infirmiersService.findByEmail(email);
  }

  @Post()
  @Roles('admin','medecin')
  create(@Body() createDto: CreateInfirmierDto) {
    return this.infirmiersService.create(createDto);
  }

  @Put(':id')
  @Roles('admin','medecin')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateInfirmierDto) {
    return this.infirmiersService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.infirmiersService.remove(id);
  }
}