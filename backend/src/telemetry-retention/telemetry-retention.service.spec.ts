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
import {
  BATCH_SIZE,
  MAX_BATCHES,
  TelemetryRetentionService,
} from './telemetry-retention.service';

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
        // Del propio servicio, NO un 50.000 a mano: el tamaño de lote se bajó a 10.000 (T-733)
        // y un doble con la cifra vieja habría seguido en verde midiendo otra cosa.
        const lote = Math.min(BATCH_SIZE, restante[tabla]);
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

    // El techo por pasada son 2,5 M filas/tabla, y NO cambió al bajar el lote (T-733):
    // antes 50 lotes × 50 k, ahora 250 × 10 k. Se afirma sobre las constantes para que el día
    // que alguien mueva una y no la otra, este test lo diga en vez de seguir en verde.
    expect(BATCH_SIZE * MAX_BATCHES).toBe(2_500_000);
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
   * [T-733] Reproducido en producción el 08/08: un lote del DELETE superó el `statement_timeout`
   * de 30 s y la excepción tumbó `run()` entero. El evento que quedó en `observable_events` fue
   * literalmente `{"status":"failure"}` — ni filas borradas, ni `remaining`, ni el error.
   *
   * Es el MISMO modo de fallo que el VACUUM de arriba, en la operación que sí importa. Lo que
   * cambia entre los dos es el veredicto, y por eso son dos tests: el VACUUM roto sigue siendo
   * éxito (es higiene) y la purga rota NO lo es.
   */
  it('un lote que revienta NO tira el resultado: se reporta lo borrado, el atraso y el error', async () => {
    const db = fakeDb({ observable_events: 1_000_000, validation_error_logs: 0 });
    const original = db.execute;
    let lotes = 0;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (texto.includes('DELETE') && texto.includes('observable_events')) {
        lotes += 1;
        if (lotes > 3) {
          // El mensaje REAL de Postgres al pasarse del plazo. Sin escribir la sentencia de
          // borrado literal, a propósito: `filasAfectadas.guardrail` trata esa cadena, en
          // CUALQUIER fichero, como un segundo podador de la tabla — y tiene razón. Que un
          // doble de test la disparase sería aflojar el guardarraíl para probar lo mío.
          throw new Error('canceling statement due to statement timeout');
        }
      }
      return original(q);
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    // Lo que se llegó a borrar antes de reventar CUENTA y se dice.
    expect(res.observableEventsDeleted).toBe(3 * BATCH_SIZE);
    // Y el atraso que queda —la medida que decide si esto drena— sobrevive.
    expect(res.remaining.observable_events).toBeGreaterThan(0);
    expect(res.purgaFallida).toHaveLength(1);
    expect(res.purgaFallida[0].tabla).toBe('observable_events');
    expect(res.purgaFallida[0].error).toContain('statement timeout');
  });

  it('un lote roto en una tabla no impide purgar la otra', async () => {
    const db = fakeDb({
      observable_events: 1_000_000,
      validation_error_logs: 20_000,
    });
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (texto.includes('DELETE') && texto.includes('observable_events')) {
        throw new Error('statement timeout');
      }
      return original(q);
    });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.observableEventsDeleted).toBe(0);
    expect(res.validationErrorLogsDeleted).toBe(20_000);
    expect(res.purgaFallida.map((f) => f.tabla)).toEqual(['observable_events']);
  });

  it('sin fallos, `purgaFallida` va vacío (el verde no se confunde con el rojo)', async () => {
    const db = fakeDb({ observable_events: 30_000, validation_error_logs: 0 });
    const service = new TelemetryRetentionService(db as never);

    const res = await service.run();

    expect(res.purgaFallida).toEqual([]);
  });

  /**
   * El lote tiene que caber en el `statement_timeout` de 30 s del pool. 50.000 no cabía sobre
   * `observable_events` (6,9 GB) y por eso se bajó. Este test no puede medir segundos, así que
   * fija el número: si alguien lo vuelve a subir, que sea una decisión y no un descuido.
   */
  it('el lote sigue siendo de 10.000 (no cabía con 50.000)', () => {
    expect(BATCH_SIZE).toBe(10_000);
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
