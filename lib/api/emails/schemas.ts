// lib/api/emails/schemas.ts - Schemas de validación para el sistema de emails v2
import { z } from 'zod/v3'

// ============================================
// EMAIL CATEGORIES
// ============================================

/**
 * 3 categorías de email que corresponden a la UI de preferencias:
 *
 * 1. soporte: Transaccional (impugnaciones, soporte, compras)
 *    - Controlado por email_soporte_disabled
 *    - NO bloqueado por unsubscribed_all
 *
 * 2. newsletter: Boletines y novedades (BOE, actualizaciones)
 *    - Controlado por email_newsletter_disabled
 *    - Bloqueado por unsubscribed_all
 *
 * 3. marketing: Engagement y retención (reactivación, motivación, resumen)
 *    - Controlado por toggles individuales + unsubscribed_all
 *    - Bloqueado por unsubscribed_all (master toggle)
 *
 * 4. admin: Notificaciones internas al equipo (sin preference check)
 */
export const EMAIL_CATEGORIES = ['soporte', 'newsletter', 'marketing', 'admin'] as const
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

// ============================================
// EMAIL TYPES
// ============================================

export const EMAIL_TYPES = [
  // Soporte (transactional)
  'impugnacion_respuesta',
  'soporte_respuesta',
  // Newsletter
  'newsletter',
  'newsletter_oposicion',
  // Marketing/Engagement
  'reactivacion',
  'urgente',
  'bienvenida_motivacional',
  'bienvenida_inmediato',
  'resumen_semanal',
  'topic_unlock',
  'medal_congratulation',
  // Templates sin categoría de preferencia (admin/internal)
  'modal_articulos_mejora',
  'mejoras_producto',
  'lanzamiento_premium',
  'recordatorio_renovacion',
  'pago_fallido',
  'admin_notification',
] as const

export type EmailType = (typeof EMAIL_TYPES)[number]

export const emailTypeSchema = z.enum(EMAIL_TYPES)

// ============================================
// TYPE → CATEGORY MAPPING
// ============================================

export const EMAIL_TYPE_TO_CATEGORY: Record<EmailType, EmailCategory> = {
  // Soporte
  impugnacion_respuesta: 'soporte',
  soporte_respuesta: 'soporte',
  // Newsletter
  newsletter: 'newsletter',
  newsletter_oposicion: 'newsletter',
  // Marketing
  reactivacion: 'marketing',
  urgente: 'marketing',
  bienvenida_motivacional: 'marketing',
  bienvenida_inmediato: 'marketing',
  resumen_semanal: 'marketing',
  topic_unlock: 'marketing',
  medal_congratulation: 'marketing',
  // Marketing (sin toggle individual, bloqueados por unsubscribed_all)
  modal_articulos_mejora: 'marketing',
  mejoras_producto: 'marketing',
  lanzamiento_premium: 'marketing',
  // Transaccional (aviso de cobro/pago, no bloqueado por unsubscribed_all)
  recordatorio_renovacion: 'soporte',
  pago_fallido: 'soporte',
  // Admin/internal
  admin_notification: 'admin',
}

// ============================================
// SEND EMAIL REQUEST/RESPONSE
// ============================================

export const sendEmailRequestSchema = z.object({
  userId: z.string().uuid(),
  emailType: emailTypeSchema,
  customData: z.record(z.unknown()).optional().default({}),
})

export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>

export const sendEmailResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    emailId: z.string(),
  }),
  z.object({
    success: z.literal(false),
    cancelled: z.literal(true),
    reason: z.string(),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    cancelled: z.literal(false).optional(),
    error: z.string(),
  }),
])

export type SendEmailResponse = z.infer<typeof sendEmailResponseSchema>

// ============================================
// CAN SEND CHECK
// ============================================

export const canSendResultSchema = z.object({
  canSend: z.boolean(),
  reason: z.string().optional(),
})

export type CanSendResult = z.infer<typeof canSendResultSchema>

// ============================================
// EMAIL PREFERENCES (DB shape)
// ============================================

export const emailPreferencesSchema = z.object({
  email_reactivacion: z.boolean(),
  email_urgente: z.boolean(),
  email_bienvenida_motivacional: z.boolean(),
  email_bienvenida_inmediato: z.boolean(),
  email_resumen_semanal: z.boolean(),
  unsubscribed_all: z.boolean(),
  email_soporte_disabled: z.boolean(),
  email_newsletter_disabled: z.boolean(),
})

export type EmailPreferences = z.infer<typeof emailPreferencesSchema>

// ============================================
// DISPUTE EMAIL REQUEST
// ============================================

// Formato 1: Admin panel envía { disputeId }
// Formato 2: Supabase Database Webhook envía { record: { id, user_id, ... } }
export const sendDisputeEmailRequestSchema = z.union([
  z.object({
    disputeId: z.string().uuid(),
  }),
  z.object({
    type: z.string(),
    table: z.string(),
    schema: z.string(),
    record: z.object({
      id: z.string().uuid(),
      user_id: z.string().uuid(),
      question_id: z.string().uuid(),
      status: z.string(),
      admin_response: z.string().nullable(),
      resolved_at: z.string().nullable(),
    }).passthrough(),
    old_record: z.record(z.unknown()).optional(),
  }),
])

export type SendDisputeEmailRequest = z.infer<typeof sendDisputeEmailRequestSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseSendEmailRequest(data: unknown) {
  return sendEmailRequestSchema.safeParse(data)
}

export function validateSendEmailRequest(data: unknown): SendEmailRequest {
  return sendEmailRequestSchema.parse(data)
}

export function safeParseSendDisputeEmailRequest(data: unknown) {
  return sendDisputeEmailRequestSchema.safeParse(data)
}

export function validateSendDisputeEmailRequest(data: unknown): SendDisputeEmailRequest {
  return sendDisputeEmailRequestSchema.parse(data)
}

export function getEmailCategory(emailType: string): EmailCategory | null {
  return EMAIL_TYPE_TO_CATEGORY[emailType as EmailType] ?? null
}
