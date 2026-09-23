/* eslint-disable prettier/prettier */
import { Role } from '../entities/role.entity';

export class UserResponseDto {
  id!: number;
  username!: string;
  email!: string;
  firstName?: string;
  lastName?: string;
  keycloakId?: string;
  roles: Role[] = [];
}