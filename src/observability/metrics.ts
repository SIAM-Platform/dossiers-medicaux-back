import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { SERVICE_NAME } from './service';

/** Métriques Prometheus du service (exposées sur /metrics). */
export const registry = new Registry();
registry.setDefaultLabels({ service: SERVICE_NAME });
collectDefaultMetrics({ register: registry });

export const httpDuration = new Histogram({
  name: 'http_server_request_duration_seconds',
  help: 'Durée des requêtes HTTP (route déclarée, jamais l’URL brute)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const jobRuns = new Counter({ name: 'siam_job_runs_total', help: 'Exécutions des tâches de fond', labelNames: ['job', 'result'], registers: [registry] });
const jobDuration = new Histogram({ name: 'siam_job_duration_seconds', help: 'Durée des tâches de fond', labelNames: ['job'], buckets: [0.1, 1, 5, 30, 60, 300, 900], registers: [registry] });
const jobLastSuccess = new Gauge({ name: 'siam_job_last_success_timestamp_seconds', help: 'Dernière réussite de chaque tâche de fond', labelNames: ['job'], registers: [registry] });
const integrityOk = new Gauge({ name: 'siam_integrity_check_ok', help: '1 si le dernier contrôle d’intégrité est bon, 0 sinon', labelNames: ['check'], registers: [registry] });
const integrityLast = new Gauge({ name: 'siam_integrity_last_check_timestamp_seconds', help: 'Date du dernier contrôle d’intégrité', labelNames: ['check'], registers: [registry] });

/** À appeler à la fin de chaque tâche de fond réellement exécutée (verrou obtenu). */
export function recordJob(job: string, ok: boolean, durationMs: number): void {
  jobRuns.inc({ job, result: ok ? 'success' : 'failure' });
  jobDuration.observe({ job }, durationMs / 1000);
  if (ok) jobLastSuccess.set({ job }, Date.now() / 1000);
}

/** Résultat d'un contrôle d'intégrité (chaîne des décisions, journal chaîné…). */
export function recordIntegrity(check: string, ok: boolean): void {
  integrityOk.set({ check }, ok ? 1 : 0);
  integrityLast.set({ check }, Date.now() / 1000);
}
