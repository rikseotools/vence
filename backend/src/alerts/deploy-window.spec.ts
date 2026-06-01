import { evaluateDeployWindow, type DeployWindowRow } from './deploy-window';

describe('evaluateDeployWindow', () => {
  const row = (over: Partial<DeployWindowRow> = {}): DeployWindowRow[] => [
    { frontendVersions: 1, dbReadyWarmup: 0, deployFailed: 0, ...over },
  ];

  it('inactiva con 1 sola versión y sin warmup ni deploy fallido', () => {
    const w = evaluateDeployWindow(row());
    expect(w.active).toBe(false);
    expect(w.reasons).toEqual([]);
  });

  it('activa por rolling: ≥2 versiones de frontend sirviendo', () => {
    const w = evaluateDeployWindow(row({ frontendVersions: 2 }));
    expect(w.active).toBe(true);
    expect(w.reasons.join(' ')).toContain('frontend_rolling');
  });

  it('activa por warmup: db-ready devolvió 503', () => {
    const w = evaluateDeployWindow(row({ dbReadyWarmup: 3 }));
    expect(w.active).toBe(true);
    expect(w.reasons.join(' ')).toContain('db_ready_warmup');
  });

  it('activa por deploy fallido (gha)', () => {
    const w = evaluateDeployWindow(row({ deployFailed: 1 }));
    expect(w.active).toBe(true);
    expect(w.reasons.join(' ')).toContain('deploy_failed');
  });

  it('acumula múltiples razones', () => {
    const w = evaluateDeployWindow(
      row({ frontendVersions: 2, dbReadyWarmup: 5 }),
    );
    expect(w.active).toBe(true);
    expect(w.reasons).toHaveLength(2);
  });

  it('fail-open: filas vacías → inactiva (no suprime nada)', () => {
    const w = evaluateDeployWindow([]);
    expect(w.active).toBe(false);
  });
});
