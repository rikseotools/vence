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
  // ── LA FORMA QUE DEVUELVE EL DRIVER, QUE ES LO QUE MATÓ ESTE CRON 28 DÍAS ────────────────
  // `db.execute()` unas veces da la lista de filas y otras un `{ rows: [...] }`. Con la segunda,
  // `rows.length` es `undefined`, así que la guarda de «0 filas» no saltaba (`undefined === 0` es
  // falso) y reventaba en la línea siguiente con «Cannot read properties of undefined (reading
  // 'sample_at')». Medido: fallando así desde el 10/07 — 28 días sin muestrear el pool.
  //
  // Todos los casos de arriba pasan un ARRAY, así que la suite daba verde con el cron muerto.
  describe('acepta las dos formas del driver', () => {
    const fila = {
      sample_at: '2026-06-01T10:00:00.000Z',
      total_conns: 25,
      active_conns: 3,
      idle_in_tx_over_5s: 0,
      hung_clientread_over_10s: 0,
      frontend_active_conns: 2,
      inserted: true,
    };

    it('la forma { rows: [...] } se parsea igual que el array', () => {
      const r = parseSampleResult({ rows: [fila] });
      expect(r.totalConns).toBe(25);
      expect(r.sampleAt.toISOString()).toBe('2026-06-01T10:00:00.000Z');
    });

    it('{ rows: [] } da el error CLARO de 0 filas, no un TypeError críptico', () => {
      expect(() => parseSampleResult({ rows: [] })).toThrow(/0 filas/);
    });

    // El caso exacto que se veía en producción: un objeto sin `rows` utilizable. Antes daba
    // «Cannot read properties of undefined», que no dice nada de la causa.
    it('un objeto sin filas dentro tampoco produce un TypeError', () => {
      expect(() => parseSampleResult({} as never)).toThrow(/0 filas/);
    });

    it('null/undefined siguen dando el mismo error claro', () => {
      expect(() => parseSampleResult(null)).toThrow(/0 filas/);
      expect(() => parseSampleResult(undefined)).toThrow(/0 filas/);
    });
  });
});
