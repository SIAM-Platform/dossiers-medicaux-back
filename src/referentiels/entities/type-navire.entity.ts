/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';


@Entity('typenavire')
export class TypeNavire {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 191 })
  libele!: string;
}