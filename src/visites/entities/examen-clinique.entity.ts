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
    @Column({ nullable: true })
    prothese!: boolean;

    @Column({ name: 'oeil_g_vp_corr', nullable: true, length: 191 })
    oeil_g_vp_corr!: string;

    @Column({ name: 'oeil_d_vp_corr', nullable: true, length: 191 })
    oeil_d_vp_corr!: string;

    @Column({ name: 'oeil_g_vl_corr', nullable: true, length: 191 })
    oeil_g_vl_corr!: string;

    @Column({ name: 'oeil_d_vl_corr', nullable: true, length: 191 })
    oeil_d_vl_corr!: string;

    @Column({ name: 'oeil_g_vp_sans_corr', nullable: true, length: 191 })
    oeil_g_vp_sans_corr!: string;

    @Column({ name: 'oeil_d_vp_sans_corr', nullable: true, length: 191 })
    oeil_d_vp_sans_corr!: string;

    @Column({ name: 'oeil_g_vl_sans_corr', nullable: true, length: 191 })
    oeil_g_vl_sans_corr!: string;

    @Column({ name: 'oeil_d_vl_sans_corr', nullable: true, length: 191 })
    oeil_d_vl_sans_corr!: string;

    @Column({ name: 'perception_couleur', nullable: true, length: 191 })
    perception_couleur!: string;

    @Column({ name: 'perception_couleur_commentaire', nullable: true, length: 191 })
    perception_couleur_commentaire!: string;

    @Column({ nullable: true, length: 191 })
    teguments!: string;

    @Column({ nullable: true, length: 191 })
    moteur!: string;

    @Column({ nullable: true, length: 191 })
    endocrine!: string;

    @Column({ name: 'rhino_pharynx', nullable: true, length: 191 })
    rhino_pharynx!: string;

    @Column({ nullable: true, length: 191 })
    respiratoire!: string;

    @Column({ nullable: true, length: 191 })
    urinaire!: string;

    @Column({ nullable: true, length: 191 })
    cardiovasculaire!: string;

    @Column({ nullable: true, length: 191 })
    genital!: string;

    @Column({ nullable: true, length: 191 })
    digestif!: string;

    @Column({ name: 'systeme_nerveux', nullable: true, length: 191 })
    systeme_nerveux!: string;

    @Column({ nullable: true, length: 191 })
    hematologique!: string;

    @Column({ nullable: true, length: 191 })
    psychisme!: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    date_examen!: Date;

    // ... (tous les autres champs de votre dump)
    // Je vous laisse les copier depuis l'ancien fichier
    // Mais voici les plus importants :

    @Column({ name: 'autres_examens', nullable: true, length: 191 })
    autres_examens!: string;

    @Column({ name: 'ch_od', nullable: true, length: 191 })
    ch_od!: string;

    @Column({ name: 'ch_og', nullable: true, length: 191 })
    ch_og!: string;

    @Column({ name: 'champ_visuel_oeil_d', nullable: true, length: 191 })
    champ_visuel_oeil_d!: string;

    @Column({ name: 'champ_visuel_oeil_g', nullable: true, length: 191 })
    champ_visuel_oeil_g!: string;

    @Column({ name: 'date_radio_pul', type: 'datetime', nullable: true })
    date_radio_pul!: Date | null;

    @Column({ name: 'parole_od', nullable: true, length: 191 })
    parole_od!: string;

    @Column({ name: 'parole_og', nullable: true, length: 191 })
    parole_og!: string;

    @Column({ name: 'radio_pul', default: false })
    radio_pul!: boolean;

    @Column({ name: 'resultat_autres_examens', nullable: true, length: 191 })
    resultat_autres_examens!: string;

    @Column({ name: 'resultat_radio_pul', nullable: true, length: 191 })
    resultat_radio_pul!: string;

    // Commentaires
    @Column({ name: 'cardiovasculaire_commentaire', nullable: true, length: 191 })
    cardiovasculaire_commentaire!: string;

    @Column({ name: 'digestif_commentaire', nullable: true, length: 191 })
    digestif_commentaire!: string;

    @Column({ name: 'endocrine_commentaire', nullable: true, length: 191 })
    endocrine_commentaire!: string;

    @Column({ name: 'genital_commentaire', nullable: true, length: 191 })
    genital_commentaire!: string;

    @Column({ name: 'hematologique_commentaire', nullable: true, length: 191 })
    hematologique_commentaire!: string;

    @Column({ name: 'moteur_commentaire', nullable: true, length: 191 })
    moteur_commentaire!: string;

    @Column({ name: 'psychisme_commentaire', nullable: true, length: 191 })
    psychisme_commentaire!: string;

    @Column({ name: 'respiratoire_commentaire', nullable: true, length: 191 })
    respiratoire_commentaire!: string;

    @Column({ name: 'rhino_pharynx_commentaire', nullable: true, length: 191 })
    rhino_pharynx_commentaire!: string;

    @Column({ name: 'systeme_nerveux_commentaire', nullable: true, length: 191 })
    systeme_nerveux_commentaire!: string;

    @Column({ name: 'teguments_commentaire', nullable: true, length: 191 })
    teguments_commentaire!: string;

    @Column({ name: 'urinaire_commentaire', nullable: true, length: 191 })
    urinaire_commentaire!: string;

    @Column({ nullable: true, length: 191 })
    autres!: string;

    @Column({ name: 'autres_commentaire', nullable: true, length: 191 })
    autres_commentaire!: string;

    @Column({ name: 'champ_visuel_oeil_d_commentaire', nullable: true, length: 191 })
    champ_visuel_oeil_d_commentaire!: string;

    @Column({ name: 'champ_visuel_oeil_g_commentaire', nullable: true, length: 191 })
    champ_visuel_oeil_g_commentaire!: string;

    // Audiométrie
    @Column({ name: 'd_1000hz', nullable: true, length: 191 })
    d_1000hz!: string;

    @Column({ name: 'd_2000hz', nullable: true, length: 191 })
    d_2000hz!: string;

    @Column({ name: 'd_3000hz', nullable: true, length: 191 })
    d_3000hz!: string;

    @Column({ name: 'd_500hz', nullable: true, length: 191 })
    d_500hz!: string;

    @Column({ name: 'g_1000hz', nullable: true, length: 191 })
    g_1000hz!: string;

    @Column({ name: 'g_2000hz', nullable: true, length: 191 })
    g_2000hz!: string;

    @Column({ name: 'g_3000hz', nullable: true, length: 191 })
    g_3000hz!: string;

    @Column({ name: 'g_500hz', nullable: true, length: 191 })
    g_500hz!: string;

    @Column({ name: 'perception_couleur_date_examen', nullable: true, length: 191 })
    perception_couleur_date_examen!: string;

    @Column({ name: 'url_scan_autre_examen', nullable: true, length: 191 })
    url_scan_autre_examen!: string;
}