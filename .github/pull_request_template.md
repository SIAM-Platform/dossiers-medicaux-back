<!--
Modèle de demande de fusion SIAM. Remplir chaque rubrique ; écrire « sans objet » plutôt que supprimer.
Règles : docs/pratiques-developpement.md. Ne jamais coller de secret, de jeton ni de donnée personnelle réelle.
-->

## Description

<!-- Ce qui change et pourquoi. Lien vers l'exigence, le ticket ou la ligne du document des responsabilités. -->

## Type de changement

- [ ] Correctif (version CORRECTIVE : X.Y.**Z**)
- [ ] Fonctionnalité compatible (version MINEURE : X.**Y**.0)
- [ ] Changement incompatible : API, schéma de base, contrat entre services, variable d'environnement (version MAJEURE : **X**.0.0)
- [ ] Documentation, tests ou outillage seulement

## Tests faits

<!-- Commandes lancées et résultat. Exemples : npx tsc --noEmit, npm test, npm run test:e2e, build de production, node scripts/i18n-check.mjs, parcours manuel. -->

- [ ] Compilation sans erreur
- [ ] Tests unitaires / d'intégration passés (ou écart expliqué ci-dessous)
- [ ] Nouvelle règle ou correction couverte par un test
- [ ] Migration de base essayée à l'aller (et au retour si `down` fourni)

## Risques

<!-- Ce qui peut casser, services touchés, compatibilité avec les autres applications SIAM, plan de retour arrière. -->

## Sécurité et données personnelles

- [ ] Aucune donnée personnelle ou médicale nouvelle ; sinon : registre des traitements et durée de conservation mis à jour
- [ ] Aucune donnée personnelle en clair dans les journaux, l'audit, les traces ou les messages d'erreur
- [ ] Toute nouvelle route porte une permission (`@RequirePermission` / `@Authenticated`) ; le serveur reste juge
- [ ] Fichiers reçus : bibliothèque de stockage SIAM (contrôles, antivirus, chiffrement)
- [ ] Aucun secret, `.env`, jeton ni mot de passe dans le code ou l'historique
- [ ] Contrôles « Sécurité » (Semgrep, npm audit, gitleaks) au vert

<!-- Préciser ici tout point sensible : nouvelle dépendance, nouveau flux réseau, élargissement de droits, valeur réglementaire « à vérifier ». -->

## Captures (si écran modifié)

<!-- Avant / après, en français et en anglais. Données fictives uniquement. Accessibilité : focus visible, libellés, contrastes. -->

## Notes de version

- [ ] `CHANGELOG.md` complété dans la rubrique « Non publié »
