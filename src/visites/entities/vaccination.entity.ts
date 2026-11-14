import { encryptedBoolean, encryptedDate } from '../../privacy/field-cipher';
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

    @Column({ name: 'fievre_jaune', type: 'text', nullable: true, transformer: encryptedBoolean })
    fievre_jaune: boolean = false;

    @Column({ name: 'hepatite_virale', type: 'text', nullable: true, transformer: encryptedBoolean })
    hepatite_virale: boolean = false;

    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    tetanos: boolean = false;

    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    meningite: boolean = false;

    @Column({ name: 'date_fievre_jaune', type: 'text', nullable: true, transformer: encryptedDate })
    date_fievre_jaune!: Date;

    @Column({ name: 'date_hepatite_virale', type: 'text', nullable: true, transformer: encryptedDate })
    date_hepatite_virale!: Date;

    @Column({ name: 'date_meningite', type: 'text', nullable: true, transformer: encryptedDate })
    date_meningite!: Date;

    @Column({ name: 'date_tetanos', type: 'text', nullable: true, transformer: encryptedDate })
    date_tetanos!: Date;
}