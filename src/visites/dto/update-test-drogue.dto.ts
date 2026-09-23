/* eslint-disable prettier/prettier */
import { IsOptional, IsBoolean, IsDateString, IsString } from 'class-validator';

export class UpdateTestDrogueDto {
  @IsOptional()
  @IsBoolean()
  benzodiazepines?: boolean;

  @IsOptional()
  @IsBoolean()
  methadone?: boolean;

  @IsOptional()
  @IsBoolean()
  phencyclidine?: boolean;

  @IsOptional()
  @IsBoolean()
  cannabisTHC?: boolean;

  @IsOptional()
  @IsBoolean()
  amphetamines?: boolean;

  @IsOptional()
  @IsBoolean()
  methamphetamines?: boolean;

  @IsOptional()
  @IsBoolean()
  barbituriques?: boolean;

  @IsOptional()
  @IsBoolean()
  morphineOpiaces?: boolean;

  @IsOptional()
  @IsBoolean()
  cocaine?: boolean;

  @IsOptional()
  @IsBoolean()
  ecstasy?: boolean;

  @IsOptional()
  @IsBoolean()
  alcool?: boolean;

  @IsOptional()
  @IsDateString()
  dateAnalyse?: string;

  @IsOptional()
  @IsString()
  laboratoire?: string;
}