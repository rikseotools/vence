import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Subconjunto del schema de Vence necesario para los crons de Etapa 1.
 * Copiado de `db/schema.ts` del repo principal (fuente de verdad: la BD).
 * En Etapa 2 se decidirá si compartir el schema completo vía un paquete.
 *
 * Solo se declaran las columnas que los crons leen/escriben — Drizzle
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
