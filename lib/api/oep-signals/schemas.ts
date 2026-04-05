// lib/api/oep-signals/schemas.ts
// Schemas Zod para señales de detección de OEPs (sistema multi-sensor)
import { z } from 'zod/v3'

// ============================================
// ENUMS
// ============================================

export const sensorTypeOptions = ['llm_semantic', 'timeline_silence', 'rss', 'boe_api', 'google_cse', 'manual'] as const
export const signalStatusOptions = ['pending', 'applied', 'dismissed', 'auto_applied'] as const

export type SensorType = typeof sensorTypeOptions[number]
export type SignalStatus = typeof signalStatusOptions[number]

// ============================================
// EXTRACCIÓN LLM (lo que devuelve Claude)
// ============================================

export const llmExtractionSchema = z.object({
  hasOepInfo: z.boolean().describe('¿La página contiene info clara de una OEP/convocatoria?'),
  year: z.number().int().nullable().describe('Año de la OEP detectada (ej: 2025, 2026)'),
  plazasLibre: z.number().int().nullable(),
  plazasDiscapacidad: z.number().int().nullable(),
  plazasPromocionInterna: z.number().int().nullable(),
  bocRef: z.string().nullable().describe('Referencia del boletín (ej: BOC-A-2026-057-948)'),
  fechaPublicacion: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  fechaInscripcionFin: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  fechaExamen: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  estado: z.enum(['oep_aprobada', 'convocada', 'inscripcion_abierta', 'inscripcion_cerrada', 'lista_admitidos', 'pendiente_examen', 'examen_realizado', 'resultados']).nullable(),
  summary: z.string().describe('Resumen en una frase de lo detectado'),
})
export type LlmExtraction = z.infer<typeof llmExtractionSchema>

// ============================================
// INSERT SIGNAL
// ============================================

export const createSignalSchema = z.object({
  oposicionId: z.string().uuid(),
  sensorType: z.enum(sensorTypeOptions),
  sourceUrl: z.string().url().nullable().optional(),
  detectedYear: z.number().int().nullable().optional(),
  detectedPlazasLibre: z.number().int().nullable().optional(),
  detectedPlazasDiscapacidad: z.number().int().nullable().optional(),
  detectedPlazasPromocionInterna: z.number().int().nullable().optional(),
  detectedBocRef: z.string().nullable().optional(),
  detectedFechaPublicacion: z.string().nullable().optional(),
  detectedFechaInscripcionFin: z.string().nullable().optional(),
  detectedFechaExamen: z.string().nullable().optional(),
  detectedEstado: z.string().nullable().optional(),
  confidenceScore: z.number().int().min(0).max(100),
  isNovel: z.boolean().default(false),
  signalSummary: z.string().min(1),
  rawExtraction: z.record(z.unknown()).optional(),
  dedupeKey: z.string().nullable().optional(),
})
export type CreateSignalInput = z.infer<typeof createSignalSchema>

// ============================================
// SIGNAL ROW (de BD)
// ============================================

export const signalRowSchema = z.object({
  id: z.string().uuid(),
  oposicionId: z.string().uuid(),
  oposicionNombre: z.string().nullable(),
  oposicionSlug: z.string().nullable(),
  sensorType: z.enum(sensorTypeOptions),
  sourceUrl: z.string().nullable(),
  detectedYear: z.number().int().nullable(),
  detectedPlazasLibre: z.number().int().nullable(),
  detectedPlazasDiscapacidad: z.number().int().nullable(),
  detectedPlazasPromocionInterna: z.number().int().nullable(),
  detectedBocRef: z.string().nullable(),
  detectedFechaPublicacion: z.string().nullable(),
  detectedFechaInscripcionFin: z.string().nullable(),
  detectedFechaExamen: z.string().nullable(),
  detectedEstado: z.string().nullable(),
  confidenceScore: z.number().int(),
  isNovel: z.boolean(),
  signalSummary: z.string(),
  status: z.enum(signalStatusOptions),
  reviewedAt: z.string().nullable(),
  adminNotes: z.string().nullable(),
  createdAt: z.string(),
})
export type SignalRow = z.infer<typeof signalRowSchema>

// ============================================
// REVIEW ACTION
// ============================================

export const reviewSignalSchema = z.object({
  signalId: z.string().uuid(),
  action: z.enum(['apply', 'dismiss']),
  adminNotes: z.string().nullable().optional(),
})
export type ReviewSignalInput = z.infer<typeof reviewSignalSchema>

// ============================================
// RESPONSES
// ============================================

export const listSignalsResponseSchema = z.object({
  success: z.boolean(),
  signals: z.array(signalRowSchema),
  counts: z.object({
    pending: z.number().int(),
    applied: z.number().int(),
    dismissed: z.number().int(),
  }),
})
export type ListSignalsResponse = z.infer<typeof listSignalsResponseSchema>

export const pendingSignalsCountResponseSchema = z.object({
  success: z.boolean(),
  pendingCount: z.number().int().min(0),
  criticalCount: z.number().int().min(0),
})
export type PendingSignalsCountResponse = z.infer<typeof pendingSignalsCountResponseSchema>

// ============================================
// SAFE PARSERS
// ============================================

export function safeParseCreateSignal(data: unknown) {
  return createSignalSchema.safeParse(data)
}

export function safeParseReviewSignal(data: unknown) {
  return reviewSignalSchema.safeParse(data)
}

export function safeParseLlmExtraction(data: unknown) {
  return llmExtractionSchema.safeParse(data)
}

// ============================================
// HELPERS
// ============================================

/**
 * Calcula score base según el sensor que la generó.
 * LLM=40, RSS=35, BOE=20, GoogleCSE=15, TimelineSilence=70, Manual=100
 */
export function baseScoreBySensor(sensor: SensorType): number {
  switch (sensor) {
    case 'timeline_silence': return 70
    case 'llm_semantic': return 40
    case 'rss': return 35
    case 'boe_api': return 20
    case 'google_cse': return 15
    case 'manual': return 100
  }
}

/**
 * Genera dedupe_key canónico.
 */
export function buildDedupeKey(params: {
  sensorType: SensorType
  oposicionId: string
  year?: number | null
  bocRef?: string | null
}): string {
  return [
    params.sensorType,
    params.oposicionId,
    params.year ?? 0,
    params.bocRef ?? 'null',
  ].join(':')
}
