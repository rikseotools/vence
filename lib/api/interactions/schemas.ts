// lib/api/interactions/schemas.ts - Schemas de validación para tracking de interacciones
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// CATEGORÍAS DE EVENTOS PERMITIDAS
// ============================================

export const eventCategories = [
  'test',
  'chat',
  'navigation',
  'ui',
  'auth',
  'error',
  'conversion',
  'psychometric'
] as const

export type EventCategory = typeof eventCategories[number]

// ============================================
// REQUEST: TRACK SINGLE INTERACTION
// ============================================

export const trackInteractionRequestSchema = z.object({
  // Identificadores
  userId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid().optional().nullable(),

  // Evento
  eventType: z.string().min(1).max(100),
  eventCategory: z.enum(eventCategories),
  component: z.string().max(100).optional().nullable(),
  action: z.string().max(100).optional().nullable(),
  label: z.string().max(500).optional().nullable(),
  value: z.record(z.unknown()).optional().default({}),

  // Contexto
  pageUrl: z.string().max(500).optional().nullable(),
  elementId: z.string().max(100).optional().nullable(),
  elementText: z.string().max(200).optional().nullable(),

  // Métricas
  responseTimeMs: z.number().int().min(0).optional().nullable(),

  // Dispositivo - acepta objeto o string (para compatibilidad con datos de localStorage/sendBeacon)
  deviceInfo: z.preprocess(
    (val) => {
      // Si es string, intentar parsearlo como JSON
      if (typeof val === 'string') {
        try {
          return JSON.parse(val)
        } catch {
          return {} // Si falla el parseo, devolver objeto vacío
        }
      }
      return val
    },
    z.object({
      platform: z.string().optional(),
      userAgent: z.string().optional(),
      screenWidth: z.number().optional(),
      screenHeight: z.number().optional(),
      language: z.string().optional(),
      timezone: z.string().optional(),
      isStandalone: z.boolean().optional(),
      isMobile: z.boolean().optional()
    }).optional().default({})
  )
})

export type TrackInteractionRequest = z.infer<typeof trackInteractionRequestSchema>

// ============================================
// REQUEST: TRACK BATCH INTERACTIONS
// ============================================

export const trackBatchInteractionsRequestSchema = z.object({
  events: z.array(trackInteractionRequestSchema).min(1).max(100)
})

export type TrackBatchInteractionsRequest = z.infer<typeof trackBatchInteractionsRequestSchema>

// ============================================
// RESPONSE: TRACK INTERACTION
// ============================================

export const trackInteractionResponseSchema = z.object({
  success: z.boolean(),
  eventId: z.string().uuid().optional(),
  count: z.number().int().optional()
})

export type TrackInteractionResponse = z.infer<typeof trackInteractionResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string()
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseInteractionRequest(data: unknown) {
  return trackInteractionRequestSchema.safeParse(data)
}

export function safeParseInteractionBatchRequest(data: unknown) {
  return trackBatchInteractionsRequestSchema.safeParse(data)
}

export function validateInteractionRequest(data: unknown): TrackInteractionRequest {
  return trackInteractionRequestSchema.parse(data)
}

export function validateInteractionBatchRequest(data: unknown): TrackBatchInteractionsRequest {
  return trackBatchInteractionsRequestSchema.parse(data)
}
