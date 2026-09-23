/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';
import { CategorieAutoDeclaration } from 'src/referentiels/entities/categorie-auto-declaration.entity';

@Entity('commentairecategorie')
export class CommentaireCategorie {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @ManyToOne(() => VisiteMedicale, (visite) => visite.commentairesCategories)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'categorie_id' })
    categorieId!: number;

    @ManyToOne(() => CategorieAutoDeclaration, (categorie) => categorie.commentaires)
    @JoinColumn({ name: 'categorie_id' })
    categorie!: CategorieAutoDeclaration;

    @Column({ length: 191 })
    commentaire!: string;
}