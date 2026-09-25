# Intégration SIAM Gens de mer — statut minimal d'aptitude

DMGM reste la seule source de vérité de l'aptitude médicale. Les applications SIAM
(Titres & Certifications, Registre des gens de mer) consultent **uniquement** un statut
minimal, calculé ici. Aucune donnée médicale (diagnostic, antécédents, constantes,
examens, vaccinations, tests, commentaires, auto-déclaration) ne sort de DMGM par ce canal.

## Endpoint

`GET /api/integrations/siam/fitness?nim=…&cni=…&patientId=…` (au moins un identifiant)

| Paramètre | Correspondance |
|---|---|
| `nim` | `marin.numero_ins_mar` (numéro d'inscription maritime) |
| `cni` | `marin.numero_cni` |
| `patientId` | `marin.id` (identifiant `DMGM_PATIENT` enregistré au Registre) |

Réponse `200` (`Cache-Control: no-store`) :

```json
{
  "status": "FIT",
  "certificateNumber": "APT-2026-0001",
  "visitReference": "VM-12",
  "issuedAt": "2026-03-02",
  "expiryDate": "2028-03-01",
  "expiryRecorded": true,
  "verifiedAt": "2026-09-25T17:59:43.549Z"
}
```

`404` si le marin est inconnu, `400` sans identifiant, `401` / `403` si l'appelant n'est pas habilité.

## Règles de calcul (`src/integrations/siam/fitness.projection.ts`, testées)

| Situation | Statut |
|---|---|
| Aucune visite | `NONE` |
| Dernière visite conclue « inapte » | `UNFIT` (sans date de validité) |
| Dernière visite conclue « apte », validité non dépassée | `FIT` |
| Dernière visite conclue « apte », validité dépassée | `EXPIRED` (ou `PENDING` si une visite est en cours) |
| Aucune visite conclue (visite en cours, examens complémentaires) | `PENDING` |

Une visite de renouvellement en cours ne retire pas une aptitude encore valide. La validité
est la `date_expiration` du certificat `aptitude_aller_en_mer` de la visite, à défaut celle
de la visite. **Si aucune n'est enregistrée**, `expiryRecorded` vaut `false` et
`expiryDate` `null` : Titres & Certifications considère alors l'exigence médicale comme
inconnue (bloquante). Dans la version actuelle de DMGM, aucun écran ne renseigne ces dates :
c'est à compléter pour que les aptitudes soient exploitables par SIAM.

Les requêtes ne sélectionnent que `visitemedicale (id, date_visite, status, date_expiration)`,
`conclusion (visite_id, decision, date_conclusion)` et
`certificat (visite_id, type_certificat, numero_matricule, date_emission, date_expiration)`.

## Authentification (machine à machine)

Distincte de celle des agents DMGM (comptes locaux par email) :

1. **Jeton Keycloak** « client credentials » émis par `SIAM_INTEGRATION_ISSUER`
   (par défaut le realm DMGM), dont le client (`azp`) figure dans `SIAM_INTEGRATION_CLIENTS`.
   Exemple : `SIAM_INTEGRATION_ISSUER=https://auth.siam-platform.com/realms/siam-realm`,
   `SIAM_INTEGRATION_CLIENTS=siam-certification-api,siam-registry-api`.
2. **Clé partagée** `SIAM_INTEGRATION_API_KEY` (32 caractères minimum, secret), présentée dans
   l'en-tête `X-Api-Key` (côté Titres : `DMGM_API_KEY`). Pour le développement ou un
   raccordement transitoire ; préférer Keycloak en production.

Sans l'une de ces configurations, tout appel est refusé. Chaque consultation est journalisée
(application appelante, identifiant interne du marin, statut), jamais l'identifiant présenté.

## Variables d'environnement

```
SIAM_INTEGRATION_ISSUER=        # vide = realm DMGM (KEYCLOAK_SERVER_URL/realms/KEYCLOAK_REALM)
SIAM_INTEGRATION_CLIENTS=       # clients Keycloak habilités, séparés par des virgules
SIAM_INTEGRATION_API_KEY=       # optionnel, 32 caractères minimum, jamais versionné
```
