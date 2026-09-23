/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { Marin } from '../../marins/entities/marin.entity';
import { TypeVisite } from '../../referentiels/entities/type-visite.entity';
import { Constante } from './constante.entity';
import { ExamenClinique } from './examen-clinique.entity';
import { Conclusion } from './conclusion.entity';
import { Vaccination } from './vaccination.entity';
import { TestDrogue } from './test-drogue.entity';
import { ReponseAutoDeclaration } from './reponse-auto-declaration.entity';
import { CommentaireCategorie } from './commentaire-categorie.entity';
import { Certificat } from './certificat.entity';
import { ExamenComplementaire } from './examen-complementaire.entity';
import { FonctionABord } from 'src/referentiels/entities/fonction-a-bord.entity';
import { TypeNavire } from 'src/referentiels/entities/type-navire.entity';

@Entity('visitemedicale')
export class VisiteMedicale {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'marin_id' })
  marinId!: number;

  @ManyToOne(() => Marin, (marin) => marin.visites)
  @JoinColumn({ name: 'marin_id' })
  marin!: Marin;

  @Column({ type: 'datetime' })
  date_visite!: Date;

  @Column({ type: 'enum', enum: ['en_cours', 'attente_examens', 'terminé'] })
  status!: string;

  @Column({ type: 'datetime', nullable: true })
  date_expiration!: Date;

  @Column({ nullable: true, length: 191 })
  numero_matricule!: string;

  @Column({ default: false })
  reconvocation!: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ name: 'type_visiteid_type', nullable: true })
  typeVisiteId!: number;

  @ManyToOne(() => TypeVisite)
  @JoinColumn({ name: 'type_visiteid_type' })
  typeVisite!: TypeVisite;


  @Column({ name: 'fonction_a_bord_id', nullable: true })
  fonction_a_bord_id!: number;

  @ManyToOne(() => FonctionABord)
  @JoinColumn({ name: 'fonction_a_bord_id' })
  fonction_a_bord!: FonctionABord;

  @Column({ name: 'type_navire_id', nullable: true })
  type_navire_id!: number;

  @ManyToOne(() => TypeNavire)  
  @JoinColumn({ name: 'type_navire_id' })
  type_navire!: TypeNavire;

  // Autres relations...
  @OneToOne(() => Constante, (constante) => constante.visite)
  constante!: Constante;

  @OneToOne(() => ExamenClinique, (examen) => examen.visite)
  examenClinique!: ExamenClinique;

  @OneToOne(() => Conclusion, (conclusion) => conclusion.visite)
  conclusion!: Conclusion;

  @OneToOne(() => Vaccination, (vaccination) => vaccination.visite)
  vaccination!: Vaccination;

  @OneToOne(() => TestDrogue, (test) => test.visite)
  testDrogue!: TestDrogue;

  @OneToMany(() => ReponseAutoDeclaration, (reponse) => reponse.visite)
  reponsesAutoDeclaration!: ReponseAutoDeclaration[];

  @OneToMany(() => CommentaireCategorie, (comment) => comment.visite)
  commentairesCategories!: CommentaireCategorie[];

  @OneToMany(() => Certificat, (certificat) => certificat.visite)
  certificats!: Certificat[];

  @OneToMany(() => ExamenComplementaire, (exam) => exam.visite)
  examensComplementaires!: ExamenComplementaire[];
}