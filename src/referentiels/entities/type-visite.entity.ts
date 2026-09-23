/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { VisiteMedicale } from '../../visites/entities/visite-medicale.entity';

@Entity('typevisite')
export class TypeVisite {
  @PrimaryGeneratedColumn({ name: 'id_type' })
  id_type!: number;

  @Column({ length: 191 })
  libele!: string;

  @OneToMany(() => VisiteMedicale, (visite) => visite.typeVisite)
  visites!: VisiteMedicale[];
}