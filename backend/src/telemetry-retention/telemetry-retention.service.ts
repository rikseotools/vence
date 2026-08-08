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
   * `true` si `observable_events` ya está particionada (T-360) y este `run()` retuvo por
   * `DROP PARTITION` (`partman.run_maintenance_proc()`) en vez de por DELETE. `false` mientras
   * la migración de particionado no se haya aplicado — que es el estado de HOY.
   */
  observableEventsPorParticion: boolean;
  /** Particiones de `observable_events` dropeadas en este `run()` (solo tiene sentido si `observableEventsPorParticion`). */
  observableEventsParticionesDropeadas: number;
  /**
   * Tablas cuyo DELETE por lotes (o `mantenerParticiones`, si ya está particionada) falló esta
   * pasada — vacío si todo fue bien.
   *
   * Reproducido en producción (08/08): el mismo `statement_timeout` de 30 s que ya tumbaba el
   * VACUUM (ver `vacuumFailed`) tumbó esta vez el DELETE en sí — `purgeTable` no tenía try/catch,
   * así que la excepción se propagó fuera de `run()` y canceló TODO lo que viene después: el
   * DELETE de `validation_error_logs` (una tabla SANA, sin ningún problema propio) ni siquiera
   * llegó a intentarse, y `remaining` —la medida con la que se juzga si el drenaje va o no va—
   * tampoco se calculó. Mismo defecto de fondo que motivó `vacuumFailed`, un escalón más abajo en
   * la cadena: una tabla con problemas no puede dejar a las demás sin su propia oportunidad.
   */
  purgeFailed: string[];
}

/** Tope del conteo de atraso: por encima solo importa «muchísimo», no el número exacto. */
export const ATRASO_TOPE = 200_000;

