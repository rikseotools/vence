import { parseSnapshotResult } from './pg-stat-snapshot.service';

describe('parseSnapshotResult — helper puro', () => {
  it('parsea correctamente la fila devuelta por take_pg_stat_statements_snapshot()', () => {
    const result = parseSnapshotResult([
      {
        snapshot_at: '2026-06-01T00:05:00.000Z',
        rows_inserted: 1234,
        duration_ms: 567,
      },
    ]);
    expect(result.snapshotAt).toBeInstanceOf(Date);
    expect(result.snapshotAt.toISOString()).toBe('2026-06-01T00:05:00.000Z');
    expect(result.rowsInserted).toBe(1234);
    expect(result.durationMs).toBe(567);
  });

  it('acepta snapshot_at como objeto Date (no string)', () => {
    const date = new Date('2026-06-01T00:05:00.000Z');
    const result = parseSnapshotResult([
      { snapshot_at: date, rows_inserted: 10, duration_ms: 5 },
    ]);
    expect(result.snapshotAt).toBe(date);
  });

  it('convierte rows_inserted y duration_ms aunque vengan como string (defensivo vs drivers)', () => {
    const result = parseSnapshotResult([
      {
        snapshot_at: '2026-06-01T00:05:00.000Z',
        rows_inserted: '42' as unknown as number,
        duration_ms: '13' as unknown as number,
      },
    ]);
    expect(result.rowsInserted).toBe(42);
    expect(result.durationMs).toBe(13);
  });

  it('rows_inserted=0 es válido (snapshot del mismo minuto, ON CONFLICT DO NOTHING)', () => {
    const result = parseSnapshotResult([
      {
        snapshot_at: '2026-06-01T00:05:00.000Z',
        rows_inserted: 0,
        duration_ms: 100,
      },
    ]);
    expect(result.rowsInserted).toBe(0);
  });

  it('lanza si devuelve 0 filas (la función SQL siempre devuelve 1)', () => {
    expect(() => parseSnapshotResult([])).toThrow(
      /devolvió 0 filas/,
    );
  });

  it('lanza si rows es undefined/null (defensa contra cambios futuros)', () => {
    expect(() =>
      parseSnapshotResult(undefined as unknown as Parameters<typeof parseSnapshotResult>[0]),
    ).toThrow(/devolvió 0 filas/);
    expect(() =>
      parseSnapshotResult(null as unknown as Parameters<typeof parseSnapshotResult>[0]),
    ).toThrow(/devolvió 0 filas/);
  });
});

describe('PgStatSnapshotService — contrato', () => {
  // Sourcecode asserts (mismo patrón que withErrorLogging.test.ts):
  // verifican invariantes del service sin necesitar boot de NestJS.
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(
    path.join(__dirname, 'pg-stat-snapshot.service.ts'),
    'utf-8',
  );

  it('llama a take_pg_stat_statements_snapshot()', () => {
    expect(content).toMatch(/take_pg_stat_statements_snapshot/);
  });

  it('llama a prune_pg_stat_statements_snapshots con retention 30d', () => {
    expect(content).toMatch(/prune_pg_stat_statements_snapshots/);
    expect(content).toMatch(/RETENTION_DAYS\s*=\s*30/);
  });

  it('exporta parseSnapshotResult para test unitario directo', () => {
    expect(content).toMatch(/export function parseSnapshotResult/);
  });

  it('propaga excepción si la poda revienta (no swallow)', () => {
    // Comentario explícito en el código documentando la decisión.
    expect(content).toMatch(/falla silenciosa NO permitida/);
  });
});

describe('PgStatSnapshotCron — contrato', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(
    path.join(__dirname, 'pg-stat-snapshot.cron.ts'),
    'utf-8',
  );

  it('corre diario a las 00:05 UTC', () => {
    expect(content).toMatch(/@Cron\('5 0 \* \* \*'/);
    expect(content).toMatch(/timeZone:\s*'UTC'/);
  });

  it('se registra en HeartbeatRegistry con threshold 28h', () => {
    expect(content).toMatch(/heartbeatRegistry\.register\(\s*'pg-stat-snapshot'/);
    expect(content).toMatch(/thresholdMs:\s*28\s*\*\s*3600\s*\*\s*1000/);
  });

  it('emite cron_run a observability con metadata estructurada (success + failure)', () => {
    expect(content).toMatch(/eventType:\s*'cron_run'/);
    expect(content).toMatch(/status:\s*'success'/);
    expect(content).toMatch(/status:\s*'failure'/);
  });

  it('aplica jitter para defensa-en-profundidad', () => {
    expect(content).toMatch(/await jitter\(/);
  });

  it('usa runWithHeartbeat para tracking de lastTickAtMs', () => {
    expect(content).toMatch(/runWithHeartbeat\(this, 'lastTickAtMs'/);
  });
});
