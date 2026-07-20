import {
  boundingViolation,
  assertBoundingInvariant,
  canaryEventType,
  type CanaryProbe,
} from './canary-probe';
import { severityForStatus, CanaryResults } from './canary-result';

describe('canary contract — canary-result', () => {
  it('mapea estado → severidad de forma única', () => {
    expect(severityForStatus('ok')).toBe('info');
    expect(severityForStatus('failed')).toBe('critical');
    expect(severityForStatus('skipped')).toBe('warn');
    expect(severityForStatus('invalid')).toBe('warn');
  });

  it('los constructores fijan el status y NO incluyen durationMs (lo sella el runner)', () => {
    expect(CanaryResults.ok()).toEqual({ status: 'ok' });
    expect(CanaryResults.skipped('credentials_not_configured')).toEqual({
      status: 'skipped',
      reason: 'credentials_not_configured',
    });
    const f = CanaryResults.failed('answer_save', 'HTTP 500', { httpStatus: 500 });
    expect(f).toEqual({ status: 'failed', step: 'answer_save', errorMessage: 'HTTP 500', httpStatus: 500 });
    expect('durationMs' in f).toBe(false);
  });
});

describe('canary contract — eventType canónico', () => {
  it('deriva canary_<name_underscore>_<status>', () => {
    expect(canaryEventType('answer-save', 'failed')).toBe('canary_answer_save_failed');
    expect(canaryEventType('stats-pipeline', 'ok')).toBe('canary_stats_pipeline_ok');
    expect(canaryEventType('smoke-auth', 'skipped')).toBe('canary_smoke_auth_skipped');
  });
});

describe('canary contract — invariante de cota (anti-incidente 11/07)', () => {
  const base = (over: Partial<CanaryProbe>): Pick<CanaryProbe, 'name' | 'writesToProd' | 'bounding'> => ({
    name: 'x',
    writesToProd: false,
    bounding: 'read-only',
    ...over,
  });

  it('read-only sin escritura: OK', () => {
    expect(boundingViolation(base({}))).toBeNull();
  });

  it('write-canary con cota declarada: OK (los 3 moldes)', () => {
    for (const b of ['unique-constraint', 'per-run-cleanup', 'cap-prune'] as const) {
      expect(boundingViolation(base({ writesToProd: true, bounding: b }))).toBeNull();
    }
  });

  it('write-canary SIN cota: VIOLACIÓN (la clase de bug del 11/07)', () => {
    const v = boundingViolation(base({ name: 'stats-pipeline', writesToProd: true, bounding: 'read-only' }));
    expect(v).toContain('stats-pipeline');
    expect(v).toContain('11/07');
  });

  it('declara cota pero dice que no escribe: VIOLACIÓN (incoherente)', () => {
    expect(boundingViolation(base({ writesToProd: false, bounding: 'per-run-cleanup' }))).toContain('incoherente');
  });

  it('assertBoundingInvariant lanza en la primera violación', () => {
    const good = base({ writesToProd: true, bounding: 'per-run-cleanup' });
    const bad = base({ name: 'leaky', writesToProd: true, bounding: 'read-only' });
    expect(() => assertBoundingInvariant([good, good])).not.toThrow();
    expect(() => assertBoundingInvariant([good, bad])).toThrow(/leaky/);
  });
});
