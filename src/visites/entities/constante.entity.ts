import {
  encrypted,
  encryptedBoolean,
  encryptedNumber,
} from '../../privacy/field-cipher';
/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';
//import { Infirmier } from 'src/infirmiers/entities/infirmiers.entity';

@Entity('constante')
export class Constante {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @OneToOne(() => VisiteMedicale, (visite) => visite.constante)
    @JoinColumn({ name: 'visite_id' })
    visite?: VisiteMedicale;

    @Column({ name: 'infirmier_id', length: 191, nullable: true })
    infirmierId!: string;
    /*@ManyToOne(() => Infirmier, (infirmier) => infirmier.constantes)
    @JoinColumn({ name: 'infirmier_id' })
    infirmier!: Infirmier;*/

    @Column({ name: 'taille_cm', type: 'text', nullable: true, transformer: encryptedNumber })
    taille_cm!: number;

    @Column({ name: 'poids_kg', type: 'text', nullable: true, transformer: encryptedNumber })
    poids_kg!: number;

    @Column({ type: 'text', nullable: true, transformer: encryptedNumber })
    imc!: number;

    @Column({ name: 'frequence_respiratoire', type: 'text', nullable: true, transformer: encryptedNumber })
    frequence_respiratoire!: number;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    date_prise!: Date;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    albumine!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    diastolique!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    sucre!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    systolique!: string;

    @Column({ type: 'text', nullable: true, transformer: encryptedNumber })
    pouls!: number;

    @Column({ type: 'text', nullable: true, transformer: encryptedNumber })
    temperature!: number;

    @Column({ name: 'test_grossesse', type: 'text', nullable: true, transformer: encryptedBoolean })
    test_grossesse: boolean = false;
}