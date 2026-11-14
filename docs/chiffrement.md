# Chiffrement des données en base

Les champs sensibles sont chiffrés **par l'application, champ par champ** (AES-256-GCM), avant
d'être écrits en base. Une copie de la base ou d'une sauvegarde ne révèle pas ces champs sans les
clés, qui ne sont jamais dans la base en clair. Cette protection s'ajoute au chiffrement des disques
et des sauvegardes, qui relève de l'exploitant.

## Clés : chiffrement d'enveloppe

| Clé | Rôle | Où elle vit | Qui la détient |
|---|---|---|---|
| Clé maître (`FIELD_MASTER_KEY`) | Protège les clés de données, ne chiffre jamais de données | Coffre (Vault, KMS), fichier monté ou variable | **Exploitant** |
| Clés de données | Chiffrent les champs ; une seule est active, les anciennes restent lisibles | Table `crypto_keys` (créée au démarrage), **chiffrées par la clé maître** | Le service, en mémoire |
| Clé d'index aveugle | Empreintes de recherche (voir plus bas) | Table `crypto_keys` (ligne `blind-index`), chiffrée par la clé maître | Le service, en mémoire |
| Ancienne clé (`FIELD_ENCRYPTION_KEY`) | Relit les valeurs écrites avant le trousseau (`enc:v1:`) | Coffre ou variable | Exploitant, jusqu'au re-chiffrement |

Format d'une valeur chiffrée : `enc:v2:<identifiant de la clé>:<base64(iv, tag, texte chiffré)>`.
Chaque valeur dit quelle clé l'a chiffrée : la rotation se fait sans interruption.

Au démarrage, le service lit ses secrets (`src/privacy/secrets.ts`), charge le trousseau et
**refuse de démarrer si la clé maître n'est pas la bonne** (message explicite). Chaque copie recharge
le trousseau toutes les 60 s (`CRYPTO_KEYRING_REFRESH_SECONDS`).

## Secrets : coffre, fichiers montés, environnement

Ordre de lecture, avant tout le reste :

1. `NOM_FILE=/chemin` : secret monté (Docker, Kubernetes, agent Vault). Concerne les noms de secrets
   (terminés par KEY, SECRET, PASSWORD, PASS, TOKEN, CREDENTIALS) et ceux listés dans `SECRET_FILE_VARS`.
2. Coffre HashiCorp Vault, moteur KV v2 : `VAULT_ADDR`, `VAULT_SECRET_PATH` (et `VAULT_KV_MOUNT`,
   `VAULT_NAMESPACE`) ; jeton (`VAULT_TOKEN_FILE`) ou compte de service Kubernetes (`VAULT_K8S_ROLE`).
   Toutes les clés du secret deviennent des variables du service (`FIELD_MASTER_KEY`, `DB_PASSWORD`…).
3. Variable d'environnement.

Une variable déjà fournie n'est pas écrasée (sauf `VAULT_OVERRIDE=true`). Coffre configuré mais
injoignable : le service ne démarre pas. Les journaux citent les **noms** des secrets chargés, jamais
leurs valeurs.

## Administration des clés

```bash
npm run crypto:keys status      # clés et répartition des valeurs par clé (et valeurs encore en clair)
npm run crypto:keys rotate      # nouvelle clé de données active
npm run crypto:keys reencrypt   # re-chiffre avec la clé active tout ce qui ne l'est pas (relançable)
npm run crypto:keys purge       # supprime les clés retirées depuis 24 h et devenues inutiles
npm run crypto:keys rewrap      # changement de clé maître (voir ci-dessous)
```

En production (image construite) : `node dist/privacy/key-admin.js <commande>`.
Chaque opération est inscrite au journal `privacy_audit_events` (`CRYPTO_KEY_ROTATED`, `CRYPTO_DATA_REENCRYPTED`,
`CRYPTO_KEY_DESTROYED`, `CRYPTO_MASTER_KEY_CHANGED`).

**Rotation d'une clé de données** (périodique, ou après un incident) : `rotate`, attendre une minute
(toutes les copies passent à la nouvelle clé), `reencrypt`, puis `purge` le lendemain.

