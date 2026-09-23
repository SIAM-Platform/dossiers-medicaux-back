/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeVisite } from '../entities/type-visite.entity';
import { FonctionABord } from '../entities/fonction-a-bord.entity';
import { TypeNavire } from '../entities/type-navire.entity';
import { CategorieAutoDeclaration } from '../entities/categorie-auto-declaration.entity';
import { QuestionAutoDeclaration } from '../entities/question-auto-declaration.entity';

@Injectable()
export class ReferentielsService {
  constructor(
    @InjectRepository(TypeVisite)
    private typeVisiteRepo: Repository<TypeVisite>,
    @InjectRepository(FonctionABord)
    private fonctionRepo: Repository<FonctionABord>,
    @InjectRepository(TypeNavire)
    private typeNavireRepo: Repository<TypeNavire>,
    @InjectRepository(CategorieAutoDeclaration)
    private categorieRepo: Repository<CategorieAutoDeclaration>,
    @InjectRepository(QuestionAutoDeclaration)
    private questionRepo: Repository<QuestionAutoDeclaration>,
  ) {}

  // ------------------- TypeVisite -------------------
  findAllTypeVisites(): Promise<TypeVisite[]> {
    return this.typeVisiteRepo.find();
  }

  async findOneTypeVisite(id: number): Promise<TypeVisite> {
    const item = await this.typeVisiteRepo.findOne({ where: { id_type: id } });
    if (!item) throw new NotFoundException(`TypeVisite #${id} not found`);
    return item;
  }

  createTypeVisite(data: Partial<TypeVisite>): Promise<TypeVisite> {
    const entity = this.typeVisiteRepo.create(data);
    return this.typeVisiteRepo.save(entity);
  }

  async updateTypeVisite(id: number, data: Partial<TypeVisite>): Promise<TypeVisite> {
    await this.findOneTypeVisite(id);
    await this.typeVisiteRepo.update({ id_type: id }, data);
    return this.findOneTypeVisite(id);
  }

  async removeTypeVisite(id: number): Promise<void> {
    const item = await this.findOneTypeVisite(id);
    await this.typeVisiteRepo.remove(item);
  }

  // ------------------- FonctionABord -------------------
  findAllFonctions(): Promise<FonctionABord[]> {
    return this.fonctionRepo.find();
  }

  async findOneFonction(id: number): Promise<FonctionABord> {
    const item = await this.fonctionRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`FonctionABord #${id} not found`);
    return item;
  }

  createFonction(data: Partial<FonctionABord>): Promise<FonctionABord> {
    const entity = this.fonctionRepo.create(data);
    return this.fonctionRepo.save(entity);
  }

  async updateFonction(id: number, data: Partial<FonctionABord>): Promise<FonctionABord> {
    await this.findOneFonction(id);
    await this.fonctionRepo.update(id, data);
    return this.findOneFonction(id);
  }

  async removeFonction(id: number): Promise<void> {
    const item = await this.findOneFonction(id);
    await this.fonctionRepo.remove(item);
  }

  // ------------------- TypeNavire -------------------
  findAllTypeNavires(): Promise<TypeNavire[]> {
    return this.typeNavireRepo.find();
  }

  async findOneTypeNavire(id: number): Promise<TypeNavire> {
    const item = await this.typeNavireRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`TypeNavire #${id} not found`);
    return item;
  }

  createTypeNavire(data: Partial<TypeNavire>): Promise<TypeNavire> {
    const entity = this.typeNavireRepo.create(data);
    return this.typeNavireRepo.save(entity);
  }

  async updateTypeNavire(id: number, data: Partial<TypeNavire>): Promise<TypeNavire> {
    await this.findOneTypeNavire(id);
    await this.typeNavireRepo.update(id, data);
    return this.findOneTypeNavire(id);
  }

  async removeTypeNavire(id: number): Promise<void> {
    const item = await this.findOneTypeNavire(id);
    await this.typeNavireRepo.remove(item);
  }

  // ------------------- CategorieAutoDeclaration -------------------
  findAllCategories(): Promise<CategorieAutoDeclaration[]> {
    return this.categorieRepo.find({ relations: { questions: true } });
  }

  async findOneCategorie(id: number): Promise<CategorieAutoDeclaration> {
    const item = await this.categorieRepo.findOne({
      where: { id },
      relations: { questions: true },
    });
    if (!item) throw new NotFoundException(`CategorieAutoDeclaration #${id} not found`);
    return item;
  }

  createCategorie(data: Partial<CategorieAutoDeclaration>): Promise<CategorieAutoDeclaration> {
    const entity = this.categorieRepo.create(data);
    return this.categorieRepo.save(entity);
  }

  async updateCategorie(id: number, data: Partial<CategorieAutoDeclaration>): Promise<CategorieAutoDeclaration> {
    await this.findOneCategorie(id);
    await this.categorieRepo.update(id, data);
    return this.findOneCategorie(id);
  }

  async removeCategorie(id: number): Promise<void> {
    const item = await this.findOneCategorie(id);
    await this.categorieRepo.remove(item);
  }

  // ------------------- QuestionAutoDeclaration -------------------
  findAllQuestions(): Promise<QuestionAutoDeclaration[]> {
    return this.questionRepo.find({ relations: { categorie: true } });
  }

  async findOneQuestion(id: number): Promise<QuestionAutoDeclaration> {
    const item = await this.questionRepo.findOne({
      where: { id },
      relations: { categorie: true },
    });
    if (!item) throw new NotFoundException(`QuestionAutoDeclaration #${id} not found`);
    return item;
  }

  createQuestion(data: Partial<QuestionAutoDeclaration>): Promise<QuestionAutoDeclaration> {
    const entity = this.questionRepo.create(data);
    return this.questionRepo.save(entity);
  }

  async updateQuestion(id: number, data: Partial<QuestionAutoDeclaration>): Promise<QuestionAutoDeclaration> {
    await this.findOneQuestion(id);
    await this.questionRepo.update(id, data);
    return this.findOneQuestion(id);
  }

  async removeQuestion(id: number): Promise<void> {
    const item = await this.findOneQuestion(id);
    await this.questionRepo.remove(item);
  }

  // Option : récupérer les questions d'une catégorie
  async findQuestionsByCategorie(categorieId: number): Promise<QuestionAutoDeclaration[]> {
    return this.questionRepo.find({
      where: { categorieId },
      relations: { categorie: true },
    });
  }
}