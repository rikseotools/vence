import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/** Filas borradas por tabla en una ejecución. */
export interface TelemetryRetentionResult {
  observableEventsDeleted: number;
  validationErrorLogsDeleted: number;
  batches: number;
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
    };

    // Se poda por `created_at` (hora de INSERCIÓN en BD, fiable y monotónica), NO
    // por la hora del evento: `observable_events.ts` puede venir corrupta (visto un
    // `ts`=2067 de un cliente) y esas filas con fecha futura nunca cumplirían
    // `ts < now()-30d` → crecerían para siempre. `created_at` no tiene ese agujero.
    result.observableEventsDeleted = await this.purgeTable(
      'observable_events',
      'created_at',
      (n) => (result.batches += n),
    );
    result.validationErrorLogsDeleted = await this.purgeTable(
      'validation_error_logs',
      'created_at',
      (n) => (result.batches += n),
    );

    // VACUUM (no FULL) al terminar si borramos algo: marca el espacio reutilizable
    // y refresca stats para que los planes (p.ej. el GROUP BY del panel admin) no
    // degraden. No FULL a propósito: no bloquea lecturas/escrituras.
    if (result.observableEventsDeleted > 0) {
      await this.db.execute(sql`VACUUM (ANALYZE) observable_events`);
    }
    if (result.validationErrorLogsDeleted > 0) {
      await this.db.execute(sql`VACUUM (ANALYZE) validation_error_logs`);
    }

    return result;
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
      const count =
        (res as unknown as { rowCount?: number }).rowCount ?? res.length ?? 0;
      deleted += count;
      onBatch(1);
      if (count < this.batchSize) break; // no quedan más filas candidatas
    }
    this.logger.log(`${table}: ${deleted} filas > ${this.retentionDays}d borradas`);
    return deleted;
  }
}
