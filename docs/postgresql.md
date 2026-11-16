# Passage de MySQL à PostgreSQL

Depuis la version 2.0, DMGM utilise **PostgreSQL**, comme les autres applications SIAM. La
configuration est la même que dans le socle (`src/config/database.config.ts`) : `synchronize`
toujours désactivé, schéma créé et modifié **uniquement par des migrations versionnées**
(`src/migrations`), appliquées au démarrage (`RUN_MIGRATIONS_ON_START=false` pour les lancer à part
avec `npm run migration:run:prod`). Les noms de tables et de colonnes sont ceux de la version MySQL :
l'API et l'interface ne changent pas.

## Variables

| Variable | Exemple |
|---|---|
| `DB_HOST`, `DB_PORT` | `postgres`, `5432` |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | `siam`, (secret, coffre ou `DB_PASSWORD_FILE`), `siam_dmgm` |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED` | `true`, `true` |
| `DB_POOL_MAX` | `20` |
| `RUN_MIGRATIONS_ON_START` | `true` (défaut) |

`DB_SYNC` n'existe plus.

## Bascule d'une installation existante (une seule fois)

1. Arrêter DMGM (plus aucune écriture dans MySQL). Sauvegarder la base MySQL.
2. Créer la base PostgreSQL vide (`CREATE DATABASE siam_dmgm`).
3. Lancer le transfert, avec la **même clé maître** (`FIELD_MASTER_KEY`) que l'ancienne version :

   ```bash
   MYSQL_HOST=… MYSQL_PORT=3306 MYSQL_USER=… MYSQL_PASSWORD=… MYSQL_DB=siam_dmgm \
   DB_HOST=… DB_PORT=5432 DB_USERNAME=… DB_PASSWORD=… DB_NAME=siam_dmgm \
   node dist/scripts/mysql-to-postgres.js
   ```

   L'outil applique les migrations, refuse d'écrire dans une base qui contient déjà des données,
   copie toutes les tables (identifiants, valeurs chiffrées, clés de chiffrement protégées par la
   clé maître, journal d'audit chaîné, données RGPD) dans **une seule transaction**, recale les
   compteurs, puis **relit les deux bases et compare chaque ligne de chaque table**. Il se termine
   par « Transfert terminé et vérifié » (code 0) ou par la liste des écarts (code 1, la base
   PostgreSQL est alors à recréer). MySQL n'est jamais modifié.
   **Base de la version 1 (branche `main`, données en clair)** : le transfert accepte aussi cette
   base (pas de trousseau ni de journal d'audit : les tables correspondantes restent vides). Les
   données sont copiées telles quelles et **chiffrées au premier démarrage** de la 2.0, qui exige
   alors la clé (`FIELD_ENCRYPTION_KEY` ou `FIELD_MASTER_KEY`). Essai sur une base au schéma de
   `main` (40 marins, 89 visites) : transfert vérifié, 1 265 valeurs chiffrées au démarrage,
   lectures de l'API identiques à `main` (sauf ajouts attendus : permissions dans `/users/me`).
   **Sans accès à une ligne de commande avant le démarrage (Coolify)** : ajouter au service les
   variables `MYSQL_*` ci-dessus et `MYSQL_TRANSFER_ON_START=true`. Au démarrage, **avant**
   l'application, le service fait le transfert et sa vérification, puis pose une marque (table
   `mysql_transfer`) : les démarrages suivants l'ignorent. En cas d'écart, ou si la base
   PostgreSQL contient déjà des données (service démarré une fois sans cette variable), le service
   ne démarre pas et n'écrit rien : recréer la base vide. Retirer ensuite `MYSQL_TRANSFER_ON_START`
   et les variables `MYSQL_*`.
4. Démarrer DMGM sur PostgreSQL, puis vérifier le journal : `GET /api/audit/verify` doit répondre
   `ok: true` avec le même nombre d'entrées.
5. Conserver la sauvegarde MySQL jusqu'à la fin de la recette.

## Ce qui a été vérifié (banc avant/après)

Sur une copie de la base de démonstration, l'ancienne version (MySQL) et la nouvelle
(PostgreSQL, après transfert) ont été interrogées route par route, avec sept profils (anonyme,
compte inconnu, sans rôle, admin, médecin, infirmier, admin + médecin) :

- 364 lectures : contenus identiques (empreinte du corps de réponse), sauf l'export RGPD d'un marin
  où `reconvocation` vaut désormais `false` au lieu de `0` (même valeur que l'API des visites) ;
- 308 écritures (création, modification, suppression) : statuts identiques ;
- transfert : 28 tables identiques ligne par ligne ; chaîne d'audit intacte.

L'ordre des rôles d'un compte est désormais fixé (par identifiant) : PostgreSQL ne garantit
aucun ordre sans tri explicite.
