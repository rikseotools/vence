import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Tabla `convocatoria_notas` (migración 20260627_convocatoria_notas.sql).
 * Cada nota informativa/aclaratoria leída del seguimiento_url de una oposición,
 * con las señales extraídas. Cola de triaje del sensor detect-notas-convocatoria.
 */
export const convocatoriaNotas = pgTable('convocatoria_notas', {
  id: uuid('id').primaryKey().defaultRandom(),
  oposicionId: uuid('oposicion_id').notNull(),
  url: text('url').notNull(),
  title: text('title'),
  contentHash: text('content_hash'),
  signals: jsonb('signals').notNull().default({}),
  llmExtraction: jsonb('llm_extraction'),
  confianza: text('confianza'),
  needsManual: boolean('needs_manual').notNull().default(false),
  triada: boolean('triada').notNull().default(false),
  firstSeen: timestamp('first_seen', { mode: 'string' }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { mode: 'string' }).notNull().defaultNow(),
});

/** Subconjunto de `oposiciones` que lee este sensor. */
export const oposiciones = pgTable('oposiciones', {
  id: uuid('id').primaryKey().notNull(),
  nombre: text('nombre').notNull(),
  slug: text('slug'),
  seguimientoUrl: text('seguimiento_url'),
  fetcherType: text('fetcher_type'),
  examDate: text('exam_date'),
  isActive: boolean('is_active').default(true),
});

export type ConvocatoriaNotaRow = typeof convocatoriaNotas.$inferSelect;
