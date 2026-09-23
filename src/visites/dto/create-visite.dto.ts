/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Sous-DTO pour les informations du marin
export class InfosMarinDto {
    @IsNotEmpty()
    @IsString()
    nom!: string;

    @IsNotEmpty()
    @IsString()
    prenom!: string;

    @IsDateString()
    @IsNotEmpty()
    date_naissance!: string;

    @IsOptional()
    @IsString()
    lieu_naissance?: string;

    @IsNotEmpty()
    @IsString()
    sexe!: string;

    @IsOptional()
    @IsString()
    nationalite?: string;

    @IsOptional()
    @IsString()
    telephone?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    cni?: string;

    @IsOptional()
    @IsString()
    nim?: string;

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
    numero_matricule?: string;

    @IsOptional()
    @IsBoolean()
    reconvocation?: boolean;
}

// Sous-DTO pour le type de visite
export class TypeVisiteDto {
    @IsNotEmpty()
    @IsNumber()
    type_visite!: number; // ID du type de visite

    @IsOptional()
    @IsNumber()
    fonction_a_bord?: number; // ID de la fonction

    @IsOptional()
    @IsNumber()
    type_navire?: number; // ID du type de navire
}

// Sous-DTO pour les constantes
export class ConstantesDto {
    @IsOptional()
    @IsString()
    infirmier_id?: string; // ou number selon votre entité

    @IsNumber()
    taille_cm!: number;

    @IsNumber()
    poids_kg!: number;

    @IsNumber()
    imc!: number;

    @IsNumber()
    frequence_respiratoire!: number;

    @IsOptional()
    @IsNumber()
    pouls?: number;

    @IsString()
    systolique!: string;

    @IsString()
    diastolique!: string;

    @IsString()
    glycemie_albumine!: string;

    @IsString()
    glycemie_sucre!: string;

    @IsOptional()
    @IsNumber()
    temperature?: number;

    @IsOptional()
    @IsBoolean()
    test_grossesse?: boolean;
}

// Sous-DTO pour l'appareil auditif
export class AppAuditifDto {
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
}

// Sous-DTO pour l'appareil oculaire
export class AppOculaireDto {
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
    champ_visuel_resultat_d?: string;

    @IsOptional()
    @IsString()
    champ_visuel_resultat_g?: string;

    @IsOptional()
    @IsString()
    champ_visuel_commentaire_d?: string;

    @IsOptional()
    @IsString()
    champ_visuel_commentaire_g?: string;

    @IsOptional()
    @IsString()
    perception_couleur?: string;

    @IsOptional()
    @IsString()
    perception_couleur_commentaire?: string;

    @IsOptional()
    @IsDateString()
    date_test_couleur?: string;
}

// Sous-DTO pour les autres examens
export class OtherAppDto {
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
}

// Sous-DTO pour la vaccination
export class VaccinationDto {
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

// Sous-DTO pour la radiologie
export class RadioDto {
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

// Sous-DTO pour les autres examens avec fichier
export class AutreExamenDto {
    @IsOptional()
    @IsString()
    autre_examen?: string;

    @IsOptional()
    @IsString()
    autre_examen_autre?: string;

    @IsOptional()
    @IsString()
    image?: string; // base64 ou URL, sera traité
}

// Sous-DTO pour la toxicologie
export class ToxicologieDto {
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

// DTO principal pour la création d'une visite
export class CreateVisiteDto {
    @ValidateNested()
    @Type(() => TypeVisiteDto)
    type_visite!: TypeVisiteDto;

    @ValidateNested()
    @Type(() => InfosMarinDto)
    infos!: InfosMarinDto;

    @ValidateNested()
    @Type(() => ConstantesDto)
    constantes!: ConstantesDto;

    @ValidateNested()
    @Type(() => AppAuditifDto)
    app_auditif!: AppAuditifDto;

    @ValidateNested()
    @Type(() => AppOculaireDto)
    app_occulaire!: AppOculaireDto;

    @ValidateNested()
    @Type(() => OtherAppDto)
    other_app!: OtherAppDto;

    @ValidateNested()
    @Type(() => VaccinationDto)
    vaccination!: VaccinationDto;

    @ValidateNested()
    @Type(() => RadioDto)
    radio!: RadioDto;

    @ValidateNested()
    @Type(() => AutreExamenDto)
    autre_examen!: AutreExamenDto;

    @ValidateNested()
    @Type(() => ToxicologieDto)
    toxicologie!: ToxicologieDto;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AutoDeclarationItemDto)
    auto_declaration?: AutoDeclarationItemDto[];
}

// DTO pour les réponses d'auto-déclaration
export class AutoDeclarationItemDto {
    @IsNumber()
    question_id!: number;

    @IsBoolean()
    reponse!: boolean;

    @IsOptional()
    @IsString()
    commentaire?: string;
}