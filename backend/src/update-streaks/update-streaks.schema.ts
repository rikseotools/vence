import {
  date,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Subconjunto del schema de Vence necesario para el cron `update-streaks`.
 * Copiado de `db/schema.ts` del repo principal (fuente de verdad: la BD).
 * Solo se declaran las columnas que el cron lee/escribe.
 */

/** Tabla `user_test_sessions` — fuente de actividad para calcular rachas. */
export const userTestSessions = pgTable(
  'user_test_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    userId: uuid('user_id').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('idx_user_test_sessions_completed').using(
      'btree',
      table.completedAt.asc().nullsLast(),
    ),
    index('idx_user_test_sessions_user_id').using(
      'btree',
      table.userId.asc().nullsLast(),
    ),
  ],
);

/** Tabla `user_streaks` — almacena la racha calculada por usuario. */
export const userStreaks = pgTable(
  'user_streaks',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`).notNull(),
    userId: uuid('user_id').notNull(),
    currentStreak: integer('current_streak').default(0),
    longestStreak: integer('longest_streak').default(0),
    lastActivityDate: date('last_activity_date'),
    streakUpdatedAt: timestamp('streak_updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('idx_user_streaks_current_streak').using(
      'btree',
      table.currentStreak.desc().nullsFirst(),
    ),
    index('idx_user_streaks_user_id').using('btree', table.userId.asc().nullsLast()),
    unique('user_streaks_user_id_key').on(table.userId),
  ],
);