**Changement de clé maître** (départ d'un administrateur, compromission supposée, politique annuelle) :

1. mettre la nouvelle clé dans `FIELD_MASTER_KEY` et l'ancienne dans `FIELD_MASTER_KEY_PREVIOUS` ;
2. `rewrap` : seules les clés de données sont re-chiffrées, en une transaction ; les données ne bougent pas ;
3. redéployer les copies avec la nouvelle clé, puis retirer `FIELD_MASTER_KEY_PREVIOUS`.

Entre l'étape 2 et l'étape 3, les copies en cours gardent leurs clés en mémoire et continuent de
fonctionner ; leur rechargement est seulement signalé en erreur.

**Passage de l'ancien format** (`enc:v1:`) et chiffrement d'une colonne jusque-là en clair :
`reencrypt` traite aussi ces valeurs. Quand `status` ne montre plus ni « v1 » ni « clair »,
`FIELD_ENCRYPTION_KEY` peut être retirée.

## Rechercher sans déchiffrer : index aveugles

`src/privacy/blind-index.ts` :

- **Recherche exacte** (numéro de pièce, téléphone, date de naissance) : on stocke à côté de la
  valeur chiffrée une empreinte HMAC-SHA256 de la valeur normalisée, avec une clé séparée par usage.
  La recherche est une égalité SQL indexée ; l'empreinte ne permet pas de retrouver la valeur.
- **Recherche approchée et doublons** (noms) : empreintes des trigrammes du nom (même découpage que
  pg_trgm). La ressemblance de deux noms est le recouvrement des deux ensembles (indice de Jaccard,
  la formule de `similarity()`), calculable en SQL sans nom en clair. Le score final se calcule sur
  les valeurs déchiffrées des seuls candidats.

Limite assumée : deux valeurs égales ont la même empreinte (c'est ce qui permet la recherche). La clé
d'index est stockée dans le trousseau : un changement de clé maître (`rewrap`) ne modifie pas les
empreintes.

## Colonnes chiffrées

La liste est déduite des entités (transformers `encrypted`, `encryptedNumber`, `encryptedBoolean`,
`encryptedDate`) ; `npm run crypto:keys status` l'affiche avec le nombre de valeurs par clé et le
nombre de valeurs encore en clair.

**Synchronisation automatique du schéma** (`DB_SYNC=true`) : TypeORM supprime et recrée une colonne
dont le type change, ce qui effacerait les données. `prepareEncryptedColumns`
(`src/privacy/schema-prep.ts`) convertit donc d'abord les colonnes chiffrées en TEXT avec
`ALTER … MODIFY`, qui conserve les valeurs ; la synchronisation ne voit ensuite aucune différence.
Les valeurs existantes sont chiffrées au démarrage suivant (rattrapage par lots, une seule copie).

## Dossiers médicaux (DMGM) : données chiffrées

| Table | Chiffré | Index aveugle | En clair (justification) |
|---|---|---|---|
| `marin` | nom, prénom, date et lieu de naissance, téléphone, e-mail, adresse, CNI, n° d'inscription maritime, situation familiale et professionnelle, victime de guerre, accident du travail, handicap | `numero_ins_mar_index`, `numero_cni_index` (unicité, recherche exacte), `nom_index` (trigrammes) | sexe, nationalité |
| `constante` | taille, poids, IMC, fréquence respiratoire, albumine, tension, sucre, pouls, température, test de grossesse | — | date de prise |
| `examenclinique` | tous les résultats et commentaires (vision, audition, appareils, radio…) | — | date de l'examen |
| `test_drogue` | tous les résultats, laboratoire, date d'analyse | — | — |
| `vaccination` | vaccins et dates | — | — |
| `examcomplementaire` | type et résultat | — | date |
| `reponseautodeclaration`, `commentairecategorie` | réponses et commentaires | — | question, catégorie |
| `conclusion` | commentaires du médecin | — | **décision d'aptitude** (partagée avec les Titres) |

Vérifié sur une copie du jeu de démonstration : 2 193 valeurs relues identiques avant et après la
mise à niveau, aucune colonne supprimée par la synchronisation (`test/medical-encryption.e2e-spec.ts`
pour le test automatisé).
