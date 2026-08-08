import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { filasAfectadas } from '../db/filasAfectadas';

/** Filas borradas por tabla en una ejecución. */
export interface TelemetryRetentionResult {
  observableEventsDeleted: number;
  validationErrorLogsDeleted: number;
  batches: number;
  /**
   * Lo que QUEDA fuera de retención al terminar, por tabla (acotado, ver
   * `atrasoDe`). Es la mitad del par: sin esto, «borradas: 0» y «no había nada
   * que borrar» son la misma frase — que es exactamente cómo T-613 pasó semanas
   * inadvertido. La regla de alerta `drenaje_atrasado` mira este campo.
   */
  remaining: Record<string, number>;
  /**
   * Tablas cuyo `VACUUM (ANALYZE)` falló esta pasada (vacío si todo fue bien).
   *
   * Reproducido en producción (07/08): un `VACUUM (ANALYZE) observable_events` justo
   * después de borrar ~2,6 M filas de golpe superó el `statement_timeout` de 30 s del
   * pool (`connection.statement_timeout` en `database.module.ts`) — VACUUM sobre una
   * tabla de 6,9 GB con millones de tuplas recién muertas no siempre entra en 30 s. Sin
   * este try/catch, esa excepción tumbaba TODO `run()` — incluido el cálculo de
   * `remaining`, que ocurre DESPUÉS — y el cron reportaba `status: 'failure'` sin ni
   * rastro de que el borrado (lo que de verdad importa) había funcionado. El VACUUM es
   * higiene (espacio reusable + stats frescas para el planner); perderlo una noche no
   * es grave, perder la MEDIDA de si se está drenando sí lo es.
   */
  vacuumFailed: string[];
  /**
   * Tablas cuyo bucle de borrado se cortó ANTES de tiempo por un error en un lote
   * (vacío si todo fue bien). Lo ya borrado en lotes anteriores se conserva.
   *
   * Reproducido en producción (08/08): un DELETE de `purgeTable` falló a mitad de
   * pasada (mismo `statement_timeout` del pool que ya tumbaba el VACUUM) y, como el
   * bucle no tenía try/catch, la excepción se propagó fuera de `purgeTable` — se
   * perdió el `deleted` acumulado, el VACUUM no llegó a correr y `remaining` (que se
   * calcula DESPUÉS) nunca se calculó: el cron reportó `status: 'failure'` sin
   * ningún número, exactamente el mismo modo de fallo que el VACUUM de esta misma
   * ficha, en el sitio que más importaba y que se había dejado sin blindar.
   */
  purgeFailed: string[];
}

/** Tope del conteo de atraso: por encima solo importa «muchísimo», no el número exacto. */
export const ATRASO_TOPE = 200_000;

/**
 * Retención de las dos tuberías de telemetría (append-only, alto volumen):
 *   - `observable_events`  → firehose de observabilidad (request_completed, crons,
 *      canaries, errores de cliente). Retención por `ts` (hora del evento).
 *   - `validation_error_logs` → log de errores 4xx/5xx por-request. Retención por
 *      `created_at`.
 *
 * Por qué existe (incidente 11/07/2026): sin retención, estas tablas crecen sin
 * límite. Un flood de 401 benignos de `/api/auth/token` (~340k/día tras el cutover
 * a RDS del 04/07) llevó `validation_error_logs` a ~1 GB / 2,3 M filas → su propio
 * panel admin (`/api/v2/admin/validation-errors`) tardaba 112 s en el GROUP BY →
 * 500. La causa raíz (no loguear el 401 anónimo) se arregló en `withErrorLogging`;
 * esta retención es la CAPA 2: que NINGUNA clase de log —benigna o no— pueda crecer
 * sin techo. La telemetría cruda tiene vida útil; los runbooks miran ventanas de
 * 24 h–7 d, así que 30 días es holgado. Para histórico a largo plazo, la vía es un
 * rollup diario (fuera de alcance aquí).
 *
 * Diseño (calcado de `ArchiveInteractionsService`): batches acotados por ejecución.
 * Si tras `maxBatches` quedan filas viejas (backlog inicial grande), el siguiente
 * run las procesa — drena en varias noches sin un DELETE gigante ni locks largos.
 */
