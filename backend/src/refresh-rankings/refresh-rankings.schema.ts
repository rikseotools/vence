import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto de la tabla `ranking_cache` necesario para el cron
 * `refresh-rankings`.
 *
 * El cron solo llama a `refresh_ranking_cache()` via SQL y NO interactúa
 * directamente con esta tabla — la función SQL la gestiona internamente.
 * La declaración aquí sirve como documentación tipada de la estructura
 * y queda disponible si en el futuro se necesita consultar la caché
 * desde este módulo.
 *
 * Fuente de verdad: migración `supabase/migrations/20260517_ranking_cache.sql`
 * del repo principal.
 */
export const rankingCache = pgTable('ranking_cache', {
  timeFilter: text('time_filter').notNull(),
  userId: uuid('user_id').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  correctAnswers: integer('correct_answers').notNull(),
  accuracy: numeric('accuracy').notNull(),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * Tipo de cada fila devuelta por la función SQL `refresh_ranking_cache()`.
 * Usada para tipar el resultado de `db.execute(sql`SELECT * FROM refresh_ranking_cache()`)`.
 */
export interface RefreshRankingCacheRow {
  filter_name: string;
  rows_inserted: number;
  duration_ms: number;
}
