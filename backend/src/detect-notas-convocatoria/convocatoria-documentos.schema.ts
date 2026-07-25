import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `convocatoria_documentos` (migración 20260716_convocatoria_documentos_hitos_provenance.sql).
 *
 * El CORPUS del proceso: 1 fila por documento oficial (OEP, bases, correcciones, listas…).
 *  · `extractedText` = el documento ÍNTEGRO → evidencia durable. Sobrevive al link-rot y permite
 *    re-verificar sin re-descargar. Medido: 90 KB/boletín; todo lo que preparamos ≈ 10 MB.
 *  · `llmExtraction` = las partes esenciales, estructuradas (citas + confianza).
 * Los dos, no uno u otro. Con índice FTS (`tsv`, GIN): "¿dónde dice X?" en ~50 ms.
 */
export const convocatoriaDocumentos = pgTable('convocatoria_documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  convocatoriaId: uuid('convocatoria_id').notNull(),
  tipo: text('tipo').notNull(),
  url: text('url').notNull(),
  // Identidad canónica del documento (BOE/BOCM id o URL normalizada). La calcula boletin_doc_key
  // (espejo SQL de lib/convocatoria/canonicalizeBoletinUrl.cjs). Migración 20260725_provenance_doc_hub.
  docKey: text('doc_key'),
  titulo: text('titulo'),
  boletin: text('boletin'),
  referencia: text('referencia'),
  fechaPublicacion: date('fecha_publicacion'),
  contentHash: text('content_hash'),
  extractedText: text('extracted_text'),
  llmExtraction: jsonb('llm_extraction'),
  confianza: integer('confianza'),
  fuente: text('fuente').notNull().default('manual'),
  fetchedAt: timestamp('fetched_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
});

/** Convocatoria (subconjunto). El ciclo es INMUTABLE: ver 20260716_convocatoria_ciclo_inmutable.sql. */
export const convocatorias = pgTable('convocatorias', {
  id: uuid('id').primaryKey().notNull(),
  oposicionId: uuid('oposicion_id').notNull(),
  anio: integer('año').notNull(),
  isCurrent: text('is_current'),
  examDate: date('exam_date'),
  plazasLibres: integer('plazas_libres'),
  plazasPromocionInterna: integer('plazas_promocion_interna'),
});

/**
 * `content_health_findings`: el canal de entrega. kind → frase-gatillo → runbook
 * (`lib/admin/runbookRegistry.ts`, con guardarraíl que impide que registro y CLAUDE.md diverjan).
 */
export const contentHealthFindings = pgTable('content_health_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  oposicionSlug: text('oposicion_slug'),
  kind: text('kind'),
  message: text('message'),
  detail: jsonb('detail'),
  computedAt: timestamp('computed_at', { mode: 'string' }).notNull().defaultNow(),
});

export type ConvocatoriaDocumentoRow = typeof convocatoriaDocumentos.$inferSelect;
