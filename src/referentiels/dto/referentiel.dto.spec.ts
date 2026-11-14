import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LibeleDto, QuestionDto } from './referentiel.dto';

const check = async <T extends object>(cls: new () => T, plain: object) => {
  const dto = plainToInstance(cls, plain);
  return { dto, errors: await validate(dto) };
};

describe('DTO des référentiels', () => {
  it("question : accepte l'écriture de l'écran (libele, categorie_id)", async () => {
    const { dto, errors } = await check(QuestionDto, {
      libele: '  Avez-vous été hospitalisé ?  ',
      categorie_id: '3',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      libelle: 'Avez-vous été hospitalisé ?',
      categorieId: 3,
    });
  });

  it("question : accepte l'écriture de l'API (libelle, categorieId)", async () => {
    const { dto, errors } = await check(QuestionDto, {
      libelle: 'Traitement ?',
      categorieId: 2,
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ libelle: 'Traitement ?', categorieId: 2 });
  });

  it('question : catégorie et libellé obligatoires, messages en français', async () => {
    const { errors } = await check(QuestionDto, {});
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toEqual(
      expect.arrayContaining([
        'Le libellé est obligatoire',
        'La catégorie est obligatoire',
      ]),
    );
  });

  it('libellé : vide, blanc ou trop long refusé', async () => {
    for (const libele of ['', '   ', 'x'.repeat(192)])
      expect(
        (await check(LibeleDto, { libele })).errors.length,
      ).toBeGreaterThan(0);
    expect((await check(LibeleDto, { libele: 'Pirogue' })).errors).toEqual([]);
  });
});
