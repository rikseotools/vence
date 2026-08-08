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

  /**
   * Reproducido en producción el 08/08: el DELETE por lotes de `observable_events` superó el
   * `statement_timeout` y tiró TODO `run()` — `validation_error_logs` (tabla SANA, sin ningún
   * problema propio) ni siquiera llegó a intentar su propio DELETE esa noche, y `remaining` no
   * se calculó para NINGUNA de las dos tablas. Mismo defecto de fondo que ya arregló
   * `vacuumFailed`, un escalón más abajo: aquí falla el DELETE en sí, no el VACUUM posterior.
   */
  it('un DELETE que falla en una tabla NO tira el resultado ni deja a la otra sin su turno', async () => {
    const db = fakeDb({ observable_events: 1_000_000, validation_error_logs: 500_000 });
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (texto.includes('observable_events') && texto.includes('DELETE')) {
        throw new Error(
          "Failed query: \n        DELETE FROM observable_events\n        WHERE ctid IN (\n          SELECT ctid FROM observable_events\n          WHERE created_at < now() - interval '30 days'\n          LIMIT $1\n        )\n      \nparams: 50000",
        );
      }
      return original(q);
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // observable_events no pudo borrar nada esta noche...
    expect(res.observableEventsDeleted).toBe(0);
    expect(res.purgeFailed).toEqual(['observable_events']);
    // ...pero validation_error_logs SÍ tuvo su turno, sin que el fallo de la otra se lo robara.
    expect(res.validationErrorLogsDeleted).toBe(500_000);
    // Y `remaining` se calculó para las DOS, no solo para la que funcionó (acotado a
    // ATRASO_TOPE=200_000, ver `atrasoDe` — el backlog real de 1 M no cabe entero, pero
    // lo que importa aquí es que el cálculo SE HIZO, no que el número sea exacto).
    expect(res.remaining.observable_events).toBe(200_000);
    expect(res.remaining.validation_error_logs).toBe(0);
  });

  it('un fallo de mantenerParticiones (tabla YA particionada) tampoco tira el resultado', async () => {
    const restanteValidation = { validation_error_logs: 100_000 };
    const db = {
      execute: jest.fn(async (q: unknown) => {
        const texto = JSON.stringify(q);
        if (texto.includes('pg_class') && texto.includes('relkind')) {
          return [{ relkind: 'p' }];
        }
        if (texto.includes('run_maintenance_proc')) {
          throw new Error('Failed query: SELECT partman.run_maintenance_proc()');
        }
        if (texto.includes('validation_error_logs') && texto.includes('DELETE')) {
          const lote = Math.min(50_000, restanteValidation.validation_error_logs);
          restanteValidation.validation_error_logs -= lote;
          const arr: unknown[] = [];
          Object.assign(arr, { count: lote, command: 'DELETE' });
          return arr;
        }
        if (texto.includes('count(*)') && texto.includes('validation_error_logs')) {
          const arr: unknown[] = [{ n: restanteValidation.validation_error_logs }];
          Object.assign(arr, { count: 1 });
          return arr;
        }
        const arr: unknown[] = [{ n: 0 }];
        Object.assign(arr, { count: 1 });
        return arr;
      }),
    };
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsPorParticion).toBe(true);
    expect(res.observableEventsParticionesDropeadas).toBe(0);
    expect(res.purgeFailed).toEqual(['observable_events']);
    expect(res.validationErrorLogsDeleted).toBe(100_000);
  });
});

/**
 * [T-360] Rama de retención por PARTICIÓN. `observable_events` puede convertirse en tabla
 * particionada sin que este código se vuelva a desplegar — el `run()` decide en cada ejecución
 * consultando `pg_class.relkind`. Estos tests fijan las DOS mitades de esa decisión: mientras la
 * tabla NO esté particionada (los 5 tests de arriba, sin tocar) sigue siendo DELETE por lotes; en
 * cuanto lo esté, pasa a `partman.run_maintenance_proc()` y dejar de intentar un DELETE por lotes
 * es tan importante como empezar el DROP PARTITION — un `DELETE` sobre una tabla particionada no
 * está mal, pero sería trabajo duplicado y el objetivo entero de particionar es dejar de hacerlo.
 */
function fakeDbParticionada(opts: {
  particionesAntes: number;
  particionesDespues: number;
  validationErrorLogsPendientes?: number;
}) {
  const restanteValidation = { validation_error_logs: opts.validationErrorLogsPendientes ?? 0 };
  const sentencias: string[] = [];
  let llamadasInherits = 0;
  return {
    sentencias,
    execute: jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      sentencias.push(texto);

      if (texto.includes('pg_class') && texto.includes('relkind')) {
        return [{ relkind: 'p' }];
      }
      if (texto.includes('pg_inherits')) {
        llamadasInherits += 1;
        const n = llamadasInherits === 1 ? opts.particionesAntes : opts.particionesDespues;
        return [{ n }];
      }
      if (texto.includes('run_maintenance_proc')) {
        return comoPostgresJs(0);
      }
      // validation_error_logs sigue el camino de siempre (DELETE por lotes) — no particionada en este pase.
      if (texto.includes('validation_error_logs') && texto.includes('DELETE')) {
        const lote = Math.min(50_000, restanteValidation.validation_error_logs);
        restanteValidation.validation_error_logs -= lote;
        return comoPostgresJs(lote);
      }
      if (texto.includes('count(*)') && texto.includes('validation_error_logs')) {
        const arr: unknown[] = [{ n: restanteValidation.validation_error_logs }];
        Object.assign(arr, { count: 1 });
        return arr;
      }
      if (texto.includes('count(*)') && texto.includes('observable_events')) {
        // atrasoDe de observable_events: con retención por partición, 0 es el verde esperado.
        const arr: unknown[] = [{ n: 0 }];
        Object.assign(arr, { count: 1 });
        return arr;
      }
      return comoPostgresJs(0); // VACUUM u otra sentencia sin relevancia para el test
    }),
  };
}

describe('TelemetryRetentionService: retención por PARTICIÓN cuando la tabla ya está particionada (T-360)', () => {
  it('detecta la partición y NO intenta un DELETE por lotes sobre observable_events', async () => {
    const db = fakeDbParticionada({ particionesAntes: 34, particionesDespues: 30 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsPorParticion).toBe(true);
    expect(res.observableEventsDeleted).toBe(0);
    // Ningún DELETE sobre observable_events — el camino viejo debe quedar callado del todo.
    expect(
      db.sentencias.some((s) => s.includes('DELETE') && s.includes('observable_events')),
    ).toBe(false);
  });

  it('reporta cuántas particiones se dropearon comparando antes/después de run_maintenance_proc', async () => {
    const db = fakeDbParticionada({ particionesAntes: 34, particionesDespues: 30 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsParticionesDropeadas).toBe(4);
    expect(db.sentencias.some((s) => s.includes('run_maintenance_proc'))).toBe(true);
  });

  it('si no se dropeó ninguna partición (noche sin nada que expulsar), lo dice como 0, no como error', async () => {
    const db = fakeDbParticionada({ particionesAntes: 30, particionesDespues: 30 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsParticionesDropeadas).toBe(0);
    expect(res.observableEventsPorParticion).toBe(true);
  });

  it('validation_error_logs SIGUE por DELETE aunque observable_events ya esté particionada — son independientes', async () => {
    const db = fakeDbParticionada({
      particionesAntes: 31,
      particionesDespues: 30,
      validationErrorLogsPendientes: 70_000,
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsPorParticion).toBe(true);
    expect(res.validationErrorLogsDeleted).toBe(70_000);
  });
});
