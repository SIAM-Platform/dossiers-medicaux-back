import { DataSource } from 'typeorm';
import { registry } from '../observability/metrics';
import { AuditChainCheckService } from './audit-chain-check.service';
import { AuditService } from './audit.service';

describe('Contrôle quotidien du journal chaîné', () => {
  it('rupture : entrée AUDIT_CHAIN_BROKEN et métrique à 0', async () => {
    const audit = { verify: jest.fn().mockResolvedValue({ ok: false, entries: 4, brokenAt: 5 }), record: jest.fn().mockResolvedValue(undefined) };
    const r = await new AuditChainCheckService(audit as unknown as AuditService, {} as DataSource).check();
    expect(r.brokenAt).toBe(5);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUDIT_CHAIN_BROKEN', entityId: '5' }));
    expect(await registry.metrics()).toMatch(/siam_integrity_check_ok\{check="audit-chain",service="[^"]+"\} 0/);
  });
  it('journal intègre : métrique à 1, aucune entrée ajoutée', async () => {
    const audit = { verify: jest.fn().mockResolvedValue({ ok: true, entries: 9, brokenAt: null }), record: jest.fn() };
    await new AuditChainCheckService(audit as unknown as AuditService, {} as DataSource).check();
    expect(audit.record).not.toHaveBeenCalled();
    expect(await registry.metrics()).toMatch(/siam_integrity_check_ok\{check="audit-chain",service="[^"]+"\} 1/);
  });
});
