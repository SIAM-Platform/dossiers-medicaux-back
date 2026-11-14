# Permissions fines

DMGM suit le modèle du socle SIAM :

- chaque route déclare la permission qu'elle exige (`@RequirePermission`), ou qu'elle est ouverte
  à tout compte connecté (`@Authenticated`) ou publique (`@Public`) ;
- **une route sans déclaration est refusée** : un oubli ne peut pas ouvrir un accès ;
- les permissions sont attribuées aux rôles dans la table `role_permission`, modifiable par
  l'administrateur (`GET /api/access/matrix`, `PUT /api/access/roles/:nom/permissions`) ;
- chaque refus d'accès et chaque modification de la matrice est inscrit au journal d'audit chaîné ;
- les actions sensibles (conclusion d'une visite, attribution de rôles, matrice, RGPD) exigent une
  authentification forte quand `MFA_ENFORCED=true` (claims `acr` / `amr` du jeton,
  `MFA_ACR_VALUES`).

Le profil courant (`GET /api/users/me`) renvoie les permissions effectives : l'interface affiche
menus et boutons selon ces permissions, le serveur reste seul juge.

## Attribution par défaut

Appliquée une seule fois par rôle, à sa première rencontre (`role_permission_seed`) : une
attribution modifiée ensuite par l'administration n'est jamais écrasée.

| Permission | admin | médecin | infirmier | ci / IT |
|---|:-:|:-:|:-:|:-:|
| Lister marins et visites, tableau de bord | ✓ | ✓ | ✓ | ✓ |
| Consulter, créer, modifier un marin ; ouvrir et saisir une visite | ✓ | ✓ | ✓ | |
| Consulter les référentiels | ✓ | ✓ | ✓ | |
| Autres examens complémentaires ; **conclure une visite** | ✓ | ✓ | | |
| Créer ou modifier un référentiel | ✓ | ✓ | | |
| Lister les infirmiers | ✓ | ✓ | | ✓ |
| Fiches des médecins et infirmiers (consulter, créer, modifier) | ✓ | ✓ | | |
| Comptes : consulter, créer, modifier, attribuer des rôles (règle anti-escalade) | ✓ | ✓ | | |
| Supprimer un marin, une visite, un référentiel, une fiche, un compte | ✓ | | | |
| Matrice des permissions | ✓ | | | |
| Journal d'audit, RGPD | ✓ (et `PRIVACY_OFFICER`) | | | |

Cette attribution reproduit exactement les accès de la version précédente, vérifiés route par
route par le banc avant/après. L'écran « Administration » des comptes reste ouvert au médecin,
mais une **règle anti-escalade** s'applique désormais à tous : on ne peut attribuer un rôle, ni
modifier ou supprimer un compte, qui donne une permission que l'on n'a pas soi-même. Un médecin
gère donc les comptes des infirmiers et des médecins, mais ne peut ni se donner le rôle admin ni
toucher à un compte administrateur.

## Corrections faites au passage (constatées par le banc)

| Situation | Avant | Maintenant |
|---|---|---|
| Supprimer un marin, une visite ou un référentiel encore utilisé | erreur 500 | 409, message explicite |
| Référentiel enregistré avec un libellé vide | erreur 500 | 400, message en français |
| Question d'auto-déclaration saisie depuis l'écran | erreur 500 (noms de champs différents) | enregistrée |
| Question rattachée à une catégorie inexistante | erreur 500 | 422 |
| Liste des visites sans pagination, ou pagination négative | 400 / erreur 500 | valeurs par défaut, bornes |
| Médecin : se donner le rôle admin (attribution, création, ou champ `roles` glissé dans `PUT /users/:id`) | possible (vérifié par le banc) | refusé (403) ou ignoré |
| Médecin : modifier un compte administrateur | possible | refusé (403) |
| Modifier le prénom d'un compte | effaçait le nom et l'e-mail | seuls les champs envoyés changent |

Les erreurs sont au format `application/problem+json` du socle ; les champs `message` et
`statusCode` restent présents pour l'interface.
