/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';

@Entity('vaccination')
export class Vaccination {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @OneToOne(() => VisiteMedicale, (visite) => visite.vaccination)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'fievre_jaune', default: false })
    fievre_jaune!: boolean;

    @Column({ name: 'hepatite_virale', default: false })
    hepatite_virale!: boolean;

    @Column({ default: false })
    tetanos!: boolean;

    @Column({ default: false })
    meningite!: boolean;

    @Column({ name: 'date_fievre_jaune', type: 'datetime', nullable: true })
    date_fievre_jaune!: Date;

    @Column({ name: 'date_hepatite_virale', type: 'datetime', nullable: true })
    date_hepatite_virale!: Date;

    @Column({ name: 'date_meningite', type: 'datetime', nullable: true })
    date_meningite!: Date;

    @Column({ name: 'date_tetanos', type: 'datetime', nullable: true })
    date_tetanos!: Date;
}