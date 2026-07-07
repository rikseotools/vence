import { CanaryPsychometricIntegrityService } from './canary-psychometric-integrity.service';

// Mock del db: solo necesitamos db.execute() → filas.
function makeService(rows: unknown) {
  const db = { execute: jest.fn().mockResolvedValue(rows) };
  return new CanaryPsychometricIntegrityService(db as never);
}

describe('CanaryPsychometricIntegrityService', () => {
  it('0 fantasmas → ok (integridad sana)', async () => {
    const r = await makeService([{ phantom: 0 }]).run();
    expect(r.ok).toBe(true);
    expect('phantom' in r && r.phantom).toBe(0);
  });

  it('>0 fantasmas → NO ok (dispara la alerta)', async () => {
    const r = await makeService([{ phantom: 3 }]).run();
    expect(r.ok).toBe(false);
    expect('phantom' in r && r.phantom).toBe(3);
  });

  it('filas vacías → phantom 0 → ok (defensivo)', async () => {
    const r = await makeService([]).run();
    expect(r.ok).toBe(true);
  });

  it('error de BD → ok:false con mensaje (nunca revienta el cron)', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('db down')) };
    const r = await new CanaryPsychometricIntegrityService(db as never).run();
    expect(r.ok).toBe(false);
    expect('error' in r && r.error).toContain('db down');
  });
});
