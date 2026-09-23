/* eslint-disable prettier/prettier */
import { IsOptional, IsString } from 'class-validator';

export class UpdateAutreExamenDto {
  @IsOptional()
  @IsString()
  autre_examen?: string;

  @IsOptional()
  @IsString()
  autre_examen_autre?: string;

  @IsOptional()
  @IsString()
  image?: string;
}