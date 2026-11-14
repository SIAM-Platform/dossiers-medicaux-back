import { encrypted } from '../../privacy/field-cipher';
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

    @Column({ name: 'type_exam', type: 'text', nullable: true, transformer: encrypted })
    type_exam!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    resultat!: string;

    @Column({ name: 'date_examen', type: 'timestamp', nullable: true })
    date_examen!: Date;
}