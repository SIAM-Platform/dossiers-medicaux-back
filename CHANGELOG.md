# Journal des modifications

Toutes les évolutions notables de ce dépôt sont consignées ici.

Format : [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/) ; versions : [versionnement sémantique](https://semver.org/lang/fr/), étiquettes `vX.Y.Z` (voir `docs/pratiques-developpement.md`).

## [Non publié]

Lot `evolution/siam-2.0` (parties 1 à 5 du document des responsabilités de l'éditeur : RGPD, chiffrement des données en base, stockage des fichiers, sécurité applicative, résilience et observabilité). Version proposée à la publication : prochaine version MAJEURE (variables d'environnement et migrations nouvelles), voir `docs/pratiques-developpement.md`.

### Ajouté

- RGPD : registre des traitements produit par le service, durées de conservation paramétrables par pays avec purge (mode rapport par défaut), demandes des personnes (échéance 30 jours) et export par personne.
- Journal d'audit du dossier médical, chaîné et en ajout seul.
- Observabilité : métriques Prometheus (`/metrics`, jeton en production), traces OpenTelemetry, journaux JSON avec identifiant de requête, sondes `/health/live` et `/health/ready`.

### Modifié

- DMGM passe sur PostgreSQL, migrations versionnées et transfert vérifié depuis MySQL.
- Bibliothèque de stockage alignée sur la version commune (noms de fichiers accentués, PDF, migration des anciens dossiers).
- Documents produits par le service (PDF) enregistrés par la bibliothèque de stockage commune.

### Sécurité

- Dossier médical chiffré en base (identité, constantes, examens, tests, vaccins).
- Rattrapage du chiffrement aussi pour les colonnes JSON.
- Accès : permissions fines du socle, contrôle global, erreurs problem+json et corrections relevées par le banc.
- Stockage des fichiers par la bibliothèque SIAM : contrôle du type réel, antivirus ClamAV, empreinte SHA-256, chiffrement par fichier, téléchargement par lien court, accès tracés ; pilote disque ou S3 (`STORAGE_DRIVER`) ; outil `storage:files` de migration et de vérification.
- Validation stricte des entrées : champs non déclarés retirés.
- Sécurité HTTP commune : en-têtes (helmet), limitation de débit, CORS explicite, Swagger fermé en production.
- Chaîne logicielle : workflow « Sécurité » (Semgrep avec `.semgrep/siam.yml`, `npm audit`, SBOM CycloneDX, gitleaks) et workflow « Image » (Trivy, signature cosign, SBOM attesté).

### Corrigé

- Accès : règle anti-escalade ; l'écran des comptes reste ouvert au médecin.
- Panne d'une dépendance (base, antivirus, Keycloak, service appelé) : réponse 503 avec `Retry-After` au lieu de 500, reprise sans redémarrage.

### Ajouté (pratiques de développement)

- Modèle de demande de fusion, fichier `CODEOWNERS` (propriétaires à compléter), notes de version, politique de versions numérotées et workflow « Version » (`docs/pratiques-developpement.md`).
