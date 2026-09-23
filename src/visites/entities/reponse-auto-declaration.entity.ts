/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';
import { QuestionAutoDeclaration } from 'src/referentiels/entities/question-auto-declaration.entity';

@Entity('reponseautodeclaration')
export class ReponseAutoDeclaration {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @ManyToOne(() => VisiteMedicale, (visite) => visite.reponsesAutoDeclaration)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'question_id' })
    questionId!: number;

    @ManyToOne(() => QuestionAutoDeclaration, (q) => q.reponses)
    @JoinColumn({ name: 'question_id' })
    question!: QuestionAutoDeclaration;

    @Column({ default: false })
    reponse!: boolean;

    @Column({ nullable: true, length: 191 })
    commentaire!: string;
}