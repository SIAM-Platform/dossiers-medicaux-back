/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { CategorieAutoDeclaration } from './categorie-auto-declaration.entity';
import { ReponseAutoDeclaration } from '../../visites/entities/reponse-auto-declaration.entity';

@Entity('questionautodeclaration')
export class QuestionAutoDeclaration {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 191 })
    libelle!: string;

    @Column({ name: 'categorie_id' })
    categorieId!: number;

    @ManyToOne(() => CategorieAutoDeclaration, (categorie) => categorie.questions)
    @JoinColumn({ name: 'categorie_id' })
    categorie!: CategorieAutoDeclaration;

    @OneToMany(() => ReponseAutoDeclaration, (reponse) => reponse.question)
    reponses!: ReponseAutoDeclaration[];
}