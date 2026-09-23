/* eslint-disable prettier/prettier */
import { IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateVaccinationDto {
  @IsOptional()
  @IsBoolean()
  fievre_jaune?: boolean;

  @IsOptional()
  @IsDateString()
  date_fievre_jaune?: string;

  @IsOptional()
  @IsBoolean()
  hepatite_virale?: boolean;

  @IsOptional()
  @IsDateString()
  date_hepatite_virale?: string;

  @IsOptional()
  @IsBoolean()
  tetanos?: boolean;

  @IsOptional()
  @IsDateString()
  date_tetanos?: string;

  @IsOptional()
  @IsBoolean()
  meningite?: boolean;

  @IsOptional()
  @IsDateString()
  date_meningite?: string;
}