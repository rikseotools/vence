import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { filasAfectadas } from '../db/filasAfectadas';

/** Tope del conteo de atraso: por encima solo importa «muchísimo», no el número exacto. */
export const ATRASO_TOPE = 200_000;

/** Resultado de una ejecución del cron. */
export interface ArchiveInteractionsResult {
  archived: number;
  deleted: number;
  batches: number;
  /**
   * Filas que QUEDAN por archivar al terminar (acotado a `ATRASO_TOPE`). Sin este
   * número, «archivadas: 0» y «no había nada que archivar» se leen igual — que es
   * cómo T-613 estuvo semanas invisible. Lo mira la regla `drenaje_atrasado`.
   */
  remaining: number;
}

/**
 * Servicio que archiva interacciones de usuario antiguas.
 *
 * Lógica portada de `app/api/cron/archive-interactions/route.ts`:
 *  1. Mueve filas de `user_interactions` con más de 30 días a
 *     `user_interactions_archive` en batches de 10 000 (máx. 20 batches/run).
 *  2. Elimina de `user_interactions_archive` las filas con más de 6 meses.
 *
 * A diferencia del cron de Vercel (timeout 5 min), aquí no hay presupuesto de
 * tiempo — si quedan filas tras los 20 batches, el siguiente run las procesa.
 */
@Injectable()
export class ArchiveInteractionsService {
  private readonly logger = new Logger(ArchiveInteractionsService.name);

  /** Filas por batch. 10 k evita statement timeout en Supabase. */
  private readonly batchSize = 10_000;

  /** Batches máximos por ejecución (200 k filas). */
  private readonly maxBatches = 20;

  /** Días antes de archivar una interacción. */
  private readonly archiveAfterDays = 30;

  /** Meses antes de eliminar del archivo. */
  private readonly deleteAfterMonths = 6;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Ejecuta el ciclo completo de archivado y limpieza.
   * Diseñado para ser llamado directamente desde el cron o desde un endpoint
   * de administración.
   */
  async run(): Promise<ArchiveInteractionsResult> {
    const startTime = Date.now();
    this.logger.log('Iniciando archivado de interacciones…');

    const result: ArchiveInteractionsResult = {
      archived: 0,
      deleted: 0,
      batches: 0,
      remaining: 0,
    };

    // ── FASE 1: archivar ──────────────────────────────────────────────────────
    for (let i = 0; i < this.maxBatches; i++) {
      const moved = await this.db.execute(sql`
        WITH to_move AS (
          SELECT id FROM user_interactions
          WHERE created_at < now() - interval '${sql.raw(String(this.archiveAfterDays))} days'
          LIMIT ${this.batchSize}
        ),
        inserted AS (
          INSERT INTO user_interactions_archive
          SELECT ui.* FROM user_interactions ui
          WHERE ui.id IN (SELECT id FROM to_move)
          RETURNING id
        )
        DELETE FROM user_interactions
        WHERE id IN (SELECT id FROM to_move)
      `);

      // OJO: postgres-js pone las filas afectadas en `count`, no en `rowCount` ni en
      // `length` (T-613). Leerlo mal cortaba el bucle en la 1.ª vuelta: 10 k por
      // noche en vez de 200 k, y reportando 0.
      const count = filasAfectadas(moved);
      result.archived += count;
      result.batches++;

      this.logger.debug(`Batch ${result.batches}: ${count} filas movidas`);

      if (count < this.batchSize) {
        // No quedan más filas candidatas — terminar anticipadamente.
        break;
      }
    }

    // ── FASE 2: limpiar archivo ───────────────────────────────────────────────
    const deleted = await this.db.execute(sql`
      DELETE FROM user_interactions_archive
      WHERE created_at < now() - interval '${sql.raw(String(this.deleteAfterMonths))} months'
    `);
    result.deleted = filasAfectadas(deleted);

    // Lo que queda para la próxima noche, medido DESPUÉS de archivar. Acotado: un
    // `count(*)` sobre 11 M filas es justo lo que no se puede hacer cada noche, y
    // para decidir «esto no drena» da igual 200 k que 2 M.
    const pendientes = await this.db.execute(sql`
      SELECT count(*)::int AS n FROM (
        SELECT 1 FROM user_interactions
        WHERE created_at < now() - interval '${sql.raw(String(this.archiveAfterDays))} days'
        LIMIT ${ATRASO_TOPE}
      ) x
    `);
    result.remaining =
      (pendientes as unknown as Array<{ n?: number }>)[0]?.n ?? 0;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(
      `Archivado completado en ${duration}s: ` +
        `archivadas ${result.archived} filas (${result.batches} batches), ` +
        `eliminadas ${result.deleted} filas >6 meses`,
    );

    return result;
  }
}
