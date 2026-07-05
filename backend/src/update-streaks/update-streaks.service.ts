import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export interface UpdateStreaksResult {
  activeUsers: number;
  updated: number;
  errors: number;
  resetCount: number;
}

/**
 * Recalcula las rachas de todos los usuarios delegando en la función SQL
 * canónica `public.batch_update_user_streaks()`.
 *
 * HISTORIA (fix 2026-07-05): la implementación anterior recalculaba en
 * TypeScript leyendo la tabla `user_test_sessions`, que quedó MUERTA tras la
 * migración agnóstica/RDS (la actividad real vive ahora en `tests` +
 * `test_questions`). Como `user_test_sessions` tenía ~0 filas recientes, el
 * paso de reset ponía la racha de CASI TODOS los usuarios a 0 cada noche a las
 * 03:00 UTC, machacando lo que el trigger realtime `update_user_streak_function`
 * calculaba bien. Resultado: el ranking de rachas salía casi vacío.
 *
 * La función SQL `batch_update_user_streaks()` es la fuente de verdad del
 * cálculo (misma lógica que el trigger realtime y que `calculate_user_streak`):
 * lee `test_questions JOIN tests`, usa timezone `Europe/Madrid`, calcula con
 * gaps-and-islands (1 día de gracia) y resetea SOLO a los inactivos reales.
 * Delegar en ella elimina la duplicación de lógica y el riesgo de divergencia.
 */
@Injectable()
export class UpdateStreaksService {
  private readonly logger = new Logger(UpdateStreaksService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<UpdateStreaksResult> {
    this.logger.log('Actualizando rachas vía batch_update_user_streaks()...');

    try {
      // Recompute canónico. Actualiza activos + resetea inactivos en una pasada.
      await this.db.execute(sql`SELECT public.batch_update_user_streaks()`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`batch_update_user_streaks() falló: ${msg}`);
      return { activeUsers: 0, updated: 0, errors: 1, resetCount: 0 };
    }

    // Métricas best-effort para observabilidad (la función SQL no las devuelve).
    let activeUsers = 0;
    let resetCount = 0;
    try {
      const rows = (await this.db.execute(sql`
        SELECT
          count(*) FILTER (WHERE current_streak > 0)::int AS active,
          count(*) FILTER (
            WHERE current_streak = 0
              AND streak_updated_at::date = (now() AT TIME ZONE 'Europe/Madrid')::date
          )::int AS reset_today
        FROM user_streaks
      `)) as unknown as Array<{ active: number; reset_today: number }>;
      activeUsers = rows[0]?.active ?? 0;
      resetCount = rows[0]?.reset_today ?? 0;
    } catch (err) {
      // Las métricas son informativas; no deben tumbar el cron si fallan.
      this.logger.warn(
        `No se pudieron leer métricas de rachas: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `Rachas actualizadas: ${activeUsers} activas, ${resetCount} reseteadas hoy`,
    );

    return { activeUsers, updated: activeUsers, errors: 0, resetCount };
  }
}
