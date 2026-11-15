# Chaîne logicielle sécurisée

Mêmes contrôles dans tous les dépôts SIAM (workflows `.github/workflows/`).

| Contrôle | Outil | Bloquant | Quand |
|---|---|---|---|
| Analyse statique du code (SAST) | Semgrep, règles SIAM versionnées dans `.semgrep/siam.yml` | gravité ERROR | chaque PR, `main`, chaque lundi |
| Dépendances vulnérables | `npm audit` (dépendances de production) | vulnérabilité critique | idem |
| Inventaire des composants (SBOM) | CycloneDX (`sbom.cdx.json`, artefact) | — | idem |
| Secrets dans l'historique | gitleaks | tout secret trouvé | idem |
| Analyse de l'image | Trivy | vulnérabilité critique corrigeable | publication de l'image (`main`) |
| Signature de l'image et SBOM attesté | cosign (sans clé, identité OIDC du workflow) | — | publication de l'image |

## Règles d'analyse

Les règles sont dans le dépôt (aucun registre externe) : exécution de code dynamique, commande
shell construite, donnée de requête interpolée dans du SQL, TLS désactivé, jeton accepté sans
vérification complète, CORS ouvert, `synchronize: true`, ValidationPipe sans `whitelist`
(bloquantes) ; contournement du nettoyage Angular, HTML injecté, MD5 / SHA-1, `Math.random`
pour un secret (avertissements) ; SQL assemblé par interpolation (inventaire à relire).

Lancement local : `pip install semgrep` puis
`semgrep scan --config .semgrep/siam.yml --metrics=off src`.
Une exception se justifie sur place : `// nosemgrep: <règle> — raison`.

## Vérifier une image avant de la déployer

```bash
cosign verify ghcr.io/siam-platform/<image>:main \
  --certificate-identity-regexp '^https://github.com/SIAM-Platform/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## À configurer par l'administrateur du dépôt

- Branche `main` protégée : revue obligatoire et contrôles « Sécurité » exigés avant fusion.
- Déploiement (Coolify) depuis l'image signée du registre plutôt que par construction sur le
  serveur ; refus d'une image dont la signature ne se vérifie pas (à vérifier selon l'outil).
