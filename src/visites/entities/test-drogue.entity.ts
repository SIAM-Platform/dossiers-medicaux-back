import {
  encrypted,
  encryptedBoolean,
  encryptedDate,
} from '../../privacy/field-cipher';
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

    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    benzodiazepines: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    methadone: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    phencyclidine: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    cannabisTHC: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    amphetamines: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    methamphetamines: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    barbituriques: boolean = false;
    @Column({ name: 'morphineOpiaces', type: 'text', nullable: true, transformer: encryptedBoolean })
    morphineOpiaces: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    cocaine: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    ecstasy: boolean = false;
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    alcool: boolean = false;
    @Column({ name: 'dateAnalyse', type: 'text', nullable: true, transformer: encryptedDate })
    dateAnalyse!: Date | null;
    @Column({ type: 'text', nullable: true, transformer: encrypted })
    laboratoire!: string;
}