import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from '../users/entities/role.entity';

/** Attribution d'une permission à un rôle (donnée modifiable par l'administration). */
@Entity('role_permission')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'int' })
  roleId!: number;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  permission!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
