// lib/api/newsletters/schemas.ts - Schemas de validación para newsletters
import { z } from 'zod/v3'

// ============================================
// TIPOS DE AUDIENCIA
// ============================================

// Tipos generales de audiencia
const generalAudienceTypes = ['all', 'active', 'inactive', 'premium', 'free'] as const

// Tipos de oposición disponibles (deben coincidir con target_oposicion en user_profiles)
export const oposicionTypes = [
  'auxiliar_administrativo_estado',
  'administrativo_estado',
  'tramitacion_procesal',
  'auxilio_judicial',
  'gestion_procesal'
] as const

// Mapeo de oposición a nombre legible
export const oposicionDisplayNames: Record<typeof oposicionTypes[number], string> = {
  'auxiliar_administrativo_estado': 'Auxiliar Administrativo del Estado',
  'administrativo_estado': 'Administrativo del Estado',
  'tramitacion_procesal': 'Tramitación Procesal',
  'auxilio_judicial': 'Auxilio Judicial',
  'gestion_procesal': 'Gestión Procesal',
}

// Schema de tipo de audiencia (combina generales + oposiciones)
export const audienceTypeSchema = z.enum([
  ...generalAudienceTypes,
  ...oposicionTypes
])

export type AudienceType = z.infer<typeof audienceTypeSchema>

// ============================================
// REQUEST: ENVIAR NEWSLETTER
// ============================================

export const sendNewsletterRequestSchema = z.object({
  subject: z.string().min(1, 'El asunto es requerido').max(200, 'El asunto es demasiado largo'),
  htmlContent: z.string().min(1, 'El contenido HTML es requerido'),
  audienceType: audienceTypeSchema.optional(),
  selectedUserIds: z.array(z.string().uuid()).optional(),
  fromName: z.string().default('Vence'),
  fromEmail: z.string().email().default('info@vence.es'),
  testMode: z.boolean().default(false),
  templateId: z.string().optional().nullable()
}).refine(
  data => data.audienceType || (data.selectedUserIds && data.selectedUserIds.length > 0),
  { message: 'Debe especificar audienceType o selectedUserIds' }
)

export type SendNewsletterRequest = z.infer<typeof sendNewsletterRequestSchema>

// ============================================
// RESPONSE: ENVIAR NEWSLETTER
// ============================================

export const sendNewsletterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  total: z.number().int().min(0),
  sent: z.number().int().min(0),
  failed: z.number().int().min(0),
  audienceType: audienceTypeSchema.optional(),
  testMode: z.boolean().optional(),
  errors: z.array(z.object({
    email: z.string(),
    error: z.string()
  })).optional()
})

export type SendNewsletterResponse = z.infer<typeof sendNewsletterResponseSchema>

// ============================================
// ESTADÍSTICAS DE AUDIENCIA
// ============================================

export const audienceStatsSchema = z.object({
  general: z.object({
    all: z.number().int().min(0),
    active: z.number().int().min(0),
    inactive: z.number().int().min(0),
    premium: z.number().int().min(0),
    free: z.number().int().min(0)
  }),
  byOposicion: z.array(z.object({
    key: z.string(),
    name: z.string(),
    count: z.number().int().min(0)
  }))
})

export type AudienceStats = z.infer<typeof audienceStatsSchema>

// ============================================
// VARIABLES DE PERSONALIZACIÓN
// ============================================

export const newsletterVariablesSchema = z.object({
  nombre: z.string().optional().nullable(),
  oposicion: z.string().optional().nullable(),
  email: z.string().email()
})

export type NewsletterVariables = z.infer<typeof newsletterVariablesSchema>

// ============================================
// USUARIO ELEGIBLE PARA NEWSLETTER
// ============================================

export const eligibleUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  targetOposicion: z.string().nullable()
})

export type EligibleUser = z.infer<typeof eligibleUserSchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseSendRequest(data: unknown) {
  return sendNewsletterRequestSchema.safeParse(data)
}

export function validateSendRequest(data: unknown): SendNewsletterRequest {
  return sendNewsletterRequestSchema.parse(data)
}
