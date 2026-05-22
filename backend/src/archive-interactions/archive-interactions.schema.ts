import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto de columnas de `user_interactions` necesarias para el cron
 * `archive-interactions`. Solo se declaran las columnas que las queries
 * referencian — Drizzle mapea el subconjunto sin problema.
 *
 * Fuente de verdad: `db/schema.ts` del repo principal.
 */

/** Tabla de interacciones activas (datos <30 días). */
export const userInteractions = pgTable('user_interactions', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  sessionId: uuid('session_id'),
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  component: text('component'),
  action: text('action'),
  label: text('label'),
  value: jsonb('value').default({}),
  pageUrl: text('page_url'),
  elementId: text('element_id'),
  elementText: text('element_text'),
  responseTimeMs: text('response_time_ms'), // integer en BD, text aquí basta para ignorarlo
  deviceInfo: jsonb('device_info').default({}),
  deployVersion: text('deploy_version'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * Tabla de archivo de interacciones (datos 30 días – 6 meses).
 * Tiene la misma estructura que `user_interactions`; las filas se mueven
 * mediante INSERT … SELECT + DELETE en una CTE para garantizar atomicidad.
 */
export const userInteractionsArchive = pgTable('user_interactions_archive', {
  id: uuid('id').primaryKey().notNull(),
  userId: uuid('user_id'),
  sessionId: uuid('session_id'),
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  component: text('component'),
  action: text('action'),
  label: text('label'),
  value: jsonb('value').default({}),
  pageUrl: text('page_url'),
  elementId: text('element_id'),
  elementText: text('element_text'),
  responseTimeMs: text('response_time_ms'),
  deviceInfo: jsonb('device_info').default({}),
  deployVersion: text('deploy_version'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
