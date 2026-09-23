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

    @Column({ name: 'taille_cm' })
    taille_cm!: number;

    @Column({ name: 'poids_kg' })
    poids_kg!: number;

    @Column({ type: 'double' })
    imc!: number;

    @Column({ name: 'frequence_respiratoire' })
    frequence_respiratoire!: number;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    date_prise!: Date;

    @Column({ length: 191 })
    albumine!: string;

    @Column({ length: 191 })
    diastolique!: string;

    @Column({ length: 191 })
    sucre!: string;

    @Column({ length: 191 })
    systolique!: string;

    @Column({ default: 0 })
    pouls!: number;

    @Column({ type: 'double', nullable: true })
    temperature!: number;

    @Column({ name: 'test_grossesse', default: false })
    test_grossesse: boolean = false;
}