// db/oposicionesSsot.ts
// Vista SSOT del PROCESO: drop-in type-safe de `oposiciones` cuyos campos temporales
// (plazas/fechas/estado/BOE/OEP/landing_*) ya vienen resueltos desde la convocatoria
// vigente (`convocatorias` is_current) con fallback a las columnas legacy de `oposiciones`.
//
// El merge vive UNA sola vez en la vista SQL:
//   supabase/migrations/20260706_oposiciones_ssot_view.sql
// Roadmap: docs/roadmap/consolidacion-convocatorias-radar-ssot.md
//
// Mismas columnas/nombres que `oposiciones` → los lectores solo cambian
// `.from(oposiciones)` → `.from(oposicionesSsot)` (SOLO lecturas; las escrituras
// siguen yendo a la tabla `oposiciones`).
import { pgView, uuid, text, date, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const oposicionesSsot = pgView('oposiciones_ssot', {
  id: uuid().notNull(),
  nombre: text().notNull(),
  tipoAcceso: text('tipo_acceso').notNull(),
  administracion: text().notNull(),
  categoria: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  slug: text(),
  shortName: text('short_name'),
  grupo: text(),
  subgrupo: text(),
  examDate: date('exam_date'),
  inscriptionStart: date('inscription_start'),
  inscriptionDeadline: date('inscription_deadline'),
  boePublicationDate: date('boe_publication_date'),
  boeReference: text('boe_reference'),
  plazasLibres: integer('plazas_libres'),
  plazasPromocionInterna: integer('plazas_promocion_interna'),
  plazasDiscapacidad: integer('plazas_discapacidad'),
  temasCount: integer('temas_count'),
  bloquesCount: integer('bloques_count'),
  tituloRequerido: text('titulo_requerido'),
  salarioMin: integer('salario_min'),
  salarioMax: integer('salario_max'),
  isActive: boolean('is_active'),
  isConvocatoriaActiva: boolean('is_convocatoria_activa'),
  programaUrl: text('programa_url'),
  diarioOficial: text('diario_oficial'),
  diarioReferencia: text('diario_referencia'),
  seguimientoUrl: text('seguimiento_url'),
  estadoProceso: text('estado_proceso'),
  oepDecreto: text('oep_decreto'),
  oepFecha: date('oep_fecha'),
  convocatoriaNumero: text('convocatoria_numero'),
  convocatoriaFecha: date('convocatoria_fecha'),
  convocatoriaDogv: text('convocatoria_dogv'),
  examDateApproximate: boolean('exam_date_approximate'),
  landingFaqs: jsonb('landing_faqs'),
  examenConfig: jsonb('examen_config'),
  colorPrimario: text('color_primario'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  requisitosEspeciales: jsonb('requisitos_especiales'),
  landingEstadisticas: jsonb('landing_estadisticas'),
}).existing()
