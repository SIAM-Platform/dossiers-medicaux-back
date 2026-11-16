import { redactAttributes, tracesEndpoint } from './tracing';
import { recordIntegrity, recordJob, registry } from './metrics';
import { jsonLogs } from './logger';

describe('Observabilité commune', () => {
  it('traces : aucune chaîne de requête ni paramètre SQL exporté', () => {
    const a = redactAttributes({ 'http.target': '/api/marins?q=Ndiaye', 'url.query': 'q=Ndiaye', 'http.url': 'http://x/api/m?nom=Fall', 'db.statement.parameters': '["Fall"]', 'http.method': 'GET' });
    expect(a).toEqual({ 'http.target': '/api/marins', 'http.url': 'http://x/api/m', 'http.method': 'GET' });
  });
  it('traces : inactives sans collecteur', () => {
    expect(tracesEndpoint({})).toBeNull();
    expect(tracesEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318/' })).toBe('http://c:4318/v1/traces');
    expect(tracesEndpoint({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318', OTEL_SDK_DISABLED: 'true' })).toBeNull();
  });
  it('métriques des tâches et des contrôles d’intégrité', async () => {
    recordJob('test-job', true, 1200);
    recordIntegrity('decision-chain', false);
    const text = await registry.metrics();
    expect(text).toMatch(/siam_job_runs_total\{job="test-job",result="success",service="[^"]+"\} 1/);
    expect(text).toMatch(/siam_integrity_check_ok\{check="decision-chain",service="[^"]+"\} 0/);
  });
  it('journaux JSON par défaut en production', () => {
    expect(jsonLogs({ NODE_ENV: 'production' })).toBe(true);
    expect(jsonLogs({ NODE_ENV: 'development' })).toBe(false);
    expect(jsonLogs({ LOG_FORMAT: 'json' })).toBe(true);
  });
});
