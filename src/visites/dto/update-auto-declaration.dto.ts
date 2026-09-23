/* eslint-disable prettier/prettier */
import { IsArray, ValidateNested, IsNumber, IsBoolean, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AutoDeclarationItemDto {
  @IsNumber()
  question_id?: number;

  @IsBoolean()
  reponse?: boolean;

  @IsOptional()
  @IsString()
  commentaire?: string;
}

export class UpdateAutoDeclarationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoDeclarationItemDto)
  reponses?: AutoDeclarationItemDto[];
}