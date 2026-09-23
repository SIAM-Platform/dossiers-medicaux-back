/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';

@Entity('examcomplementaire')
export class ExamenComplementaire {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @ManyToOne(() => VisiteMedicale, (visite) => visite.examensComplementaires)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'type_exam', length: 191 })
    type_exam!: string;

    @Column({ nullable: true, length: 191 })
    resultat!: string;

    @Column({ name: 'date_examen', type: 'datetime', nullable: true })
    date_examen!: Date;
}