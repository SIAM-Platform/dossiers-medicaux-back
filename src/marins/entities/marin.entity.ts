/* eslint-disable prettier/prettier */
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { encrypted, encryptedBoolean, encryptedDate } from '../../privacy/field-cipher';
import { marinIndex } from '../marin-index';
import { VisiteMedicale } from '../../visites/entities/visite-medicale.entity';

/**
 * Marin suivi par le centre médical. Identité, coordonnées et situation (victime de guerre, accident
 * du travail, handicap) sont **chiffrées en base** (AES-256-GCM, trousseau `crypto_keys`). La
 * recherche et l'unicité passent par des index aveugles (empreintes HMAC), calculés à chaque
 * écriture : aucune copie en clair n'est stockée.
 */
@Entity('marin')
export class Marin {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  nom!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  prenom!: string;

  @Column({ type: 'text', nullable: true, transformer: encryptedDate })
  date_naissance!: Date;

  @Column({ type: 'enum', enum: ['Homme', 'Femme'] })
  sexe!: string;

  @Column({ nullable: true })
  nationalite!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  telephone!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  email!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  date_creation!: Date;

  @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
  victime_guerre: boolean = false;

  @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
  accident_travail: boolean = false;

  @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
  travailleur_handicape: boolean = false;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  situation_matrimoniale!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  activites_professionnelles!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  adresse!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  numero_cni!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  numero_ins_mar!: string;

  @Column({ type: 'text', nullable: true, transformer: encrypted })
  lieu_naissance!: string;

  /** Empreinte du numéro d'inscription maritime (recherche exacte, unicité). */
  @Index('UQ_marin_numero_ins_mar_index', { unique: true })
  @Column({ type: 'varchar', length: 22, nullable: true, select: false })
  numero_ins_mar_index?: string | null;

  /** Empreinte du numéro de CNI (recherche exacte, unicité). */
  @Index('UQ_marin_numero_cni_index', { unique: true })
  @Column({ type: 'varchar', length: 22, nullable: true, select: false })
  numero_cni_index?: string | null;

  /** Empreintes des trigrammes du nom et du prénom, séparées par des espaces (recherche approchée). */
  @Column({ type: 'text', nullable: true, select: false })
  nom_index?: string | null;

  @OneToMany(() => VisiteMedicale, (visite) => visite.marin)
  visites!: VisiteMedicale[];

  @BeforeInsert()
  @BeforeUpdate()
  computeIndexes(): void {
    if (this.numero_ins_mar !== undefined) this.numero_ins_mar_index = marinIndex.nim(this.numero_ins_mar);
    if (this.numero_cni !== undefined) this.numero_cni_index = marinIndex.cni(this.numero_cni);
    if (this.nom !== undefined || this.prenom !== undefined) this.nom_index = marinIndex.name(this.nom, this.prenom);
  }
}