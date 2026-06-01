import { parseSampleResult } from './pool-capacity-sampler.service';

describe('parseSampleResult — helper puro', () => {
  const baseRow = {
    sample_at: '2026-06-01T10:00:00.000Z',
    total_conns: 25,
    active_conns: 3,
    idle_in_tx_over_5s: 0,
    hung_clientread_over_10s: 0,
    frontend_active_conns: 2,
    inserted: true,
  };

  it('parsea correctamente la fila devuelta', () => {
    const r = parseSampleResult([baseRow]);
    expect(r.sampleAt).toBeInstanceOf(Date);
    expect(r.sampleAt.toISOString()).toBe('2026-06-01T10:00:00.000Z');
    expect(r.totalConns).toBe(25);
    expect(r.activeConns).toBe(3);
    expect(r.idleInTxOver5s).toBe(0);
    expect(r.hungClientreadOver10s).toBe(0);
    expect(r.frontendActiveConns).toBe(2);
    expect(r.inserted).toBe(true);
  });

  it('convierte strings a number (defensivo vs drivers)', () => {
    const r = parseSampleResult([
      {
        ...baseRow,
        total_conns: '25' as unknown as number,
        active_conns: '3' as unknown as number,
        idle_in_tx_over_5s: '0' as unknown as number,
      },
    ]);
    expect(r.totalConns).toBe(25);
    expect(r.activeConns).toBe(3);
    expect(r.idleInTxOver5s).toBe(0);
  });

  it('inserted=false es válido (idempotencia ON CONFLICT)', () => {
    const r = parseSampleResult([{ ...baseRow, inserted: false }]);
    expect(r.inserted).toBe(false);
  });

  it('detecta banderas rojas correctamente', () => {
    const r = parseSampleResult([
      { ...baseRow, idle_in_tx_over_5s: 3, hung_clientread_over_10s: 1 },
    ]);
    expect(r.idleInTxOver5s).toBe(3);
    expect(r.hungClientreadOver10s).toBe(1);
  });

  it('lanza si devuelve 0 filas (función SQL siempre devuelve 1)', () => {
    expect(() => parseSampleResult([])).toThrow(/devolvió 0 filas/);
  });

  it('lanza si rows es null/undefined', () => {
    expect(() =>
      parseSampleResult(null as unknown as Parameters<typeof parseSampleResult>[0]),
    ).toThrow(/devolvió 0 filas/);
    expect(() =>
      parseSampleResult(undefined as unknown as Parameters<typeof parseSampleResult>[0]),
    ).toThrow(/devolvió 0 filas/);
  });
});

describe('PoolCapacitySamplerService — contrato', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(
    path.join(__dirname, 'pool-capacity-sampler.service.ts'),
    'utf-8',
  );

  it('llama a take_pool_capacity_sample()', () => {
    expect(content).toMatch(/take_pool_capacity_sample/);
  });

  it('aplica retención 7 días', () => {
    expect(content).toMatch(/RETENTION_DAYS\s*=\s*7/);
    expect(content).toMatch(/prune_pool_capacity_samples/);
  });

  it('exporta parseSampleResult para test unitario directo', () => {
    expect(content).toMatch(/export function parseSampleResult/);
  });

  it('falla silenciosa NO permitida en poda — propaga al cron', () => {
    expect(content).toMatch(/Falla silenciosa NO permitida/);
  });

  it('log compacto (warn) sólo cuando hay banderas rojas', () => {
    // 1.440 logs/día sin valor saturarían CloudWatch. Sólo emitir al
    // detectar idle-in-tx>5s o ClientRead>10s.
    expect(content).toMatch(/hasFlags/);
    expect(content).toMatch(/logger\.warn/);
  });
});

describe('PoolCapacitySamplerCron — contrato', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(
    path.join(__dirname, 'pool-capacity-sampler.cron.ts'),
    'utf-8',
  );

  it('corre cada minuto (EVERY_MINUTE)', () => {
    expect(content).toMatch(/@Cron\(\s*CronExpression\.EVERY_MINUTE/);
  });

  it('threshold heartbeat 3min (3× interval)', () => {
    expect(content).toMatch(/thresholdMs:\s*3\s*\*\s*60_000/);
  });

  it('emite observable_event SÓLO cuando hay banderas rojas (evita ruido)', () => {
    expect(content).toMatch(/hasFlags/);
    expect(content).toMatch(/pool_capacity_flag/);
    // El evento de cron_run sólo se emite en caso de error — NO en cada tick OK.
    expect(content).not.toMatch(/status:\s*'success'/);
  });

  it('aplica jitter 0-3s', () => {
    expect(content).toMatch(/jitter\(3_000\)/);
  });

  it('registrado en HeartbeatRegistry con nombre estable', () => {
    expect(content).toMatch(/heartbeatRegistry\.register\(\s*'pool-capacity-sampler'/);
  });
});
