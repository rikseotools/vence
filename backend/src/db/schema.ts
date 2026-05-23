import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto del schema de Vence necesario para los crons de Etapa 1
 * y los endpoints HTTP de Etapa 2 (Bloque 3 canary).
 * Copiado de `db/schema.ts` del repo principal (fuente de verdad: la BD).
 *
 * Solo se declaran las columnas que los handlers leen/escriben — Drizzle
 * mapea el subconjunto sin problema.
 */

/** Tabla `laws` — usada por el cron `check-boe-changes`. */
export const laws = pgTable('laws', {
  id: uuid('id').primaryKey().notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  slug: text('slug'),
  scope: text('scope').default('national'),
  boeUrl: text('boe_url'),
  lastChecked: timestamp('last_checked', { mode: 'string' }),
  changeStatus: text('change_status'),
  changeDetectedAt: timestamp('change_detected_at', { mode: 'string' }),
  lastUpdateBoe: text('last_update_boe'),
  dateByteOffset: integer('date_byte_offset'),
  boeContentLength: integer('boe_content_length'),
});

/** Tabla `user_medals` — usada por el endpoint GET /api/medals (Bloque 3 canary). */
export const userMedals = pgTable('user_medals', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id'),
  medalId: text('medal_id').notNull(),
  medalData: jsonb('medal_data').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  viewed: boolean('viewed').default(false),
});
