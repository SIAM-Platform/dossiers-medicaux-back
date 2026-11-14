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
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { AccessService } from '../../access/access.service';

interface ActorRequest {
  user?: { permissions?: string[]; localUser?: unknown };
}
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { Authenticated, RequirePermission } from '../../access/decorators';
import { PERMISSIONS } from '../../access/permissions';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly access: AccessService,
  ) {}

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
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Request() req: ActorRequest,
  ) {
    await this.checkGrant(req, createUserDto.roles ?? [], 'Création du compte');
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateUserDto,
    @Request() req: ActorRequest,
  ) {
    await this.checkTarget(req, id, 'Modification du compte');
    return this.usersService.update(id, updateDto);
  }

  /**
   * Assigne des rôles à un utilisateur
   * Accessible uniquement aux admins
   */
  @Post('assign-roles')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  async assignRoles(
    @Body() assignDto: AssignRoleDto,
    @Request() req: ActorRequest,
  ) {
    await this.checkTarget(req, assignDto.userId, 'Attribution de rôles');
    await this.checkGrant(req, assignDto.roleNames, 'Attribution de rôles');
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
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ActorRequest,
  ) {
    await this.checkTarget(req, id, 'Suppression du compte');
    return this.usersService.remove(id);
  }

  /** Les rôles attribués ne donnent pas plus de droits que ceux de l'auteur (anti-escalade). */
  private async checkGrant(
    req: ActorRequest,
    roleNames: string[],
    what: string,
  ) {
    const granted = await this.access.permissionsOfRoleNames(roleNames);
    this.access.assertWithinOwnRights(
      req.user?.permissions ?? [],
      granted,
      what,
    );
  }

  /** Le compte visé n'a pas plus de droits que l'auteur (un médecin ne gère pas un administrateur). */
  private async checkTarget(req: ActorRequest, userId: number, what: string) {
    const target = await this.usersService.findOne(userId);
    const held = await this.access.permissionsOf(
      (target.roles ?? []).map((r) => r.id),
    );
    this.access.assertWithinOwnRights(req.user?.permissions ?? [], held, what);
  }
}
