/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable prettier/prettier */
import { Transform } from 'class-transformer';
import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsBoolean,
    IsEmail,
    IsNotEmpty,
} from 'class-validator';

export class CreateMarinDto {
    @IsNotEmpty()
    @IsString()
    nom!: string;

    @IsNotEmpty()
    @IsString()
    prenom!: string;

    @IsNotEmpty()
    @IsDateString()
    date_naissance!: string; // on reçoit une chaîne ISO, on la convertira en Date

    @IsEnum(['Homme', 'Femme'])
    sexe!: string;

    @IsOptional()
    @IsString()
    nationalite?: string;

    @IsOptional()
    @IsString()
    telephone?: string;

    @IsOptional()
    @IsEmail()
    @Transform(({ value }) => (value === '' ? null : value))
    email?: string;

    @IsOptional()
    @IsBoolean()
    victime_guerre?: boolean;

    @IsOptional()
    @IsBoolean()
    accident_travail?: boolean;

    @IsOptional()
    @IsBoolean()
    travailleur_handicape?: boolean;

    @IsOptional()
    @IsString()
    situation_matrimoniale?: string;

    @IsOptional()
    @IsString()
    activites_professionnelles?: string;

    @IsOptional()
    @IsString()
    adresse?: string;

    @IsOptional()
    @IsString()
    numero_cni?: string;

    @IsOptional()
    @IsString()
    numero_ins_mar?: string;

    @IsOptional()
    @IsString()
    lieu_naissance?: string;
}