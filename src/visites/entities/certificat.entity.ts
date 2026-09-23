/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';

@Entity('certificat')
export class Certificat {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @ManyToOne(() => VisiteMedicale, (visite) => visite.certificats)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'type_certificat', type: 'enum', enum: ['aptitude_physique', 'aptitude_aller_en_mer'] })
    type_certificat!: string;

    @Column({ name: 'url_pdf', length: 191 })
    url_pdf!: string;

    @Column({ type: 'datetime' })
    date_emission!: Date;

    @Column({ type: 'datetime' })
    date_expiration!: Date;

    @Column({ name: 'numero_matricule', nullable: true, length: 191 })
    numero_matricule!: string;
}