/** `error.message` si es un `Error`, o su representación textual si no lo es. */
function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
      observableEventsPorParticion: false,
      observableEventsParticionesDropeadas: 0,
      purgeFailed: [],
    };

    // [T-360] `observable_events` puede estar particionada por `created_at` (DROP PARTITION en vez
    // de DELETE) o no, según si la migración de `docs/roadmap/particionado-telemetria.md` ya se
    // aplicó. Se comprueba EN CADA `run()`, nunca se asume: así este cambio es seguro desplegarlo
    // ANTES de que la migración exista (sigue tomando la rama DELETE de siempre) y empieza a usar
    // `DROP PARTITION` solo, sin otro deploy, en cuanto la tabla pase a estar particionada.
    result.observableEventsPorParticion = await this.estaParticionada(
      'observable_events',
    );

    // try/catch a propósito en las DOS ramas, igual criterio que `vacuum()`: reproducido en
    // producción (08/08) que un DELETE por lotes que supera el `statement_timeout` tira TODO
    // `run()` — y con eso, `validation_error_logs` (una tabla SANA, sin ningún problema propio)
    // ni siquiera llega a intentar su propio DELETE, y `remaining` no se calcula para NINGUNA de
    // las dos. Una tabla con problemas no puede dejar sin oportunidad a la otra.
    if (result.observableEventsPorParticion) {
      try {
        result.observableEventsParticionesDropeadas =
          await this.mantenerParticiones('observable_events');
      } catch (error) {
        result.purgeFailed.push('observable_events');
        this.logger.warn(
          `mantenerParticiones(observable_events) falló (no bloqueante): ${mensajeDe(error)}`,
        );
      }
    } else {
      // Se poda por `created_at` (hora de INSERCIÓN en BD, fiable y monotónica), NO
      // por la hora del evento: `observable_events.ts` puede venir corrupta (visto un
      // `ts`=2067 de un cliente) y esas filas con fecha futura nunca cumplirían
      // `ts < now()-30d` → crecerían para siempre. `created_at` no tiene ese agujero.
      try {
        result.observableEventsDeleted = await this.purgeTable(
          'observable_events',
          'created_at',
          (n) => (result.batches += n),
        );
      } catch (error) {
        result.purgeFailed.push('observable_events');
        this.logger.warn(
          `purgeTable(observable_events) falló (no bloqueante): ${mensajeDe(error)}`,
        );
      }
    }
    try {
      result.validationErrorLogsDeleted = await this.purgeTable(
        'validation_error_logs',
        'created_at',
        (n) => (result.batches += n),
      );
    } catch (error) {
      result.purgeFailed.push('validation_error_logs');
      this.logger.warn(
        `purgeTable(validation_error_logs) falló (no bloqueante): ${mensajeDe(error)}`,
      );
    }

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
    //
    // `observable_events` particionada NO necesita este VACUUM manual para la retención —
    // `DROP PARTITION` no deja bloat que compactar — pero el autovacuum normal de Postgres
    // sigue corriendo solo sobre las particiones activas, así que no hace falta sustituirlo.
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
      this.logger.warn(
        `VACUUM (ANALYZE) ${table} falló (no bloqueante): ${mensajeDe(error)}`,
      );
    }
  }

  /**
   * `true` si `table` es una tabla PARTICIONADA (`relkind='p'`). Consulta el catálogo por nombre
   * — O(1), no toca la tabla en sí. `table` es un literal controlado por el código, nunca input
   * externo, así que interpolarlo en `sql.raw` es seguro (igual criterio que `purgeTable`).
   */
  private async estaParticionada(table: string): Promise<boolean> {
    const res = await this.db.execute(sql`
      SELECT relkind FROM pg_class WHERE relname = ${table}
    `);
    const fila = (res as unknown as Array<{ relkind?: string }>)[0];
    return fila?.relkind === 'p';
  }

  /**
   * Delega TODO el ciclo de vida de las particiones — crear las próximas, dropear las que ya
   * cumplieron la retención — en `pg_partman` (`partman.run_maintenance_proc()`), en vez de
   * reimplementar el parseo de límites de partición aquí. Cuenta las particiones hijas antes y
   * después para reportar cuántas se dropearon: sin esa cifra, «retención por partición: true» y
   * «no se dropeó nada esta noche» son la misma frase (mismo defecto que T-613 con `remaining`).
   */
  private async mantenerParticiones(table: string): Promise<number> {
    const contar = async (): Promise<number> => {
      const res = await this.db.execute(sql`
        SELECT count(*)::int AS n FROM pg_inherits
        WHERE inhparent = ${sql.raw(table)}::regclass
      `);
      const fila = (res as unknown as Array<{ n?: number }>)[0];
      return fila?.n ?? 0;
    };
    const antes = await contar();
    await this.db.execute(sql`SELECT partman.run_maintenance_proc()`);
    const despues = await contar();
    const dropeadas = Math.max(0, antes - despues);
    this.logger.log(
      `${table}: retención por partición — ${antes} → ${despues} particiones (${dropeadas} dropeadas)`,
    );
    return dropeadas;
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
   */
  private async purgeTable(
    table: string,
    tsColumn: string,
    onBatch: (n: number) => void,
  ): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < this.maxBatches; i++) {
      const res = await this.db.execute(sql`
        DELETE FROM ${sql.raw(table)}
        WHERE ctid IN (
          SELECT ctid FROM ${sql.raw(table)}
          WHERE ${sql.raw(tsColumn)} < now() - interval '${sql.raw(String(this.retentionDays))} days'
          LIMIT ${this.batchSize}
        )
      `);
      // OJO: postgres-js pone las filas afectadas en `count`, no en `rowCount` —
      // leerlo mal no era un log inexacto, sacaba del bucle en la 1.ª vuelta (T-613).
      const count = filasAfectadas(res);
      deleted += count;
      onBatch(1);
      if (count < this.batchSize) break; // no quedan más filas candidatas
    }
    this.logger.log(`${table}: ${deleted} filas > ${this.retentionDays}d borradas`);
    return deleted;
  }
}
