import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Subconjunto de tablas usadas por los crons de sensores OEP.
 * Solo se declaran las columnas que leen/escriben estos crons.
 */

/** Tabla `oposiciones` — columnas que leen los sensores OEP. */
export const oposiciones = pgTable('oposiciones', {
  id: uuid('id').default(sql`uuid_generate_v4()`).primaryKey().notNull(),
  nombre: text('nombre').notNull(),
  slug: text('slug'),
  shortName: text('short_name'),
  subgrupo: text('subgrupo'),
  isActive: boolean('is_active').default(true),
  seguimientoUrl: text('seguimiento_url'),
  estadoProceso: text('estado_proceso'),
  oepFecha: date('oep_fecha'),
  convocatoriaNumero: text('convocatoria_numero'),
  plazasLibres: integer('plazas_libres'),
  plazasDiscapacidad: integer('plazas_discapacidad'),
  // Fechas de convocatoria — usadas por el cron `advance-estado` para avanzar
  // `estado_proceso` cuando un plazo/fecha vence (evita estados stale).
  inscriptionStart: date('inscription_start'),
  inscriptionDeadline: date('inscription_deadline'),
  examDate: date('exam_date'),
  examDateApproximate: boolean('exam_date_approximate'),
  // Sprint 2 backend integration: dispatch sensor LLM a Lambda Playwright.
  // Default 'http' (fetch nativo). 'headless' invoca Lambda con Chromium.
  fetcherType: text('fetcher_type').notNull().default('http'),
});

/** Tabla `convocatoria_hitos` — para detección de silencio en timeline. */
export const convocatoriaHitos = pgTable(
  'convocatoria_hitos',
  {
    id: uuid('id').default(sql`uuid_generate_v4()`).primaryKey().notNull(),
    oposicionId: uuid('oposicion_id').notNull(),
    fecha: date('fecha').notNull(),
    titulo: text('titulo').notNull(),
    descripcion: text('descripcion'),
    url: text('url'),
    status: text('status').notNull(),
    orderIndex: integer('order_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index('idx_convocatoria_hitos_oposicion').using(
      'btree',
      table.oposicionId,
      table.orderIndex,
    ),
  ],
);

/** Tabla `detection_sources` — fuentes regionales de OEPs. */
export const detectionSources = pgTable(
  'detection_sources',
  {
    id: uuid('id').default(sql`uuid_generate_v4()`).primaryKey().notNull(),
    sourceType: text('source_type').notNull(),
    regionName: text('region_name').notNull(),
    boletinName: text('boletin_name'),
    listingUrl: text('listing_url').notNull(),
    searchKeywords: text('search_keywords').array(),
    positionGroups: text('position_groups').array(),
    isActive: boolean('is_active').default(true).notNull(),
    notes: text('notes'),
    lastChecked: timestamp('last_checked', { withTimezone: true, mode: 'string' }),
    lastHash: text('last_hash'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'string' }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_detection_sources_url_unique').using(
      'btree',
      table.listingUrl,
    ),
  ],
);

/** Tabla `oep_detection_signals` — señales del sistema multi-sensor. */
export const oepDetectionSignals = pgTable(
  'oep_detection_signals',
  {
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
    detectedFechaPublicacion: date('detected_fecha_publicacion'),
    detectedFechaInscripcionFin: date('detected_fecha_inscripcion_fin'),
    detectedFechaExamen: date('detected_fecha_examen'),
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
  },
);

/** Tipos inferidos */
export type OposicionRow = typeof oposiciones.$inferSelect;
export type DetectionSourceRow = typeof detectionSources.$inferSelect;
export type OepDetectionSignalInsert = typeof oepDetectionSignals.$inferInsert;
