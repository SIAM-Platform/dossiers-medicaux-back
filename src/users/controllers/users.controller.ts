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
import { CreateUserDto } from '../dto/create-user.dto';
import { Authenticated, RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * Récupère l'utilisateur connecté (profil local)
   */
  @Get('me')
  @Authenticated()
  getMe(@Request() req) {
    return req.user?.localUser;
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  /**
   * Liste tous les utilisateurs
   * Accessible uniquement aux admins
   */
  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Récupère un utilisateur par son ID
   * Accessible aux admins et aux médecins
   */
  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  /**
   * Récupère un utilisateur par son email
   * Accessible aux admins et aux médecins
   */
  @Get('email/:email')
  @RequirePermission(PERMISSIONS.USER_READ)
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  /**
   * Récupère un utilisateur par son username
   * Accessible aux admins et aux médecins
   */
  @Get('username/:username')
  @RequirePermission(PERMISSIONS.USER_READ)
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  /**
   * Met à jour les informations d'un utilisateur
   * Accessible uniquement aux admins
   */
  @Put(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateUserDto) {
    return this.usersService.update(id, updateDto);
  }

  /**
   * Assigne des rôles à un utilisateur
   * Accessible uniquement aux admins
   */
  @Post('assign-roles')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignRoles(@Body() assignDto: AssignRoleDto) {
    return this.usersService.assignRoles(assignDto.userId, assignDto.roleNames);
  }

  /**
   * Récupère tous les rôles disponibles
   * Accessible aux admins et aux médecins
   */
  @Get('roles/available')
  @RequirePermission(PERMISSIONS.USER_READ)
  getAvailableRoles() {
    return this.usersService.getAvailableRoles();
  }

  /**
   * Supprime un utilisateur
   * Accessible uniquement aux admins
   */
  @Delete(':id')
  @RequirePermission(PERMISSIONS.USER_DELETE)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}