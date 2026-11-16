# Observabilité

Module commun aux 15 services SIAM (`src/observability/`, identique partout ; seul `service.ts`
porte le nom du service). Aucune donnée personnelle n'est ajoutée aux métriques, traces ou journaux.

## Ce que le service expose

| Point | Rôle | Accès |
|---|---|---|
| `/health/live` | le processus répond | libre (sonde du conteneur) |
| `/health/ready` | la base répond en moins de 2 s (503 sinon) | libre (répartiteur de charge) |
| `/metrics` | métriques Prometheus | en production : `Authorization: Bearer <METRICS_TOKEN>`, sinon 404 |

Inspection, GUM et les services gens de mer gardent leurs propres sondes `/health/live` et
`/health/ready` (mêmes chemins, mêmes règles).

## Métriques

| Métrique | Contenu |
|---|---|
| `http_server_request_duration_seconds{method,route,status_code}` | durée et nombre des requêtes, par route déclarée (jamais l'URL brute) |
| `siam_job_runs_total{job,result}`, `siam_job_duration_seconds{job}`, `siam_job_last_success_timestamp_seconds{job}` | tâches de fond réellement exécutées (verrou obtenu) |
| `siam_integrity_check_ok{check}`, `siam_integrity_last_check_timestamp_seconds{check}` | contrôle quotidien de la chaîne des décisions (`decision-chain`) ou du journal chaîné (`audit-chain`, DMGM) |
| `siam_ready` | 1 si la base répond (services dont le module gère la sonde) |
| `process_*`, `nodejs_*` | mémoire, processeur, boucle d'événements, ramasse-miettes |

Chaque métrique porte l'étiquette `service`. Seuils d'alerte de départ :
`docs/exploitation/alertes-prometheus.yml` du dépôt Inspection.

## Traces (OpenTelemetry)

Actives seulement si un collecteur est configuré :

| Variable | Rôle |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | collecteur OTLP/HTTP (ex. `http://otel-collector:4318`) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | adresse complète des traces, si différente |
| `OTEL_SERVICE_NAME` | remplace le nom du service |
| `OTEL_SDK_DISABLED=true` | coupe les traces |

Spans produits : requêtes HTTP entrantes et sortantes, routes NestJS, requêtes PostgreSQL. Ni les
paramètres SQL ni la chaîne de requête des URL (recherches par nom, etc.) ne sont exportés. Les
sondes et `/metrics` ne sont pas tracées.

## Journaux

`LOG_FORMAT=json` (défaut en production) : une ligne JSON par message, avec `time`, `level`,
`service`, `context`, `message`, `request_id` (en-tête `X-Request-Id`, repris ou créé et renvoyé au
client) et `trace_id`. `LOG_LEVEL=debug` ajoute les niveaux de mise au point.

## Plusieurs copies

Chaque tâche de fond prend un verrou PostgreSQL (`pg_try_advisory_lock`) : une seule copie
l'exécute, les autres sautent ce tour. Les migrations au démarrage sont aussi sous verrou.

## Vérifier en local

```bash
curl -s localhost:3000/health/ready
curl -s localhost:3000/metrics | grep siam_       # hors production, sans jeton
```
