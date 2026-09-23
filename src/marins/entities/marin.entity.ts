/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { VisiteMedicale } from '../../visites/entities/visite-medicale.entity';

@Entity('marin')
export class Marin {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nom!: string;

  @Column()
  prenom!: string;

  @Column({ type: 'datetime' })
  date_naissance!: Date;

  @Column({ type: 'enum', enum: ['Homme', 'Femme'] })
  sexe!: string;

  @Column({ nullable: true })
  nationalite!: string;

  @Column({ nullable: true })
  telephone!: string;

  @Column({ nullable: true })
  email!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  date_creation!: Date;

  @Column({ default: false })
  victime_guerre!: boolean;

  @Column({ default: false })
  accident_travail!: boolean;

  @Column({ default: false })
  travailleur_handicape!: boolean;

  @Column({ nullable: true })
  situation_matrimoniale!: string;

  @Column({ nullable: true })
  activites_professionnelles!: string;

  @Column({ nullable: true })
  adresse!: string;

  @Column({ nullable: true, unique: true })
  numero_cni!: string;

  @Column({ nullable: true, unique: true })
  numero_ins_mar!: string;

  @Column({ nullable: true })
  lieu_naissance!: string;

  @OneToMany(() => VisiteMedicale, (visite) => visite.marin)
  visites!: VisiteMedicale[];
}