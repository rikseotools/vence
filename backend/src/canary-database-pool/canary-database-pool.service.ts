import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Canary database pool — detecta saturación PgBouncer / max_connections
 * agotados que CI NO puede cubrir (es runtime puro bajo carga real).
 *
 * Query trivial `SELECT 1` con timeout 1s. Si pool está saturado o BD
 * caída, el query NO completa en 1s → emit critical. Mucho antes de
 * que los users vean 5xx en endpoints reales.
 *
 * NO duplica tests CI: los tests integración corren contra BD limpia
 * sin carga. Este canary detecta saturación EN PRODUCCIÓN.
 *
 * Origen: docs/roadmap/canary-y-simulaciones.md §Sprint 5 (canarios
 * de infra, los únicos que pasan la regla anti-duplicación CI).
 */
@Injectable()
export class CanaryDatabasePoolService {
  private readonly logger = new Logger(CanaryDatabasePoolService.name);

  // 1s es agresivo a propósito: SELECT 1 con pool sano debe responder
  // en <50ms. Si tarda >1s, hay un problema real (pool saturado, BD
  // sobrecargada, network issue). Mejor false positive ocasional que
  // dejar saturación silenciosa.
  private readonly QUERY_TIMEOUT_MS = 1_000;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanaryDbPoolResult> {
    const startedAt = Date.now();

    try {
      // Promise.race con timeout manual — db.execute no acepta AbortSignal.
      const result = await Promise.race([
        this.db.execute(sql`SELECT 1 AS canary_ping`),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Query timeout >${this.QUERY_TIMEOUT_MS}ms`)),
            this.QUERY_TIMEOUT_MS,
          ),
        ),
      ]);

      const durationMs = Date.now() - startedAt;

      // Validación trivial: postgres-js devuelve array de filas como objeto-like.
      // Aceptamos cualquier respuesta no vacía como OK (la conexión funcionó).
      const rows = result as unknown as Array<{ canary_ping?: number }>;
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          ok: false,
          step: 'validate_response',
          errorMessage: `SELECT 1 devolvió respuesta inesperada: ${JSON.stringify(rows).slice(0, 100)}`,
          durationMs,
        };
      }

      return { ok: true, durationMs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout/i.test(msg);
      return {
        ok: false,
        step: isTimeout ? 'timeout' : 'query',
        errorMessage: msg,
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

export type CanaryDbPoolResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      step: 'timeout' | 'query' | 'validate_response';
      errorMessage: string;
      durationMs: number;
    };
