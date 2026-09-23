/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { Infirmier } from 'src/infirmiers/entities/infirmiers.entity';
import { Medecin } from 'src/medecins/entities/medecin.entity';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Infirmier)
    private infirmierRepo: Repository<Infirmier>,
    @InjectRepository(Medecin)
    private medecinRepo: Repository<Medecin>,
  ) { }

  /**
   * Récupère un utilisateur existant à partir de ses données Keycloak.
   * Ne crée pas d'utilisateur s'il n'existe pas.
   * @throws NotFoundException si l'utilisateur n'existe pas
   */
  async findFromKeycloak(keycloakUser: any): Promise<User> {
    const email = keycloakUser.email;
    const user = await this.userRepository.findOne({
      where: { email },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`Aucun utilisateur trouvé avec l'email ${email}`);
    }
    // Mettre à jour les informations si elles ont changé (nom, prénom, etc.)
    let needsUpdate = false;
    if (keycloakUser.firstName && user.firstName !== keycloakUser.firstName) {
      user.firstName = keycloakUser.firstName;
      needsUpdate = true;
    }
    if (keycloakUser.lastName && user.lastName !== keycloakUser.lastName) {
      user.lastName = keycloakUser.lastName;
      needsUpdate = true;
    }
    if (keycloakUser.email && user.email !== keycloakUser.email) {
      user.email = keycloakUser.email;
      needsUpdate = true;
    }
    if (needsUpdate) {
      await this.userRepository.save(user);
    }
    return user;
  }

  /**
   * Crée ou met à jour le profil Infirmier associé à l'utilisateur.
   */
  private async createOrUpdateInfirmier(user: User): Promise<void> {
    const existing = await this.infirmierRepo.findOne({
      where: { email: user.email }
    });

    if (existing) {
      // Mettre à jour les infos si elles ont changé
      if (existing.nom !== user.lastName || existing.prenom !== user.firstName) {
        existing.nom = user.lastName || '';
        existing.prenom = user.firstName || '';
        await this.infirmierRepo.save(existing);
      }
    } else {
      const infirmier = this.infirmierRepo.create({
        nom: user.lastName || '',
        prenom: user.firstName || '',
        email: user.email,
      });
      await this.infirmierRepo.save(infirmier);
    }
  }
  /**
   * Récupère tous les utilisateurs avec leurs rôles
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: { roles: true },
      order: { username: 'ASC' },
    });
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} non trouvé`);
    }
    return user;
  }

  /**
   * Récupère un utilisateur par son username
   */
  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur ${username} non trouvé`);
    }
    return user;
  }

  /**
   * Récupère un utilisateur par son email
   */
  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'email ${email} non trouvé`);
    }
    return user;
  }

  /**
   * Met à jour les informations d'un utilisateur
   */
  async update(id: number, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateDto.email && updateDto.email !== user.email) {
      // Vérifier que l'email n'est pas déjà utilisé
      const existing = await this.userRepository.findOne({
        where: { email: updateDto.email }
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`L'email ${updateDto.email} est déjà utilisé`);
      }
    }

    Object.assign(user, updateDto);
    return this.userRepository.save(user);
  }

  /**
   * Assigne des rôles à un utilisateur
   */
  async assignRoles(userId: number, roleNames: string[]): Promise<User> {
    const user = await this.findOne(userId);

    // Récupérer les rôles correspondant aux noms
    const roles = await this.roleRepository.find({
      where: { name: In(roleNames) },
    });

    if (roles.length !== roleNames.length) {
      const foundNames = roles.map(r => r.name);
      const missing = roleNames.filter(name => !foundNames.includes(name));
      throw new NotFoundException(`Rôle(s) non trouvé(s): ${missing.join(', ')}`);
    }

    user.roles = roles;
    return this.userRepository.save(user);
  }

  /**
   * Récupère tous les rôles disponibles
   */
  async getAvailableRoles(): Promise<Role[]> {
    return this.roleRepository.find({ order: { name: 'ASC' } });
  }

  /**
   * Supprime un utilisateur
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  /**
   * Vérifie si un utilisateur a un rôle spécifique
   */
  async hasRole(userId: number, roleName: string): Promise<boolean> {
    const user = await this.findOne(userId);
    return user.roles.some(role => role.name === roleName);
  }

  /**
     * Crée un utilisateur localement (sans Keycloak) avec des rôles
     * et crée automatiquement le profil (infirmier ou médecin) correspondant.
     */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { username, email, firstName, lastName } = createUserDto;
    const roles = createUserDto.roles ?? [];

    if (roles.length === 0) {
      throw new BadRequestException('Au moins un rôle doit être fourni');
    }

    // Vérifier si l'utilisateur existe déjà
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`Un utilisateur avec l'email ${email} existe déjà`);
    }

    // Récupérer les entités de rôles
    const roleEntities = await this.roleRepository.find({ where: { name: In(roles) } });
    if (roleEntities.length !== roles.length) {
      const found = roleEntities.map(r => r.name);
      const missing = roles.filter(r => !found.includes(r));
      throw new NotFoundException(`Rôle(s) non trouvé(s): ${missing.join(', ')}`);
    }

    const test: Partial<User> = {
      username,
      email,
    };

    // Créer l'utilisateur
    const user = new User();

    user.username = username!;
    user.email = email!;
    user.firstName = firstName ?? '';
    user.lastName = lastName ?? '';
    user.keycloakId = '';
    user.roles = roleEntities;

    await this.userRepository.save(user);
    //await this.userRepository.save(user);

    // Créer le profil associé (Infirmier ou Medecin)
    const isMedecin = roles.includes('medecin');
    if (isMedecin) {
      const medecin = this.medecinRepo.create({
        nom: lastName || '',
        prenom: firstName || '',
        email: email,
      });
      await this.medecinRepo.save(medecin);
    } else {
      // Par défaut, on crée un infirmier (même pour admin)
      const infirmier = this.infirmierRepo.create({
        nom: lastName || '',
        prenom: firstName || '',
        email: email,
      });
      await this.infirmierRepo.save(infirmier);
    }

    // Retourner l'utilisateur avec ses rôles
    const foundUser = await this.userRepository.findOne({
      where: { id: user.id },
      relations: { roles: true },
    });
    return foundUser!;
  }
}