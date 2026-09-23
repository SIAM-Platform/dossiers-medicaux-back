/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
//import { ExamenClinique } from '../../visites/entities/examen-clinique.entity';
//import { Conclusion } from '../../visites/entities/conclusion.entity';

@Entity('medecin')
export class Medecin {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 191 })
  nom!: string;

  @Column({ length: 191 })
  prenom!: string;

  @Column({ length: 191, unique: true })
  email!: string;

  /*@OneToMany(() => ExamenClinique, (examen) => examen.medecin)
  examensCliniques!: ExamenClinique[];

  @OneToMany(() => Conclusion, (conclusion) => conclusion.medecin)
  conclusions!: Conclusion[];*/
}