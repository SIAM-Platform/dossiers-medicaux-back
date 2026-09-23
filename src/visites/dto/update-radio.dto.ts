/* eslint-disable prettier/prettier */
import { IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';

export class UpdateRadioDto {
  @IsOptional()
  @IsBoolean()
  radio_pul?: boolean;

  @IsOptional()
  @IsString()
  resultat_radio_pul?: string;

  @IsOptional()
  @IsDateString()
  date_radio_pul?: string;
}