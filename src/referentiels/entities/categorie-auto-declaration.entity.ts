/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { QuestionAutoDeclaration } from './question-auto-declaration.entity';
import { CommentaireCategorie } from '../../visites/entities/commentaire-categorie.entity';

@Entity('categorieautodeclaration')
export class CategorieAutoDeclaration {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 191 })
  nom!: string;

  @OneToMany(() => QuestionAutoDeclaration, (q) => q.categorie)
  questions!: QuestionAutoDeclaration[];

  @OneToMany(() => CommentaireCategorie, (comment) => comment.categorie)
  commentaires!: CommentaireCategorie[];
}