@Injectable()
export class TelemetryRetentionService {
  private readonly logger = new Logger(TelemetryRetentionService.name);

  /** Días de retención del crudo. Ventana holgada sobre lo que miran los runbooks (24 h–7 d). */
  private readonly retentionDays = 30;

  /** Filas por batch. */
  private readonly batchSize = 50_000;

  /** Batches máximos por tabla y ejecución (2,5 M filas/tabla). Acota locks y drena el backlog en varias noches. */
  private readonly maxBatches = 50;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<TelemetryRetentionResult> {
    const result: TelemetryRetentionResult = {
      observableEventsDeleted: 0,
      validationErrorLogsDeleted: 0,
      batches: 0,
      remaining: {},
      vacuumFailed: [],
      purgeFailed: [],
    };

    // Se poda por `created_at` (hora de INSERCIÓN en BD, fiable y monotónica), NO
    // por la hora del evento: `observable_events.ts` puede venir corrupta (visto un
    // `ts`=2067 de un cliente) y esas filas con fecha futura nunca cumplirían
    // `ts < now()-30d` → crecerían para siempre. `created_at` no tiene ese agujero.
    result.observableEventsDeleted = await this.purgeTable(
      'observable_events',
      'created_at',
      (n) => (result.batches += n),
      result,
    );
    result.validationErrorLogsDeleted = await this.purgeTable(
      'validation_error_logs',
      'created_at',
      (n) => (result.batches += n),
      result,
    );

    // VACUUM (no FULL) al terminar si borramos algo: marca el espacio reutilizable
    // y refresca stats para que los planes (p.ej. el GROUP BY del panel admin) no
    // degraden. No FULL a propósito: no bloquea lecturas/escrituras.
    //
    // try/catch a propósito, NO dejar que se propague: un VACUUM que se pasa del
    // `statement_timeout` (30 s, sobre una tabla de varios GB recién vaciada de
    // millones de filas — reproducido en producción el 07/08) no puede tirar todo
    // `run()` y perderse el conteo de `remaining` que se calcula DESPUÉS. Si falla,
    // el autovacuum de Postgres acaba haciendo el mismo trabajo por su cuenta más
    // tarde — lo único que se pierde es el refresco INMEDIATO de stats.
    if (result.observableEventsDeleted > 0) {
      await this.vacuum('observable_events', result);
    }
    if (result.validationErrorLogsDeleted > 0) {
      await this.vacuum('validation_error_logs', result);
    }

    // Lo que queda para la próxima noche. Se mide DESPUÉS de podar, a propósito:
    // es el número con el que se juzga si el drenaje va o no va.
    result.remaining.observable_events = await this.atrasoDe(
      'observable_events',
      'created_at',
    );
    result.remaining.validation_error_logs = await this.atrasoDe(
      'validation_error_logs',
      'created_at',
    );

    return result;
  }

