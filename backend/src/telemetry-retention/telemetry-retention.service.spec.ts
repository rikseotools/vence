/**
 * El BUCLE del drenador, contra un `db` que responde como postgres-js de verdad. (T-613)
 *
 * ── POR QUÉ ESTE TEST Y NO OTRO ──────────────────────────────────────────────
 * El servicio no tenía NINGUNA prueba. El defecto no estaba en el SQL (que era
 * correcto y borraba de verdad) sino en cómo se contaba lo borrado: se leía
 * `res.rowCount`, que en postgres-js es `undefined`, y el bucle corta con
 * «si el lote devolvió menos de lo pedido, hemos terminado». Con 0 constante,
 * salía en la PRIMERA vuelta — 50 k filas por noche en vez de 2,5 M, y reportando
 * cero.
 *
 * Un test con un `db` que devolviera `{ rowCount: n }` habría pasado en verde con
 * el código roto. Por eso el doble de aquí imita la forma REAL medida contra RDS:
 * **array vacío con las filas en `.count`**.
 */
import { TelemetryRetentionService } from './telemetry-retention.service';

/** Resultado de postgres-js para un DELETE sin RETURNING: array vacío + `count`. */
function comoPostgresJs(count: number): unknown {
  const arr: unknown[] = [];
  Object.assign(arr, { count, command: 'DELETE' });
  return arr;
}

/**
 * `db` de mentira con un almacén de filas por tabla. Cada DELETE se lleva hasta
 * `batchSize` y responde como postgres-js; los SELECT de atraso responden lo que
 * queda. Así el bucle se ejerce de verdad en vez de comprobarse por dentro.
 */
function fakeDb(pendientes: Record<string, number>) {
  const restante = { ...pendientes };
  const sentencias: string[] = [];
  return {
    sentencias,
    restante,
    execute: jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      sentencias.push(texto);

      const tabla = Object.keys(restante).find((t) => texto.includes(t));
      if (!tabla) return comoPostgresJs(0);

      if (texto.includes('DELETE')) {
        const lote = Math.min(50_000, restante[tabla]);
        restante[tabla] -= lote;
        return comoPostgresJs(lote);
      }
      if (texto.includes('count(*)')) {
        const arr: unknown[] = [{ n: Math.min(restante[tabla], 200_000) }];
        Object.assign(arr, { count: 1 });
        return arr;
      }
      return comoPostgresJs(0); // VACUUM
    }),
  };
}

describe('TelemetryRetentionService: el bucle drena de verdad (T-613)', () => {
  it('EL DEFECTO: con 1 M de filas atrasadas NO se para en el primer lote', async () => {
    const db = fakeDb({ observable_events: 1_000_000, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // Con el contador roto esto daba 50.000 y `batches: 2`.
    expect(res.observableEventsDeleted).toBe(1_000_000);
    expect(res.batches).toBeGreaterThan(2);
    expect(db.restante.observable_events).toBe(0);
  });

  it('respeta el techo de lotes: un backlog enorme se drena en varias noches', async () => {
    const db = fakeDb({ observable_events: 10_000_000, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // 50 lotes × 50 k = 2,5 M por pasada, y el resto queda para la siguiente.
    expect(res.observableEventsDeleted).toBe(2_500_000);
    expect(db.restante.observable_events).toBe(7_500_000);
    // Y lo dice en voz alta, que es la mitad que faltaba:
    expect(res.remaining.observable_events).toBeGreaterThan(0);
  });

  it('sin nada que borrar: 0 borradas y 0 pendientes (el verde legítimo)', async () => {
    const db = fakeDb({ observable_events: 0, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsDeleted).toBe(0);
    expect(res.remaining.observable_events).toBe(0);
    // Sin VACUUM: no se ha liberado nada que compactar.
    expect(db.sentencias.some((s) => s.includes('VACUUM'))).toBe(false);
  });

  it('tras borrar, compacta y refresca estadísticas', async () => {
    const db = fakeDb({ observable_events: 60_000, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    await service.run();

    expect(db.sentencias.some((s) => s.includes('VACUUM'))).toBe(true);
  });

  it('el atraso se mide DESPUÉS de podar, no antes', async () => {
    const db = fakeDb({ observable_events: 120_000, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsDeleted).toBe(120_000);
    expect(res.remaining.observable_events).toBe(0);
  });

  /**
   * Reproducido en producción el 07/08: `VACUUM (ANALYZE) observable_events` justo
   * después de borrar ~2,6 M filas superó el `statement_timeout` de 30 s del pool y
   * tiró TODO `run()` — `remaining` se calcula DESPUÉS del VACUUM, así que el cron
   * reportó `status: 'failure'` sin rastro de que el borrado (lo que importa) había
   * funcionado. `filasAfectadas`/`batches` estaban bien: este es un fallo DISTINTO.
   */
  it('un VACUUM que falla NO tira el resultado: el borrado y el atraso se reportan igual', async () => {
    const db = fakeDb({ observable_events: 1_000_000, validation_error_logs: 0 });
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      if (JSON.stringify(q).includes('VACUUM')) {
        throw new Error(
          'Failed query: VACUUM (ANALYZE) observable_events\nparams: ',
        );
      }
      return original(q);
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // Lo que de verdad importa (el borrado) llegó intacto pese al VACUUM roto.
    expect(res.observableEventsDeleted).toBe(1_000_000);
    expect(res.remaining.observable_events).toBe(0);
    expect(res.vacuumFailed).toEqual(['observable_events']);
  });
});
