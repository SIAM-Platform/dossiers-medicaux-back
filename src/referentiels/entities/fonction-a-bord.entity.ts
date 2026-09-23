/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fonction_a_bord')
export class FonctionABord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 191 })
  libele!: string;

}