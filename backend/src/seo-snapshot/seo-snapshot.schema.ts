import { pgTable, text, integer, numeric, date, boolean, uuid } from 'drizzle-orm/pg-core';

/**
 * Tablas del tracker SEO necesarias para el cron seo-snapshot. Existen en la BD
 * por la migración `supabase/migrations/20260602_seo_keyword_tracking.sql`; aquí
 * se declara solo el subconjunto de columnas que lee/escribe este cron (schema
 * local del módulo, no en el schema principal del backend). Drizzle mapea el
 * subconjunto sin problema.
 */
export const seoKeywordTargets = pgTable('seo_keyword_targets', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  keyword: text('keyword').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const seoKeywordSnapshots = pgTable('seo_keyword_snapshots', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  keyword: text('keyword').notNull(),
  capturedOn: date('captured_on').notNull(),
  position: numeric('position'),
  impressions: integer('impressions').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  ctr: numeric('ctr'),
  source: text('source').default('gsc').notNull(),
});
