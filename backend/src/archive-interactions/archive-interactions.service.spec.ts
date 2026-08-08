/**
 * El BUCLE del archivador, contra un `db` que responde como postgres-js. (T-613)
 *
 * Este es el fichero del que se COPIÓ el patrón malo a los demás (su propio
 * comentario decía «calcado de ArchiveInteractionsService»), y tampoco tenía
 * pruebas. `user_interactions` es la tabla más grande de la BD (10 GB, 11,6 M
 * filas) y llevaba semanas archivando 10 k por noche en vez de 200 k, con
 * 2,4 M filas atrasadas y diciendo «archivadas: 0».
 */
import { ArchiveInteractionsService } from './archive-interactions.service';

/** Resultado de postgres-js para un DELETE/CTE sin RETURNING: array vacío + `count`. */
function comoPostgresJs(count: number): unknown {
  const arr: unknown[] = [];
  Object.assign(arr, { count, command: 'DELETE' });
  return arr;
}

function fakeDb(porArchivar: number) {
  let restante = porArchivar;
  return {
    get restante() {
      return restante;
    },
    execute: jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (
        texto.includes('user_interactions_archive') &&
        texto.includes('months')
      ) {
        return comoPostgresJs(0); // fase 2: limpiar el archivo
      }
      if (texto.includes('count(*)')) {
        const arr: unknown[] = [{ n: Math.min(restante, 200_000) }];
        Object.assign(arr, { count: 1 });
        return arr;
      }
      const lote = Math.min(10_000, restante);
      restante -= lote;
      return comoPostgresJs(lote);
    }),
  };
}

describe('ArchiveInteractionsService: el bucle archiva de verdad (T-613)', () => {
  it('EL DEFECTO: con 50 k pendientes no se para en el primer lote de 10 k', async () => {
    const db = fakeDb(50_000);
    const service = new ArchiveInteractionsService(db as never);

    const res = await service.run();

    expect(res.archived).toBe(50_000);
    expect(res.batches).toBeGreaterThan(1);
    expect(db.restante).toBe(0);
  });

  it('respeta el techo de 20 lotes: 200 k por noche y el resto para mañana', async () => {
    const db = fakeDb(1_000_000);
    const service = new ArchiveInteractionsService(db as never);

    const res = await service.run();

    expect(res.archived).toBe(200_000);
    expect(res.batches).toBe(20);
    expect(res.remaining).toBeGreaterThan(0);
  });

  it('sin nada que archivar: 0 y 0 pendientes (el verde legítimo)', async () => {
    const db = fakeDb(0);
    const service = new ArchiveInteractionsService(db as never);

    const res = await service.run();

    expect(res.archived).toBe(0);
    expect(res.remaining).toBe(0);
  });

  /**
   * Mismo modo de fallo reproducido en producción (08/08) en el fichero gemelo
   * `TelemetryRetentionService`: sin try/catch, un lote que falla a mitad de FASE 1
   * propaga la excepción fuera de `run()` entero — se pierde `archived` (lo ya
   * movido en lotes previos), la FASE 2 no llega a correr y `remaining` (que se
   * calcula al final) nunca se calcula. El cron reportaría `status: 'failure'` sin
   * ningún número, y la alerta `drenaje_atrasado` se quedaría ciega esa noche.
   * Este fichero es el ORIGEN del patrón (T-613 lo dice en la cabecera), así que
   * comparte el mismo riesgo aunque todavía no haya fallado en vivo.
   */
  it('un lote de FASE 1 que falla NO tira el resultado: lo archivado antes se conserva y el atraso se sigue midiendo', async () => {
    const db = fakeDb(25_000); // 3 lotes de 10k: 10k + 10k + 5k
    let lotesVistos = 0;
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (texto.includes('to_move')) {
        lotesVistos++;
        if (lotesVistos === 2) {
          throw new Error(
            'Failed query: WITH to_move AS (...) DELETE FROM user_interactions ...\nparams: 10000',
          );
        }
      }
      return original(q);
    });
    const service = new ArchiveInteractionsService(db as never);

    const res = await service.run();

    // El 1er lote (10k) se conserva, aunque el 2º reventara.
    expect(res.archived).toBe(10_000);
    expect(res.archiveFailed).toEqual(['user_interactions']);
    // Lo que de verdad mira la alerta se sigue calculando — antes del fix esto
    // nunca se llegaba a ejecutar (la excepción salía de `run()` primero).
    expect(res.remaining).toBeGreaterThan(0);
    // FASE 2 no se ve arrastrada por el fallo de FASE 1.
    expect(res.cleanupFailed).toEqual([]);
  });

  it('un fallo en FASE 2 (limpiar el archivo) NO tira lo archivado en FASE 1', async () => {
    const db = fakeDb(10_000);
    const original = db.execute;
    db.execute = jest.fn(async (q: unknown) => {
      const texto = JSON.stringify(q);
      if (
        texto.includes('user_interactions_archive') &&
        texto.includes('months')
      ) {
        throw new Error(
          'Failed query: DELETE FROM user_interactions_archive ...',
        );
      }
      return original(q);
    });
    const service = new ArchiveInteractionsService(db as never);

    const res = await service.run();

    expect(res.archived).toBe(10_000);
    expect(res.cleanupFailed).toEqual(['user_interactions_archive']);
    expect(res.deleted).toBe(0);
    expect(res.remaining).toBe(0);
  });
});
