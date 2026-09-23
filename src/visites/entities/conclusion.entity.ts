/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';
//import { Medecin } from 'src/medecins/entities/medecin.entity';
@Entity('conclusion')
export class Conclusion {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @OneToOne(() => VisiteMedicale, (visite) => visite.conclusion)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    /*@Column({ name: 'medecin_id' })
    medecinId!: number;*/

    /*@ManyToOne(() => Medecin, (medecin) => medecin.conclusions)
    @JoinColumn({ name: 'medecin_id' })
    medecin!: Medecin;*/

    @Column({ name: 'medecin_id', length: 191, nullable: true })
    medecinId!: string;

    @Column({ type: 'enum', enum: ['demande_examens_complementaires', 'apte', 'inapte'] })
    decision!: string;

    @Column({ type: 'text', nullable: true })
    commentaires!: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    date_conclusion!: Date;
}