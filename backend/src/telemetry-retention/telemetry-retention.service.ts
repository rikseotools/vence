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
   * Tablas cuyo DELETE por lotes se cortó con error (vacío si todo fue bien). [T-733]
   *
   * Mismo razonamiento que `vacuumFailed`, aplicado a la operación que SÍ importa: el 08/08 un
   * lote se pasó del `statement_timeout` y la excepción tumbó `run()` entero, así que el evento
   * que quedó en `observable_events` fue literalmente `{"status":"failure"}` — sin cuántas filas
   * se habían llegado a borrar, sin `remaining`, sin el mensaje del error. Un cron que falla y no
   * dice POR QUÉ obliga a reconstruir el diagnóstico a mano cada vez.
   *
   * Diferencia con `vacuumFailed`, y es importante: un VACUUM fallido sigue siendo
   * `status: 'success'` porque es higiene. Esto NO — si la purga se corta, el cron reporta error
   * y `cron_sin_exito` tiene que seguir disparando. Aquí no se silencia nada; solo se deja de
   * perder la medida.
   */
  purgaFallida: { tabla: string; error: string }[];
  /**
   * `true` si `observable_events` ya está particionada (T-360) y este `run()` retuvo por
   * `DROP PARTITION` (`partman.run_maintenance_proc()`) en vez de por DELETE. `false` mientras
   * la migración de particionado no se haya aplicado — que es el estado de HOY.
   */
  observableEventsPorParticion: boolean;
  /** Particiones de `observable_events` dropeadas en este `run()` (solo tiene sentido si `observableEventsPorParticion`). */
  observableEventsParticionesDropeadas: number;
}

/** Tope del conteo de atraso: por encima solo importa «muchísimo», no el número exacto. */
export const ATRASO_TOPE = 200_000;

/**
 * Filas por lote del DELETE. **10.000, no 50.000** — bajado el 08/08 tras medirlo. [T-733]
 *
 * Cada lote es UNA sentencia, así que compite contra el `statement_timeout` de 30 s del pool
 * (`connection.statement_timeout` en `database.module.ts`). Con 50.000 no cabía: el
 * `ctid IN (SELECT … LIMIT 50000)` sobre `observable_events` (6,9 GB, 10,7 M filas) se pasó del
 * plazo la noche del 08/08 y tiró todo el `run()`.
 *
 * Y no fue mala suerte de una noche, fue una espiral: el 07/08 falló el VACUUM, así que los
 * millones de tuplas muertas se quedaron sin compactar, así que el DELETE de la noche siguiente
 * tenía que escarbar más para encontrar sus 50.000 → también falló. Dos noches sin drenar dejaron
 * **918.040 filas pasadas de los 30 días de retención** (medido contra RDS el 08/08).
 *
 * El tope por pasada NO baja: `BATCH_SIZE × MAX_BATCHES` sigue siendo 2,5 M filas por tabla. Lo
 * único que cambia es que se llega en más sentencias y cada una cabe de sobra en los 30 s.
 *
 * ⚠️ Esto NO sustituye al particionado de [T-360], que es el arreglo de fondo (la retención pasa
 * a `DROP PARTITION`, sin DELETE ni VACUUM). Es lo que hace que la tabla drene MIENTRAS tanto.
 */
export const BATCH_SIZE = 10_000;

