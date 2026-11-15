# Stockage des fichiers — bibliothèque SIAM

Les fichiers déposés (scans, pièces, photos, documents) passent par la **bibliothèque de stockage
SIAM** (`src/storage/`), identique dans les 15 services. Seul `storage.adapter.ts` est propre au
service : il la relie au journal d'audit, au trousseau de clés et aux droits.

## Où sont les fichiers : un réglage d'installation

Le lieu de stockage se choisit **par configuration**, jamais depuis l'interface :

| Variable | Rôle | Défaut |
|---|---|---|
| `STORAGE_DRIVER` | `local` (disque du serveur) ou `s3` (stockage objet : MinIO ou Ceph sur site, ou cloud) | `local` |
| `STORAGE_LOCAL_PATH` | dossier du disque local, **jamais publié par un serveur web** | `./storage-data` |
| `S3_ENDPOINT` | adresse du stockage objet (vide pour AWS) | — |
| `S3_BUCKET` | compartiment, de préférence **un par service** | — |
| `S3_REGION` | région | `us-east-1` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | identifiants ; lus aussi depuis `*_FILE` ou Vault, jamais en clair dans un fichier | — |
| `S3_FORCE_PATH_STYLE` | `true` pour MinIO | `true` |
| `STORAGE_PREFIX` | préfixe des objets | nom du service |
| `UPLOAD_MAX_MB` | plafond global de taille | `100` |
| `CLAMAV_HOST`, `CLAMAV_PORT` | antivirus clamd | — , `3310` |
| `STORAGE_ANTIVIRUS` | `required` : tout dépôt est refusé si l'antivirus est absent ou ne répond pas | `required` en production |
| `STORAGE_LINK_TTL_SECONDS` | durée de validité d'un lien de téléchargement | `300` |

Changer de cible ne touche pas au code : on modifie `STORAGE_DRIVER`, puis on lance
`storage:files migrate` (voir plus bas).

**Recommandation de production** : stockage objet séparé des serveurs d'application, répliqué et
sauvegardé (MinIO, logiciel libre, ou un cloud qualifié). Le disque local convient au développement,
aux démonstrations et aux petits pilotes, avec une copie de sauvegarde hors du serveur.

## Dépôt d'un fichier

Contrôles dans cet ordre ; au premier échec, le fichier est refusé et le refus est tracé :

1. **type réel** déterminé à partir du contenu (liste blanche par usage), et cohérence de
   l'extension : un PDF nommé `photo.jpg`, ou un programme présenté comme une image, est refusé
   (415) ;
2. **taille** (413) ;
3. **antivirus** clamd : fichier infecté refusé (422), antivirus injoignable refusé (503) ;
4. **empreinte SHA-256** du contenu ;
5. **chiffrement AES-256-GCM** avec une clé propre au fichier ; cette clé est conservée en base,
   chiffrée par la clé de données du service (chiffrement d'enveloppe, partie 2) ;
6. **envoi** au stockage. Le stockage ne reçoit que du contenu chiffré, sans nom ni type parlant.

## Ouverture d'un fichier

- Le service vérifie les droits : permission enregistrée avec le fichier (`read_permission`), ou
  contrôle fait par la route métier.
- Il délivre un **lien court et signé** (`POST /files/:id/link`), valable quelques minutes.
- Au téléchargement (`GET /files/download/:jeton`), le fichier est déchiffré et son empreinte
  vérifiée : un fichier altéré dans le stockage est détecté et refusé.
- Le nom du fichier est fixé par SIAM. Les en-têtes `nosniff`, `no-store` et une CSP `sandbox`
  empêchent toute exécution dans le navigateur.
- Les liens sont signés avec une clé dérivée de la clé maître : toutes les copies du service les
  acceptent.

## Traçabilité

Inscrits au journal du service, sans aucun contenu : dépôt (`FICHIER_DEPOSE`), refus
(`FICHIER_REFUSE`), lien émis ou refusé (`FICHIER_LIEN`, `FICHIER_ACCES_REFUSE`), téléchargement
avec l'adresse IP (`FICHIER_TELECHARGE`), suppression, altération détectée, migrations.

## Outils d'exploitation

`npm run storage:files <commande>` (image construite : `node dist/storage/storage-cli.js <commande>`)

| Commande | Effet |
|---|---|
| `status` | cible, antivirus, nombre de fichiers par stockage et par chiffrement |
| `migrate [--dry-run] [--delete-source]` | copie (et chiffre) chaque fichier vers la cible configurée, relit la copie et compare l'empreinte avant de basculer ; relançable |
| `verify` | relit tous les fichiers et contrôle leur empreinte |
| `sweep [--dry-run]` | retire du stockage les objets sans fichier enregistré (après une purge RGPD, ou une copie interrompue) |
| `import-legacy [--dry-run] [--delete-source]` | reprend les fichiers enregistrés avant la bibliothèque (voir la section propre au service) |

La rotation des clés (`crypto:keys rotate`, puis `reencrypt`) re-chiffre aussi les clés des
fichiers, sans re-chiffrer les fichiers.

## RGPD

- Une purge supprime la ligne du fichier et sa clé : le contenu chiffré devient définitivement
  illisible (effacement cryptographique). `storage:files sweep` retire ensuite l'objet du stockage.
- `stored_files` figure dans le registre des traitements du service.

## Sauvegarde

Sauvegarder **ensemble** : la base (table `stored_files`, qui contient les clés des fichiers
chiffrées), le stockage (dossier local ou compartiment) et, **séparément**, la clé maître. Les
fichiers sauvegardés restent chiffrés : la copie peut être placée hors du serveur sans risque de
lecture.

## À vérifier par l'exploitant

- clamd limite par défaut la taille analysée à 25 Mo (`StreamMaxLength`) : la régler au moins à
  `UPLOAD_MAX_MB`, sinon les gros fichiers sont refusés (antivirus en erreur).
- Signatures antivirus réelles : `freshclam` doit pouvoir mettre à jour clamd. Les essais ont été
  faits avec le vrai moteur ClamAV et une signature de test (EICAR), sans accès aux bases de
  signatures officielles.
- Les essais S3 ont été faits avec un émulateur compatible S3. Un essai sur le MinIO de production
  reste à faire (`storage:files status` puis `verify`).
- La neutralisation du contenu actif des documents (PDF, Office) n'est pas faite : l'antivirus ne
  détecte que les menaces connues.

## Propre à DMGM

- Fichiers concernés : scans et comptes rendus des « autres examens » (images, PDF, Word `.docx`,
  20 Mo au plus). Lien délivré aux comptes ayant `visite.read`.
- La colonne `examenclinique.url_scan_autre_examen` contient la référence `siam-file:<id>`.
- **Correction de sécurité** : ces fichiers étaient servis **sans connexion** sous `/uploads/`. Cet
  accès est fermé.
- **Correction** : le formulaire de modification « Autre examen » envoyait le fichier à une route
  qui l'ignorait ; il passe désormais par `PUT /visites/:id/autre-examen` et ses contrôles.
- **Reprise à la mise en production** : `npm run storage:files import-legacy --dry-run`, puis
  `import-legacy`, puis `verify`. Les anciens fichiers sont lus dans `uploads/` (ou
  `LEGACY_UPLOADS_DIR`). Tant qu'un fichier n'est pas repris, l'interface affiche « Fichier en
  attente de reprise ». `--delete-source` supprime les originaux une fois repris.
- Purge RGPD : les scans suivent la durée de conservation du dossier médical détaillé (20 ans,
  proposition à valider).
