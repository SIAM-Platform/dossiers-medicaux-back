import { Expose, Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Type de visite, fonction à bord, type de navire : un libellé obligatoire. */
export class LibeleDto {
  @Transform(trim)
  @IsString({ message: 'Le libellé doit être un texte' })
  @IsNotEmpty({ message: 'Le libellé est obligatoire' })
  @MaxLength(191, { message: 'Le libellé ne doit pas dépasser 191 caractères' })
  libele!: string;
}

/** Catégorie d'auto-déclaration. */
export class CategorieDto {
  @Transform(trim)
  @IsString({ message: 'Le nom doit être un texte' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(191, { message: 'Le nom ne doit pas dépasser 191 caractères' })
  nom!: string;
}

/**
 * Question d'auto-déclaration. L'écran envoyait `libele` et `categorie_id` (noms des colonnes) au
 * lieu de `libelle` et `categorieId` : les deux écritures sont acceptées.
 */
export class QuestionDto {
  // @Expose : la transformation s'applique aussi quand seul l'ancien nom est envoyé.
  @Expose()
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
      trim({ value: value ?? obj.libele }),
  )
  @IsString({ message: 'Le libellé doit être un texte' })
  @IsNotEmpty({ message: 'Le libellé est obligatoire' })
  @MaxLength(191, { message: 'Le libellé ne doit pas dépasser 191 caractères' })
  libelle!: string;

  @Expose()
  @Transform(
    ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) => {
      const v = value ?? obj.categorie_id;
      return v === undefined || v === null || v === '' ? undefined : Number(v);
    },
  )
  @IsInt({ message: 'La catégorie est obligatoire' })
  @Min(1, { message: 'La catégorie est obligatoire' })
  categorieId!: number;
}
