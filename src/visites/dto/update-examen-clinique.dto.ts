/* eslint-disable prettier/prettier */
import { IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';

export class UpdateExamenCliniqueDto {
  @IsOptional()
  @IsBoolean()
  prothese?: boolean;

  @IsOptional()
  @IsString()
  g_500hz?: string;

  @IsOptional()
  @IsString()
  d_500hz?: string;

  @IsOptional()
  @IsString()
  g_1000hz?: string;

  @IsOptional()
  @IsString()
  d_1000hz?: string;

  @IsOptional()
  @IsString()
  g_2000hz?: string;

  @IsOptional()
  @IsString()
  d_2000hz?: string;

  @IsOptional()
  @IsString()
  g_3000hz?: string;

  @IsOptional()
  @IsString()
  d_3000hz?: string;

  @IsOptional()
  @IsString()
  parole_og?: string;

  @IsOptional()
  @IsString()
  parole_od?: string;

  @IsOptional()
  @IsString()
  chuchotement_og?: string;

  @IsOptional()
  @IsString()
  chuchotement_od?: string;

  @IsOptional()
  @IsString()
  oeil_g_vp_corr?: string;

  @IsOptional()
  @IsString()
  oeil_d_vp_corr?: string;

  @IsOptional()
  @IsString()
  oeil_g_vl_corr?: string;

  @IsOptional()
  @IsString()
  oeil_d_vl_corr?: string;

  @IsOptional()
  @IsString()
  oeil_g_vp_sans_corr?: string;

  @IsOptional()
  @IsString()
  oeil_d_vp_sans_corr?: string;

  @IsOptional()
  @IsString()
  oeil_g_vl_sans_corr?: string;

  @IsOptional()
  @IsString()
  oeil_d_vl_sans_corr?: string;

  @IsOptional()
  @IsString()
  champ_visuel_oeil_d?: string;

  @IsOptional()
  @IsString()
  champ_visuel_oeil_g?: string;

  @IsOptional()
  @IsString()
  champ_visuel_oeil_d_commentaire?: string;

  @IsOptional()
  @IsString()
  champ_visuel_oeil_g_commentaire?: string;

  @IsOptional()
  @IsString()
  perception_couleur?: string;

  @IsOptional()
  @IsString()
  perception_couleur_commentaire?: string;

  @IsOptional()
  @IsDateString()
  perception_couleur_date_examen?: string;

  @IsOptional()
  @IsString()
  teguments?: string;

  @IsOptional()
  @IsString()
  moteur?: string;

  @IsOptional()
  @IsString()
  endocrine?: string;

  @IsOptional()
  @IsString()
  rhino_pharynx?: string;

  @IsOptional()
  @IsString()
  respiratoire?: string;

  @IsOptional()
  @IsString()
  urinaire?: string;

  @IsOptional()
  @IsString()
  cardiovasculaire?: string;

  @IsOptional()
  @IsString()
  genital?: string;

  @IsOptional()
  @IsString()
  digestif?: string;

  @IsOptional()
  @IsString()
  systeme_nerveux?: string;

  @IsOptional()
  @IsString()
  hematologique?: string;

  @IsOptional()
  @IsString()
  psychisme?: string;

  @IsOptional()
  @IsString()
  autres?: string;

  @IsOptional()
  @IsBoolean()
  radio_pul?: boolean;

  @IsOptional()
  @IsString()
  resultat_radio_pul?: string;

  @IsOptional()
  @IsDateString()
  date_radio_pul?: string;

  @IsOptional()
  @IsString()
  autres_examens?: string;

  @IsOptional()
  @IsString()
  url_scan_autre_examen?: string;
}