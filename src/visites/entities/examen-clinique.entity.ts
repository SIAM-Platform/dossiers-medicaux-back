import {
  encrypted,
  encryptedBoolean,
  encryptedDate,
} from '../../privacy/field-cipher';
/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { VisiteMedicale } from './visite-medicale.entity';
//import { Medecin } from 'src/medecins/entities/medecin.entity';

@Entity('examenclinique')
export class ExamenClinique {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'visite_id' })
    visiteId!: number;

    @OneToOne(() => VisiteMedicale, (visite) => visite.examenClinique)
    @JoinColumn({ name: 'visite_id' })
    visite!: VisiteMedicale;

    @Column({ name: 'medecin_id', nullable: true, length: 191 })
    medecinId!: string;


    /*@ManyToOne(() => Medecin, (medecin) => medecin.examensCliniques)
    @JoinColumn({ name: 'medecin_id' })
    medecin!: Medecin; */

    // Tous les champs de l'examen clinique
    @Column({ type: 'text', nullable: true, transformer: encryptedBoolean })
    prothese!: boolean;

    @Column({ name: 'oeil_g_vp_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_g_vp_corr!: string;

    @Column({ name: 'oeil_d_vp_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_d_vp_corr!: string;

    @Column({ name: 'oeil_g_vl_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_g_vl_corr!: string;

    @Column({ name: 'oeil_d_vl_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_d_vl_corr!: string;

    @Column({ name: 'oeil_g_vp_sans_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_g_vp_sans_corr!: string;

    @Column({ name: 'oeil_d_vp_sans_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_d_vp_sans_corr!: string;

    @Column({ name: 'oeil_g_vl_sans_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_g_vl_sans_corr!: string;

    @Column({ name: 'oeil_d_vl_sans_corr', type: 'text', nullable: true, transformer: encrypted })
    oeil_d_vl_sans_corr!: string;

    @Column({ name: 'perception_couleur', type: 'text', nullable: true, transformer: encrypted })
    perception_couleur!: string;

    @Column({ name: 'perception_couleur_commentaire', type: 'text', nullable: true, transformer: encrypted })
    perception_couleur_commentaire!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    teguments!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    moteur!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    endocrine!: string;

    @Column({ name: 'rhino_pharynx', type: 'text', nullable: true, transformer: encrypted })
    rhino_pharynx!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    respiratoire!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    urinaire!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    cardiovasculaire!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    genital!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    digestif!: string;

    @Column({ name: 'systeme_nerveux', type: 'text', nullable: true, transformer: encrypted })
    systeme_nerveux!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    hematologique!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    psychisme!: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    date_examen!: Date;

    // ... (tous les autres champs de votre dump)
    // Je vous laisse les copier depuis l'ancien fichier
    // Mais voici les plus importants :

    @Column({ name: 'autres_examens', type: 'text', nullable: true, transformer: encrypted })
    autres_examens!: string;

    @Column({ name: 'ch_od', type: 'text', nullable: true, transformer: encrypted })
    ch_od!: string;

    @Column({ name: 'ch_og', type: 'text', nullable: true, transformer: encrypted })
    ch_og!: string;

    @Column({ name: 'champ_visuel_oeil_d', type: 'text', nullable: true, transformer: encrypted })
    champ_visuel_oeil_d!: string;

    @Column({ name: 'champ_visuel_oeil_g', type: 'text', nullable: true, transformer: encrypted })
    champ_visuel_oeil_g!: string;

    @Column({ name: 'date_radio_pul', type: 'text', nullable: true, transformer: encryptedDate })
    date_radio_pul!: Date | null;

    @Column({ name: 'parole_od', type: 'text', nullable: true, transformer: encrypted })
    parole_od!: string;

    @Column({ name: 'parole_og', type: 'text', nullable: true, transformer: encrypted })
    parole_og!: string;

    @Column({ name: 'radio_pul', type: 'text', nullable: true, transformer: encryptedBoolean })
    radio_pul: boolean = false;

    @Column({ name: 'resultat_autres_examens', type: 'text', nullable: true, transformer: encrypted })
    resultat_autres_examens!: string;

    @Column({ name: 'resultat_radio_pul', type: 'text', nullable: true, transformer: encrypted })
    resultat_radio_pul!: string;

    // Commentaires
    @Column({ name: 'cardiovasculaire_commentaire', type: 'text', nullable: true, transformer: encrypted })
    cardiovasculaire_commentaire!: string;

    @Column({ name: 'digestif_commentaire', type: 'text', nullable: true, transformer: encrypted })
    digestif_commentaire!: string;

    @Column({ name: 'endocrine_commentaire', type: 'text', nullable: true, transformer: encrypted })
    endocrine_commentaire!: string;

    @Column({ name: 'genital_commentaire', type: 'text', nullable: true, transformer: encrypted })
    genital_commentaire!: string;

    @Column({ name: 'hematologique_commentaire', type: 'text', nullable: true, transformer: encrypted })
    hematologique_commentaire!: string;

    @Column({ name: 'moteur_commentaire', type: 'text', nullable: true, transformer: encrypted })
    moteur_commentaire!: string;

    @Column({ name: 'psychisme_commentaire', type: 'text', nullable: true, transformer: encrypted })
    psychisme_commentaire!: string;

    @Column({ name: 'respiratoire_commentaire', type: 'text', nullable: true, transformer: encrypted })
    respiratoire_commentaire!: string;

    @Column({ name: 'rhino_pharynx_commentaire', type: 'text', nullable: true, transformer: encrypted })
    rhino_pharynx_commentaire!: string;

    @Column({ name: 'systeme_nerveux_commentaire', type: 'text', nullable: true, transformer: encrypted })
    systeme_nerveux_commentaire!: string;

    @Column({ name: 'teguments_commentaire', type: 'text', nullable: true, transformer: encrypted })
    teguments_commentaire!: string;

    @Column({ name: 'urinaire_commentaire', type: 'text', nullable: true, transformer: encrypted })
    urinaire_commentaire!: string;

    @Column({ type: 'text', nullable: true, transformer: encrypted })
    autres!: string;

    @Column({ name: 'autres_commentaire', type: 'text', nullable: true, transformer: encrypted })
    autres_commentaire!: string;

    @Column({ name: 'champ_visuel_oeil_d_commentaire', type: 'text', nullable: true, transformer: encrypted })
    champ_visuel_oeil_d_commentaire!: string;

    @Column({ name: 'champ_visuel_oeil_g_commentaire', type: 'text', nullable: true, transformer: encrypted })
    champ_visuel_oeil_g_commentaire!: string;

    // Audiométrie
    @Column({ name: 'd_1000hz', type: 'text', nullable: true, transformer: encrypted })
    d_1000hz!: string;

    @Column({ name: 'd_2000hz', type: 'text', nullable: true, transformer: encrypted })
    d_2000hz!: string;

    @Column({ name: 'd_3000hz', type: 'text', nullable: true, transformer: encrypted })
    d_3000hz!: string;

    @Column({ name: 'd_500hz', type: 'text', nullable: true, transformer: encrypted })
    d_500hz!: string;

    @Column({ name: 'g_1000hz', type: 'text', nullable: true, transformer: encrypted })
    g_1000hz!: string;

    @Column({ name: 'g_2000hz', type: 'text', nullable: true, transformer: encrypted })
    g_2000hz!: string;

    @Column({ name: 'g_3000hz', type: 'text', nullable: true, transformer: encrypted })
    g_3000hz!: string;

    @Column({ name: 'g_500hz', type: 'text', nullable: true, transformer: encrypted })
    g_500hz!: string;

    @Column({ name: 'perception_couleur_date_examen', type: 'text', nullable: true, transformer: encrypted })
    perception_couleur_date_examen!: string;

    @Column({ name: 'url_scan_autre_examen', type: 'text', nullable: true, transformer: encrypted })
    url_scan_autre_examen!: string;
}