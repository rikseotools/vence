import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Subconjunto de columnas de `oposiciones` necesario para el cron check-seguimiento.
 *
 * Las columnas `seguimiento_last_hash`, `seguimiento_last_checked`,
 * `seguimiento_change_status` y `seguimiento_change_detected_at` existen en la
 * BD pero no están en el schema principal de Drizzle (db/schema.ts). Se declaran
 * aquí para que el servicio pueda acceder a ellas de forma tipada.
 *
 * Nota: solo se declaran las columnas que lee/escribe este cron. Drizzle mapea
 * el subconjunto sin problemas.
 */
export const oposiciones = pgTable('oposiciones', {
  id: uuid('id').primaryKey().notNull(),
  nombre: text('nombre').notNull(),
  slug: text('slug'),
  shortName: text('short_name'),
  isActive: boolean('is_active').default(true),
  seguimientoUrl: text('seguimiento_url'),
  seguimientoLastHash: text('seguimiento_last_hash'),
  seguimientoLastChecked: timestamp('seguimiento_last_checked', { mode: 'string' }),
  seguimientoChangeStatus: text('seguimiento_change_status'),
  seguimientoChangeDetectedAt: timestamp('seguimiento_change_detected_at', { mode: 'string' }),
});

/**
 * Tabla `oep_detection_signals` — usada para insertar señales `hash_change`.
 */
export const oepDetectionSignals = pgTable('oep_detection_signals', {
  id: uuid('id').default(sql`uuid_generate_v4()`).primaryKey().notNull(),
  oposicionId: uuid('oposicion_id'),
  sourceId: uuid('source_id'),
  regionName: text('region_name'),
  positionCategory: text('position_category'),
  detectedOposicionName: text('detected_oposicion_name'),
  sensorType: text('sensor_type').notNull(),
  sourceUrl: text('source_url'),
  detectedYear: integer('detected_year'),
  detectedPlazasLibre: integer('detected_plazas_libre'),
  detectedPlazasDiscapacidad: integer('detected_plazas_discapacidad'),
  detectedPlazasPromocionInterna: integer('detected_plazas_promocion_interna'),
  detectedBocRef: text('detected_boc_ref'),
  detectedFechaPublicacion: text('detected_fecha_publicacion'),
  detectedFechaInscripcionFin: text('detected_fecha_inscripcion_fin'),
  detectedFechaExamen: text('detected_fecha_examen'),
  detectedEstado: text('detected_estado'),
  confidenceScore: integer('confidence_score').notNull(),
  isNovel: boolean('is_novel').default(false).notNull(),
  signalSummary: text('signal_summary').notNull(),
  rawExtraction: jsonb('raw_extraction').default({}),
  status: text('status').default('pending').notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  reviewedBy: uuid('reviewed_by'),
  adminNotes: text('admin_notes'),
  dedupeKey: text('dedupe_key').unique('oep_detection_signals_dedupe_key_unique'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

/** Tipos inferidos para uso en el servicio. */
export type OposicionRow = typeof oposiciones.$inferSelect;
export type OepDetectionSignalInsert = typeof oepDetectionSignals.$inferInsert;
