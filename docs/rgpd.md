# Protection des données personnelles (RGPD)

Module `src/privacy/` : version autonome du module RGPD des services du socle SIAM, adaptée à ce
service (base MySQL `siam_dmgm`, authentification existante).

## Ce que fait le module

| Besoin | Mise en œuvre |
|---|---|
| Registre des traitements (art. 30) | `GET /privacy/register` (JSON) et `GET /privacy/register.csv`, produits à partir de l'inventaire `src/privacy/inventory.ts` |
| Durées de conservation | `GET /privacy/retention`, `PUT /privacy/retention/:key` (durée et motif, tracés) |
| Purge | `POST /privacy/retention/run`, et chaque nuit (après 02 h UTC) sur une seule copie du service. **Mode rapport par défaut** : le module compte les lignes concernées sans rien supprimer. Suppression ou anonymisation uniquement si `PRIVACY_RETENTION_MODE=apply` |
| Demandes des personnes (art. 12 à 21) | `POST/GET /privacy/requests`, `PATCH /privacy/requests/:id` : référence `DPR-AAAA-NNNNN`, échéance à 30 jours, identité du demandeur chiffrée (AES-256-GCM), réponse obligatoire pour clore |
| Droit d'accès et portabilité | `GET /privacy/subjects/:type/export?ref=` : export JSON des données d'une personne (secrets jamais exportés), tracé |
| Traçabilité | `GET /privacy/audit` : journal `privacy_audit_events` en ajout seul (déclencheur qui refuse modification et suppression). Les données personnelles y sont pseudonymisées (HMAC) |

Les tables `privacy_*` sont créées au démarrage si elles n'existent pas (idempotent, sous verrou).

## Accès

Rôles autorisés par défaut : `PRIVACY_OFFICER` et `admin` (lecture, gestion, export).
L'exploitant peut les remplacer par des listes séparées par des virgules :
`PRIVACY_ROLES_READ`, `PRIVACY_ROLES_MANAGE`, `PRIVACY_ROLES_EXPORT`.
Recommandation : créer le rôle `PRIVACY_OFFICER` (délégué à la protection des données) et lui
réserver `manage` et `export`.

## Configuration

| Variable | Rôle |
|---|---|
| `PRIVACY_RETENTION_MODE` | `report` (défaut) ou `apply` |
| `PRIVACY_PSEUDONYM_KEY` | Clé des pseudonymes du journal (sinon dérivée de `FIELD_ENCRYPTION_KEY`) |
| `FIELD_ENCRYPTION_KEY` | Clé AES-256 (32 octets en base64) du chiffrement des demandes ; obligatoire en production |

## Durées

Les durées par défaut de l'inventaire sont des propositions de l'éditeur, **à valider** par le
responsable de traitement (et, pour les données de santé, par l'autorité sanitaire). Elles se
changent sans redéploiement par `PUT /privacy/retention/:key`.

## Test

```bash
PRIVACY_TEST_DB_TYPE=mysql PRIVACY_TEST_DB_URL=… npx jest --config test/jest-e2e.json privacy
```

Le test exécute chaque condition de purge et chaque exporteur sur le schéma réel, sans rien supprimer.
