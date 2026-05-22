import { boolean, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto de la tabla `tests` necesario para el cron `refresh-theme-cache`.
 * Solo se declaran las columnas que se leen — Drizzle mapea el subconjunto sin problema.
 * Fuente de verdad: `db/schema.ts` del repo principal.
 */
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  isCompleted: boolean('is_completed').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
