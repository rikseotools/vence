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
    const db = fakeDb({
      observable_events: 1_000_000,
      validation_error_logs: 0,
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // Con el contador roto esto daba 50.000 y `batches: 2`.
    expect(res.observableEventsDeleted).toBe(1_000_000);
    expect(res.batches).toBeGreaterThan(2);
    expect(db.restante.observable_events).toBe(0);
  });

  it('respeta el techo de lotes: un backlog enorme se drena en varias noches', async () => {
    const db = fakeDb({
      observable_events: 10_000_000,
      validation_error_logs: 0,
    });
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
    const db = fakeDb({
      observable_events: 1_000_000,
      validation_error_logs: 0,
    });
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

  /**
   * Reproducido en producción el 08/08 (mismo `status: 'failure'` que el VACUUM del
   * 07/08, pero en el DELETE): con ~119 k filas de atraso (2-3 lotes), el cron falló
   * con `Failed query: DELETE FROM observable_events WHERE ctid IN (...) LIMIT
   * $1 params: 50000`, `duration_ms: 83681`. `purgeTable` no tenía try/catch —a
   * diferencia de `vacuum()`, que ya lo tiene desde el fix anterior de esta misma
   * ficha— así que la excepción se propagó fuera de `run()` entero: se perdió
   * `deleted` (lo ya borrado en lotes previos de ESA MISMA pasada), el VACUUM no
   * llegó a correr, y `remaining` (que se calcula DESPUÉS de purgar) nunca se
   * calculó. El cron reportó `status: 'failure'` sin un solo número — la alerta
   * `drenaje_atrasado` se queda ciega esa noche en vez de ver el atraso real.
   */
  it('un lote de DELETE que falla NO tira el resultado: lo borrado antes se conserva y el atraso se sigue midiendo', async () => {
    const db = fakeDb({ observable_events: 120_000, validation_error_logs: 0 });
    let deletesVistos = 0;
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (texto.includes('DELETE') && texto.includes('observable_events')) {
        deletesVistos++;
        if (deletesVistos === 2) {
          // El 2º lote (de 3: 50k + 50k + 20k) es el que revienta en producción.
          throw new Error(
            "Failed query: \n        DELETE FROM observable_events\n        WHERE ctid IN (\n          SELECT ctid FROM observable_events\n          WHERE created_at < now() - interval '30 days'\n          LIMIT $1\n        )\n      \nparams: 50000",
          );
        }
      }
      return original(q);
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // El 1er lote (50k) SÍ se conserva, aunque el 2º reventara.
    expect(res.observableEventsDeleted).toBe(50_000);
    expect(res.purgeFailed).toEqual(['observable_events']);
    // Lo que de verdad mira la alerta sigue calculándose — antes del fix esto
    // nunca se llegaba a ejecutar (la excepción salía de `run()` primero).
    expect(res.remaining.observable_events).toBeGreaterThan(0);
    // La otra tabla no se ve arrastrada por el fallo de la primera.
    expect(res.validationErrorLogsDeleted).toBe(0);
    expect(res.remaining.validation_error_logs).toBe(0);
  });
});