  /**
   * `VACUUM (ANALYZE)` de una tabla, tolerante a fallo: registra en `result.vacuumFailed`
   * y sigue en vez de tirar `run()` entero. `table` es un literal controlado por el
   * código (nunca input externo) → `sql.raw` es seguro aquí.
   */
  private async vacuum(
    table: string,
    result: TelemetryRetentionResult,
  ): Promise<void> {
    try {
      await this.db.execute(sql`VACUUM (ANALYZE) ${sql.raw(table)}`);
    } catch (error) {
      result.vacuumFailed.push(table);
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `VACUUM (ANALYZE) ${table} falló (no bloqueante): ${msg}`,
      );
    }
  }

  /**
   * Filas fuera de retención que quedan, **acotado a `ATRASO_TOPE`**. Un
   * `count(*)` sobre una tabla de 10 M filas es justo lo que no se puede hacer
   * cada noche; el `LIMIT` lo convierte en un escaneo corto, y para decidir «esto
   * no está drenando» da igual 200 k que 2 M.
   */
  private async atrasoDe(table: string, tsColumn: string): Promise<number> {
    const res = await this.db.execute(sql`
      SELECT count(*)::int AS n FROM (
        SELECT 1 FROM ${sql.raw(table)}
        WHERE ${sql.raw(tsColumn)} < now() - interval '${sql.raw(String(this.retentionDays))} days'
        LIMIT ${ATRASO_TOPE}
      ) x
    `);
    const fila = (res as unknown as Array<{ n?: number }>)[0];
    return fila?.n ?? 0;
  }

  /**
   * Borra en batches las filas de `table` cuya columna temporal `tsColumn` es más
   * antigua que la retención. `table` y `tsColumn` son literales controlados por el
   * código (nunca input externo) → `sql.raw` es seguro aquí.
   *
   * El `ORDER BY tsColumn` del SELECT interno NO es cosmético: sin él, el planificador
   * elige Seq Scan pese a existir `idx_observable_events_created_at` — la correlación
   * entre el orden físico de las filas y `created_at` es casi nula (`pg_stats.correlation
   * ≈ -0.09`), así que sin una pista de orden el coste estimado de un Index/Bitmap Scan
   * parece peor que barrer la tabla entera. MEDIDO (08/08) con `EXPLAIN (ANALYZE, BUFFERS)`
   * contra `observable_events` (6,2 M filas), mismo filtro y LIMIT 50.000: sin `ORDER BY`,
   * Seq Scan, 8.124 ms (145.058 buffers leídos de disco); con `ORDER BY`, Index Scan
   * usando `idx_observable_events_created_at`, 44 ms — **185× más rápido**, sin forzar
   * nada (`enable_seqscan` a su valor por defecto). Es la causa más probable de que un
   * lote supere el `statement_timeout` de 30 s tras 2-3 iteraciones (2-3 × ~8 s de Seq
   * Scan + la propia DELETE): el fallo reproducido en producción el 08/08 04:11 UTC
   * (`purgeFailed`, ver arriba) coincide con esa aritmética.
   */
  private async purgeTable(
    table: string,
    tsColumn: string,
    onBatch: (n: number) => void,
    result: TelemetryRetentionResult,
  ): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < this.maxBatches; i++) {
      try {
        const res = await this.db.execute(sql`
          DELETE FROM ${sql.raw(table)}
          WHERE ctid IN (
            SELECT ctid FROM ${sql.raw(table)}
            WHERE ${sql.raw(tsColumn)} < now() - interval '${sql.raw(String(this.retentionDays))} days'
            ORDER BY ${sql.raw(tsColumn)}
            LIMIT ${this.batchSize}
          )
        `);
        // OJO: postgres-js pone las filas afectadas en `count`, no en `rowCount` —
        // leerlo mal no era un log inexacto, sacaba del bucle en la 1.ª vuelta (T-613).
        const count = filasAfectadas(res);
        deleted += count;
        onBatch(1);
        if (count < this.batchSize) break; // no quedan más filas candidatas
      } catch (error) {
        // No propagar: perderíamos `deleted` (lo ya borrado en lotes previos), el
        // VACUUM y `remaining` de la tabla. Se corta ESTA tabla por esta pasada —
        // no se reintenta en el mismo run, para no insistir contra lo que sea que
        // esté bloqueando— y la próxima noche retoma donde `WHERE` la deje (no hay
        // estado que llevar: el filtro es siempre "más vieja que la retención").
        result.purgeFailed.push(table);
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `DELETE ${table} lote ${i + 1} falló (no bloqueante, se retoma la próxima noche): ${msg}`,
        );
        break;
      }
    }
    this.logger.log(
      `${table}: ${deleted} filas > ${this.retentionDays}d borradas`,
    );
    return deleted;
  }
}
