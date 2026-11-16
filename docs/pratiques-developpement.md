# Pratiques de développement SIAM

Document commun aux 31 dépôts de la plateforme (15 API NestJS, 16 interfaces Angular / Next.js).
Version de référence : `controle_inspection_back/docs/pratiques-developpement.md` ; les copies des autres
dépôts sont identiques.

Ces pratiques couvrent la revue de code, les branches protégées, les versions numérotées et les notes de
version. Elles sont conçues pour être **compatibles** avec les exigences de développement sécurisé de
l'ISO/IEC 27001:2022 (voir § 8) ; elles ne valent pas conformité : la certification relève d'un audit de
l'organisme qui exploite et maintient la plateforme.

## 1. Branches

| Branche | Rôle | Qui écrit |
|---|---|---|
| `main` | Code publiable. Chaque commit de `main` est construit, analysé, signé (workflow « Image »). | Personne directement : uniquement par demande de fusion acceptée |
| `evolution/<nom>` | Lot d'évolution de plusieurs semaines (ex. `evolution/siam-2.0`) | L'équipe du lot, par commits ou demandes de fusion internes |
| `fonction/<sujet>`, `correctif/<sujet>` | Travail court, une demande de fusion | Le développeur |
| `correctif-securite/<sujet>` | Correctif urgent tiré de la dernière étiquette publiée | Le développeur désigné, revue sécurité obligatoire |

Règles :

- Une demande de fusion = un sujet. Une évolution de schéma de base ou de contrat entre services est
  isolée dans sa propre demande.
- Messages de commit en français, à l'impératif ou au constat, détaillés : ce qui change, pourquoi, ce qui a
  été vérifié. Jamais de secret, de donnée personnelle réelle ni d'identifiant de modèle d'IA.
- On ne réécrit jamais l'historique d'une branche partagée (`main`, `evolution/*`).

## 2. Demande de fusion et revue de code

Toute modification de `main` passe par une demande de fusion qui suit le modèle
`.github/pull_request_template.md` : description, type de changement (effet sur le numéro de version),
tests faits, risques, sécurité et données personnelles, captures si un écran change, notes de version.

Revue :

- **Au moins une approbation** d'une personne autre que l'auteur ; **deux** pour les zones sensibles
  (authentification, permissions, chiffrement, stockage des fichiers, migrations de base, workflows
  `.github/`, règles `.semgrep/`, `Dockerfile`).
- Les propriétaires de code (`.github/CODEOWNERS`) sont demandés automatiquement. **Le fichier est à
  compléter** : les propriétaires restent à confirmer par la direction du projet.
- Le relecteur vérifie au minimum : permission portée par toute nouvelle route (le serveur reste juge),
  absence de donnée personnelle ou médicale en clair dans les journaux, passage des fichiers par la
  bibliothèque de stockage, transitions d'état par le moteur de workflow, textes affichés traduits
  (FR / EN), aucune valeur réglementaire présentée comme vérifiée sans source (« à vérifier »).
- Une approbation devient caduque si de nouveaux commits sont poussés.
- Les conversations ouvertes doivent être résolues avant la fusion.

## 3. Protection de la branche `main` (à appliquer sur GitHub)

> **À appliquer par l'administrateur de l'organisation GitHub SIAM-Platform**, après fusion de
> `evolution/siam-2.0` (les workflows doivent exister sur `main` pour que GitHub propose leurs contrôles).
> Ces réglages n'ont pas été modifiés sur GitHub par l'éditeur.

Méthode recommandée : un **ensemble de règles d'organisation** (*Organization settings → Repository →
Rulesets → New branch ruleset*) ciblant la branche par défaut de tous les dépôts, plutôt que 31 réglages
séparés. À défaut : *Settings → Branches → Add branch protection rule* dans chaque dépôt, motif `main`.

