/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  Request,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { KeycloakAuthGuard } from '../../auth/guards/keycloak-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateUserDto } from '../dto/create-user.dto';

@Controller('users')
@UseGuards(KeycloakAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * Récupère l'utilisateur connecté (profil local)
   */
  @Get('me')
  getMe(@Request() req) {
    return req.user?.localUser;
  }

  @Post()
  @Roles('admin','medecin')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  /**
   * Liste tous les utilisateurs
   * Accessible uniquement aux admins
   */
  @Get()
  @Roles('admin', 'medecin')
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Récupère un utilisateur par son ID
   * Accessible aux admins et aux médecins
   */
  @Get(':id')
  @Roles('admin', 'medecin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  /**
   * Récupère un utilisateur par son email
   * Accessible aux admins et aux médecins
   */
  @Get('email/:email')
  @Roles('admin', 'medecin')
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  /**
   * Récupère un utilisateur par son username
   * Accessible aux admins et aux médecins
   */
  @Get('username/:username')
  @Roles('admin', 'medecin')
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  /**
   * Met à jour les informations d'un utilisateur
   * Accessible uniquement aux admins
   */
  @Put(':id')
  @Roles('admin', 'medecin')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateUserDto) {
    return this.usersService.update(id, updateDto);
  }

  /**
   * Assigne des rôles à un utilisateur
   * Accessible uniquement aux admins
   */
  @Post('assign-roles')
  @Roles('admin', 'medecin')
  assignRoles(@Body() assignDto: AssignRoleDto) {
    return this.usersService.assignRoles(assignDto.userId, assignDto.roleNames);
  }

  /**
   * Récupère tous les rôles disponibles
   * Accessible aux admins et aux médecins
   */
  @Get('roles/available')
  @Roles('admin', 'medecin')
  getAvailableRoles() {
    return this.usersService.getAvailableRoles();
  }

  /**
   * Supprime un utilisateur
   * Accessible uniquement aux admins
   */
  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}