/* eslint-disable prettier/prettier */
import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';

export class UpdateConstanteDto {
  @IsOptional()
  @IsString()
  infirmier_id?: string;

  @IsOptional()
  @IsNumber()
  taille_cm?: number;

  @IsOptional()
  @IsNumber()
  poids_kg?: number;

  @IsOptional()
  @IsNumber()
  imc?: number;

  @IsOptional()
  @IsNumber()
  frequence_respiratoire?: number;

  @IsOptional()
  @IsNumber()
  pouls?: number;

  @IsOptional()
  @IsString()
  systolique?: string;

  @IsOptional()
  @IsString()
  diastolique?: string;

  @IsOptional()
  @IsString()
  glycemie_albumine?: string;

  @IsOptional()
  @IsString()
  glycemie_sucre?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsBoolean()
  test_grossesse?: boolean;
}