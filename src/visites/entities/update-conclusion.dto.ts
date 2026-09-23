/* eslint-disable prettier/prettier */
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateConclusionDto {
  @IsEnum(['apte', 'inapte', 'demande_examens_complementaires'])
  decision!: string;

  @IsOptional()
  @IsString()
  medecin_id?: string;

  @IsOptional()
  @IsDateString()
  date_conclusion?: string;

  @IsOptional()
  @IsString()
  commentaires?: string;  
}