/** Lotes máximos por tabla y ejecución. Con `BATCH_SIZE` mantiene el techo de 2,5 M filas/tabla. */
export const MAX_BATCHES = 250;

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

  /** Filas por batch. Ver `BATCH_SIZE`. */
  private readonly batchSize = BATCH_SIZE;

  /** Batches máximos por tabla y ejecución (2,5 M filas/tabla). Acota locks y drena el backlog en varias noches. */
  private readonly maxBatches = MAX_BATCHES;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<TelemetryRetentionResult> {
    const result: TelemetryRetentionResult = {
      observableEventsDeleted: 0,
      validationErrorLogsDeleted: 0,
      batches: 0,
      remaining: {},
      vacuumFailed: [],
      purgaFallida: [],
      observableEventsPorParticion: false,
      observableEventsParticionesDropeadas: 0,
    };

    // [T-360] `observable_events` puede estar particionada por `created_at` (DROP PARTITION en vez
    // de DELETE) o no, según si la migración de `docs/roadmap/particionado-telemetria.md` ya se
    // aplicó. Se comprueba EN CADA `run()`, nunca se asume: así este cambio es seguro desplegarlo
    // ANTES de que la migración exista (sigue tomando la rama DELETE de siempre) y empieza a usar
    // `DROP PARTITION` solo, sin otro deploy, en cuanto la tabla pase a estar particionada.
    result.observableEventsPorParticion = await this.estaParticionada(
      'observable_events',
    );

    if (result.observableEventsPorParticion) {
      result.observableEventsParticionesDropeadas =
        await this.mantenerParticiones('observable_events');
    } else {
      // Se poda por `created_at` (hora de INSERCIÓN en BD, fiable y monotónica), NO
      // por la hora del evento: `observable_events.ts` puede venir corrupta (visto un
      // `ts`=2067 de un cliente) y esas filas con fecha futura nunca cumplirían
      // `ts < now()-30d` → crecerían para siempre. `created_at` no tiene ese agujero.
      result.observableEventsDeleted = await this.purgeTable(
        'observable_events',
        'created_at',
        (n) => (result.batches += n),
        (tabla, error) => result.purgaFallida.push({ tabla, error }),
      );
    }
    result.validationErrorLogsDeleted = await this.purgeTable(
      'validation_error_logs',
      'created_at',
      (n) => (result.batches += n),
      (tabla, error) => result.purgaFallida.push({ tabla, error }),
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
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `VACUUM (ANALYZE) ${table} falló (no bloqueante): ${msg}`,
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
   *
   * [T-613] El `ORDER BY tsColumn` del SELECT interno NO es cosmético, y es lo que
   * hace que el lote quepa en el `statement_timeout` que documenta T-733. Medido con
   * `EXPLAIN (ANALYZE, BUFFERS)` contra `observable_events` (6,2 M filas), mismo
   * filtro y mismo LIMIT: sin `ORDER BY`, Seq Scan, 8.124 ms y 145.058 buffers de
   * disco; con `ORDER BY`, Index Scan. Sin él, dos o tres iteraciones bastan para
   * pasarse de los 30 s y caer por el `catch` de abajo — o sea que las dos causas se
   * diagnosticaron por separado el mismo día y son la misma avería vista dos veces.
   */
  private async purgeTable(
    table: string,
    tsColumn: string,
    onBatch: (n: number) => void,
    onFallo: (tabla: string, error: string) => void,
  ): Promise<number> {
    let deleted = 0;
    for (let i = 0; i < this.maxBatches; i++) {
      let res: unknown;
      try {
        res = await this.db.execute(sql`
          DELETE FROM ${sql.raw(table)}
          WHERE ctid IN (
            SELECT ctid FROM ${sql.raw(table)}
            WHERE ${sql.raw(tsColumn)} < now() - interval '${sql.raw(String(this.retentionDays))} days'
            ORDER BY ${sql.raw(tsColumn)}
            LIMIT ${this.batchSize}
          )
        `);
      } catch (error) {
        // [T-733] Un lote que revienta (típicamente `statement_timeout`) corta el drenaje de ESTA
        // tabla, pero no puede llevarse por delante el `run()`: lo ya borrado cuenta, la otra tabla
        // se sigue purgando y `remaining` —que se calcula después— es justo el número que dice si
        // esto se está drenando o no. Se anota y se sale del bucle: si un lote no cabe en el
        // plazo, el siguiente tampoco va a caber.
        const mensaje = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `${table}: lote ${i + 1} falló tras ${deleted} filas — ${mensaje}`,
        );
        onFallo(table, mensaje);
        break;
      }
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
