// lib/api/boe-changes/schemas.ts - Schemas de validación para monitoreo BOE
import { z } from 'zod/v3'

// ============================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================

/**
 * Tolerancia de tamaño en bytes para considerar que hubo un cambio.
 * Un cambio de incluso 100 bytes puede indicar una modificación legal importante.
 */
export const SIZE_TOLERANCE_BYTES = 100

/**
 * Métodos de verificación disponibles
 */
export const checkMethods = [
  'head_unchanged',
  'cached_offset',
  'partial_50k',
  'partial_150k',
  'partial_300k',
  'full'
] as const

export type CheckMethod = typeof checkMethods[number]

/**
 * Estados de cambio de una ley
 */
export const changeStatuses = ['changed', 'reviewed', 'none'] as const
export type ChangeStatus = typeof changeStatuses[number]

// ============================================
// SCHEMAS: LEY PARA VERIFICACIÓN
// ============================================

export const lawForCheckSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  name: z.string(),
  boeUrl: z.string(),
  lastUpdateBoe: z.string().nullable().optional(),
  dateByteOffset: z.number().int().nullable().optional(),
  boeContentLength: z.number().int().nullable().optional()
})

// Tipo con campos requeridos para la verificación
export type LawForCheck = {
  id: string
  shortName: string
  name: string
  boeUrl: string
  lastUpdateBoe: string | null
  dateByteOffset: number | null
  boeContentLength: number | null
}

// ============================================
// SCHEMAS: RESULTADO DE VERIFICACIÓN
// ============================================

export const headCheckResultSchema = z.object({
  success: z.boolean(),
  method: z.literal('head_unchanged').optional(),
  unchanged: z.boolean().optional(),
  contentLength: z.number().int().nullable().optional(),
  reason: z.string().optional(),
  previousLength: z.number().int().nullable().optional(),
  bytesDownloaded: z.number().int().optional(),
  sizeChange: z.number().int().optional() // Nuevo: diferencia de tamaño
})

export type HeadCheckResult = z.infer<typeof headCheckResultSchema>

export const partialCheckResultSchema = z.object({
  success: z.boolean(),
  method: z.enum(['cached_offset', 'partial_50k', 'partial_150k', 'partial_300k']).optional(),
  lastUpdateBOE: z.string().optional(),
  bytesDownloaded: z.number().int().optional(),
  dateOffset: z.number().int().nullable().optional(),
  reason: z.string().optional()
})

export type PartialCheckResult = z.infer<typeof partialCheckResultSchema>

export const fullCheckResultSchema = z.object({
  success: z.boolean(),
  method: z.literal('full').optional(),
  lastUpdateBOE: z.string().nullable().optional(),
  bytesDownloaded: z.number().int().optional(),
  dateOffset: z.number().int().nullable().optional(),
  reason: z.string().optional()
})

export type FullCheckResult = z.infer<typeof fullCheckResultSchema>

// ============================================
// SCHEMAS: CAMBIO DETECTADO
// ============================================

export const detectedChangeSchema = z.object({
  law: z.string(),
  name: z.string(),
  oldDate: z.string().nullable(),
  newDate: z.string(),
  sizeChange: z.number().int().optional() // Diferencia de tamaño que causó la verificación
})

export type DetectedChange = z.infer<typeof detectedChangeSchema>

// ============================================
// SCHEMAS: ESTADÍSTICAS
// ============================================

export const checkStatsSchema = z.object({
  total: z.number().int(),
  checked: z.number().int(),
  headUnchanged: z.number().int(),
  sizeChangeDetected: z.number().int(), // Nuevo: cambios detectados por tamaño
  cachedOffset: z.number().int(),
  partial: z.number().int(),
  fullDownload: z.number().int(),
  changesDetected: z.number().int(),
  errors: z.number().int(),
  totalBytes: z.number().int()
})

export type CheckStats = z.infer<typeof checkStatsSchema>

// ============================================
// SCHEMAS: RESPUESTA DE API
// ============================================

export const checkBoeChangesResponseSchema = z.object({
  success: z.boolean(),
  duration: z.string().optional(),
  stats: checkStatsSchema.optional(),
  changes: z.array(detectedChangeSchema).optional(),
  timestamp: z.string().optional(),
  error: z.string().optional(),
  details: z.string().optional()
})

export type CheckBoeChangesResponse = z.infer<typeof checkBoeChangesResponseSchema>

// ============================================
// SCHEMAS: DATOS DE ACTUALIZACIÓN
// ============================================

export const lawUpdateDataSchema = z.object({
  lastChecked: z.string(),
  lastUpdateBoe: z.string().optional(),
  dateByteOffset: z.number().int().optional(),
  boeContentLength: z.number().int().optional(),
  changeStatus: z.enum(changeStatuses).optional(),
  changeDetectedAt: z.string().optional()
})

export type LawUpdateData = z.infer<typeof lawUpdateDataSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseCheckStats(data: unknown) {
  return checkStatsSchema.safeParse(data)
}

export function safeParseDetectedChange(data: unknown) {
  return detectedChangeSchema.safeParse(data)
}

export function validateLawForCheck(data: unknown): LawForCheck {
  const parsed = lawForCheckSchema.parse(data)
  return {
    id: parsed.id,
    shortName: parsed.shortName,
    name: parsed.name,
    boeUrl: parsed.boeUrl,
    lastUpdateBoe: parsed.lastUpdateBoe ?? null,
    dateByteOffset: parsed.dateByteOffset ?? null,
    boeContentLength: parsed.boeContentLength ?? null
  }
}
