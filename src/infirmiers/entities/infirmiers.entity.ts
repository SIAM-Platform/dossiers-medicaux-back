/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
//import { Constante } from '../../visites/entities/constante.entity';

@Entity('infirmier')
export class Infirmier {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 191 })
  nom!: string;

  @Column({ length: 191 })
  prenom!: string;

  @Column({ length: 191, unique: true })
  email!: string;

  /*@OneToMany(() => Constante, (constante) => constante.infirmier)
  constantes!: Constante[];*/
}