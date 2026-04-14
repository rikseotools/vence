// lib/api/v2/feedback/schemas.ts
// Schemas Zod para el endpoint POST /api/v2/feedback/respond (respondFeedback).

import { z } from 'zod/v3'

// ============================================
// FINAL STATUS
// ============================================

export const feedbackFinalStatusSchema = z.enum(['resolved', 'dismissed'])
export type FeedbackFinalStatus = z.infer<typeof feedbackFinalStatusSchema>

// ============================================
// REQUEST
// ============================================

export const respondFeedbackRequestSchema = z.object({
  feedbackId: z.string().uuid('ID de feedback invalido'),
  adminUserId: z.string().uuid('ID de admin invalido'),
  // Mensaje opcional. Si undefined/vacio/whitespace → solo cierre de estado (sin INSERT msg,
  // sin campana, sin email). Si viene, triggerea el flujo completo modulado por los flags.
  message: z.string().max(5000, 'El mensaje no puede superar 5000 caracteres').optional(),
  // Estado final. Default: si hay mensaje → 'resolved'. Si no hay mensaje → sin UPDATE de status.
  finalStatus: feedbackFinalStatusSchema.optional(),
  // Desactivar email (default true si hay mensaje). Ignorado si no hay mensaje.
  sendEmail: z.boolean().optional(),
  // Desactivar campana (default true si hay mensaje). Ignorado si no hay mensaje o user_id null.
  sendBell: z.boolean().optional(),
})

export type RespondFeedbackRequest = z.infer<typeof respondFeedbackRequestSchema>

// ============================================
// EMAIL SKIP REASONS
// ============================================

export const emailSkipReasonSchema = z.enum([
  'empty_message',          // no había mensaje → nada que enviar
  'no_user_email',          // feedback externo sin email en payload ni en user_profiles
  'user_actively_browsing', // usuario con sesión <5s → verá en campana
  'user_preferences',       // sendEmailV2 devolvió { cancelled: true }
  'send_email_false_flag',  // caller pasó sendEmail: false explícitamente
]).nullable()

export type EmailSkipReason = z.infer<typeof emailSkipReasonSchema>

// ============================================
// BELL SKIP REASONS
// ============================================

export const bellSkipReasonSchema = z.enum([
  'empty_message',          // no había mensaje → nada que notificar
  'external_contact',       // feedback sin user_id (no se puede INSERT FK)
  'send_bell_false_flag',   // caller pasó sendBell: false explícitamente
]).nullable()

export type BellSkipReason = z.infer<typeof bellSkipReasonSchema>

// ============================================
// RESPONSE
// ============================================

export const respondFeedbackResponseSchema = z.object({
  success: z.literal(true),
  feedbackId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  bellSent: z.boolean(),
  bellSkipReason: bellSkipReasonSchema,
  emailSent: z.boolean(),
  emailId: z.string().nullable(),
  emailError: z.string().nullable(),
  emailSkipReason: emailSkipReasonSchema,
  finalStatus: feedbackFinalStatusSchema.nullable(),
})

export type RespondFeedbackResponse = z.infer<typeof respondFeedbackResponseSchema>

// ============================================
// ERROR
// ============================================

export const feedbackErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type FeedbackError = z.infer<typeof feedbackErrorSchema>