| Réglage GitHub | Valeur |
|---|---|
| Enforcement status | **Active** |
| Target branches | Branche par défaut (`main`) |
| Restrict deletions | Oui |
| Block force pushes | Oui (pas de réécriture d'historique) |
| Require linear history | **Oui** (fusion par *squash* ou *rebase* seulement ; désactiver « Allow merge commits » dans *Settings → General*) |
| Require a pull request before merging | **Oui** — pas de push direct |
| · Required approvals | **1** (2 recommandées sur les dépôts d'API) |
| · Dismiss stale pull request approvals when new commits are pushed | Oui |
| · Require review from Code Owners | Oui, **une fois `CODEOWNERS` complété** |
| · Require approval of the most recent reviewable push | Oui (l'auteur du dernier push ne s'auto-approuve pas) |
| · Require conversation resolution before merging | Oui |
| Require status checks to pass | **Oui**, avec « Require branches to be up to date before merging » |
| Require signed commits | Recommandé (à décider : impose une clé de signature à chaque développeur) |
| Bypass list | Vide. En cas d'urgence, un administrateur désactive la règle, fusionne, la réactive, et l'écart est consigné. |

Contrôles exigés (*Status checks*), noms tels qu'affichés par GitHub :

| Workflow | Contrôle | Dépôts |
|---|---|---|
| Sécurité | `Analyse statique (Semgrep, règles SIAM)` | 31 dépôts |
| Sécurité | `Dépendances et SBOM` | 31 dépôts |
| Sécurité | `Recherche de secrets (historique complet)` | 31 dépôts |
| CI | `Typecheck, tests unitaires et d'intégration, build` | API Gens de mer (Registre, Certification, Livret, Formation, Équipages) et GUM |
| CI | `Compilation AOT stricte (production)` | Interfaces Gens de mer, portail du marin, GUM |
| CI | `docker` | Dépôts dont le workflow CI construit l'image d'essai |
| CI | `Compilation et tests` | Autres dépôts (workflow CI ajouté en partie 6) |

Réglages complémentaires du dépôt (*Settings → General* et *Code security*) :

- Fusion : « Allow squash merging » seul (ou squash + rebase) ; « Automatically delete head branches ».
- *Secret scanning* et *Push protection* activés ; *Dependabot alerts* activés.
- *Actions → General* : « Read repository contents permission » par défaut pour `GITHUB_TOKEN`
  (les workflows déclarent eux-mêmes les droits dont ils ont besoin).
- Étiquettes de version protégées : *Rulesets → New tag ruleset*, motif `v*`, « Restrict deletions »,
  « Block force pushes », création réservée aux mainteneurs.

## 4. Versions numérotées (SemVer)

Chaque dépôt suit le [versionnement sémantique 2.0.0](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

| Incrément | Quand, dans SIAM |
|---|---|
| **MAJEUR** | Changement incompatible pour un utilisateur de la version précédente : route d'API retirée ou dont la forme change, contrat entre services modifié (codes de programme, codes de fonction, événements), variable d'environnement obligatoire ajoutée ou renommée, migration de base non réversible ou qui exige une opération de l'exploitant, permission renommée |
| **MINEUR** | Ajout compatible : nouvel écran, nouvelle route, nouvelle permission, migration additive appliquée automatiquement, variable d'environnement facultative |
| **CORRECTIF** | Correction sans changement de contrat, dont les correctifs de sécurité et les mises à jour de dépendances |

Règles :

- La version figure dans `package.json` (champ `version`) et dans l'étiquette Git `vX.Y.Z` posée sur le
  commit de `main` correspondant. Les deux sont identiques ; le workflow « Version » le vérifie.
- Étiquettes **annotées** (`git tag -a v1.2.0 -m "…"`), signées si les clés sont en place (`-s`).
  Une étiquette publiée n'est jamais déplacée ni supprimée : une erreur se corrige par une nouvelle version.
- Versions de préparation : `1.2.0-rc.1` (recette), jamais déployées en production.
- Chaque dépôt a sa propre suite de versions. La **version de la plateforme** (ex. « SIAM 2.0 ») est une
  liste des versions compatibles de chaque dépôt, tenue dans le dépôt `siam-seafarer-platform` ou dans le
  dossier de livraison.

Première version après fusion de `evolution/siam-2.0` (**proposition, à valider**) : version MAJEURE
suivante de chaque dépôt, car le lot ajoute des variables d'environnement obligatoires en production
(coffre de secrets, clés de chiffrement, stockage) et des migrations de données. Exemples : `0.x` → `1.0.0` ;
`1.0.0` → `2.0.0` ; `3.3.0` → `4.0.0` ; `4.1.0` → `5.0.0`.

### Publier une version

1. Sur une branche, mettre à jour `package.json` (`npm version X.Y.Z --no-git-tag-version`) et transformer
   la rubrique « Non publié » de `CHANGELOG.md` en `## [X.Y.Z] — AAAA-MM-JJ`.
2. Demande de fusion, revue, contrôles au vert, fusion dans `main`.
3. Sur le commit fusionné : `git tag -a vX.Y.Z -m "Version X.Y.Z"` puis `git push origin vX.Y.Z`.
4. Le workflow **Version** (`.github/workflows/version.yml`) vérifie la cohérence étiquette /
   `package.json` / `CHANGELOG.md`, puis publie la *release* GitHub avec les notes de version.
   Le workflow **Image** construit l'image `ghcr.io/siam-platform/<dépôt>:vX.Y.Z`, l'analyse et la signe.
5. L'exploitant déploie l'image étiquetée après vérification de la signature
   (`cosign verify …`, voir l'en-tête de `.github/workflows/image.yml`).

### Correctif de sécurité sur une version publiée

Branche `correctif-securite/<sujet>` tirée de l'étiquette en production, correction + test, version
CORRECTIVE, revue sécurité, fusion dans `main` (et report sur la branche d'évolution en cours), étiquette.
Les délais de correction sont fixés par le contrat de maintenance.

## 5. Notes de version

Chaque dépôt tient un `CHANGELOG.md` au format [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/) :

- une rubrique `## [Non publié]` en tête, complétée **dans la même demande de fusion** que le changement ;
- les rubriques `Ajouté`, `Modifié`, `Déprécié`, `Retiré`, `Corrigé`, `Sécurité` ;
- des phrases compréhensibles par l'exploitant : effet visible, opération à prévoir (variable, migration,
  commande `crypto:keys` ou `storage:files`), sans détail exploitable d'une faille avant sa correction ;
- aucune donnée personnelle, aucun secret, aucun nom de client.

## 6. Contrôles automatiques

| Workflow | Déclenchement | Contenu |
|---|---|---|
| `securite.yml` (Sécurité) | demande de fusion, push sur `main`, chaque lundi | Semgrep avec `.semgrep/siam.yml`, `npm audit` (bloquant sur critique), SBOM CycloneDX, gitleaks sur tout l'historique |
| `ci.yml` (CI) | demande de fusion, push sur `main` | Compilation, tests unitaires (et d'intégration quand ils existent), build de production, contrôle des traductions |
| `image.yml` (Image) | push sur `main`, étiquette `v*.*.*` | Image construite, analysée (Trivy, bloquant sur critique corrigeable), SBOM attesté, signée (cosign) |
| `version.yml` (Version) | étiquette `v*.*.*` | Cohérence étiquette / `package.json` / `CHANGELOG.md`, *release* GitHub avec les notes |

Exception connue : `siam-surete-backend` contient des suites de tests unitaires inachevées qui échouent
déjà ; elles sont lancées par la CI sans bloquer, en attendant leur reprise.

## 7. Environnements et secrets

- Développement, recette et production séparés ; aucune donnée de production en développement
  (jeux de démonstration fictifs : `npm run demo:seed`).
- Aucun secret dans le code : `.env` jamais commité, secrets lus depuis un coffre ou des fichiers montés
  (voir `docs/chiffrement.md`). Un secret commité par erreur est **révoqué**, pas seulement supprimé.
- Les fichiers `src/environments/environment.ts` des interfaces ne contiennent que des adresses publiques.

## 8. Correspondance indicative avec l'ISO/IEC 27001:2022

Correspondance donnée pour faciliter le travail de l'organisme certifié ; **à confirmer par son auditeur**.

| Mesure de l'annexe A (2022) | Pratique SIAM |
|---|---|
| 5.37 Procédures d'exploitation documentées | `docs/exploitation/` du dépôt Inspection |
| 8.4 Accès au code source | Organisation GitHub privée, `main` protégée, propriétaires de code |
| 8.8 Gestion des vulnérabilités techniques | `npm audit` hebdomadaire, Trivy, correctifs de sécurité (§ 4) |
| 8.9 Gestion de la configuration | Versions étiquetées, images signées, configuration par variables documentées |
| 8.25 Cycle de développement sécurisé | Ce document, modèle de demande de fusion, matrice ASVS |
| 8.26 Exigences de sécurité des applications | `docs/securite/asvs.md`, modèle de menaces |
| 8.28 Codage sécurisé | Règles Semgrep SIAM, revue avec liste de contrôle |
| 8.29 Tests de sécurité | Tests des permissions (refus par défaut), contrôles de sécurité de la CI |
| 8.31 Séparation des environnements | § 7 |
| 8.32 Gestion des changements | Demandes de fusion revues, notes de version, étiquettes |

Preuves conservées par GitHub : historique des demandes de fusion et des revues, résultats des
workflows, *releases* et SBOM attachés, signatures des images.
