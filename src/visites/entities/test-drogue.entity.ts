/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';

@Entity('test_drogue')
export class TestDrogue {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @OneToOne(() => VisiteMedicale, (visite) => visite.testDrogue)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale ;

    @Column({ default: false })
    benzodiazepines: boolean = false;
    @Column({ default: false })
    methadone: boolean = false;
    @Column({ default: false })
    phencyclidine: boolean = false;
    @Column({ default: false })
    cannabisTHC: boolean = false;
    @Column({ default: false })
    amphetamines: boolean = false;
    @Column({ default: false })
    methamphetamines: boolean = false;
    @Column({ default: false })
    barbituriques: boolean = false;
    @Column({ name: 'morphineOpiaces', default: false })
    morphineOpiaces: boolean = false;
    @Column({ default: false })
    cocaine: boolean = false;
    @Column({ default: false })
    ecstasy: boolean = false;
    @Column({ default: false })
    alcool: boolean = false;
    @Column({ name: 'dateAnalyse', type: 'datetime', nullable: true })
    dateAnalyse!: Date | null;
    @Column({ nullable: true, length: 191 })
    laboratoire!: string;
}