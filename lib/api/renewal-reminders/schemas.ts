// lib/api/renewal-reminders/schemas.ts - Schemas de validación para recordatorios de renovación
import { z } from 'zod'

// ============================================
// CONFIGURACIÓN DE RECORDATORIOS
// ============================================

export const reminderConfigSchema = z.object({
  daysBeforeRenewal: z.number().int().min(1).max(30).default(7),
  includeMonthly: z.boolean().default(true),
  includeSemester: z.boolean().default(true),
})

export type ReminderConfig = z.infer<typeof reminderConfigSchema>

// ============================================
// SUSCRIPCIÓN PARA RECORDATORIO
// ============================================

export const subscriptionForReminderSchema = z.object({
  id: z.string().uuid(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  userId: z.string().uuid(),
  status: z.string(),
  planType: z.string().nullable(),
  currentPeriodEnd: z.string(), // ISO date string
  cancelAtPeriodEnd: z.boolean(),
})

export type SubscriptionForReminder = z.infer<typeof subscriptionForReminderSchema>

// ============================================
// USUARIO CON SUSCRIPCIÓN
// ============================================

export const userWithSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  planType: z.string().nullable(),
  currentPeriodEnd: z.string(),
  daysUntilRenewal: z.number(),
  planAmount: z.number().nullable(),
})

export type UserWithSubscription = z.infer<typeof userWithSubscriptionSchema>

// ============================================
// REQUEST/RESPONSE PARA OBTENER SUSCRIPCIONES
// ============================================

export const getSubscriptionsForReminderRequestSchema = z.object({
  daysBeforeRenewal: z.number().int().min(1).max(30).default(7),
})

export type GetSubscriptionsForReminderRequest = z.infer<typeof getSubscriptionsForReminderRequestSchema>

export const getSubscriptionsForReminderResponseSchema = z.object({
  success: z.boolean(),
  subscriptions: z.array(userWithSubscriptionSchema).optional(),
  total: z.number().optional(),
  error: z.string().optional(),
})

export type GetSubscriptionsForReminderResponse = z.infer<typeof getSubscriptionsForReminderResponseSchema>

// ============================================
// ENVIAR RECORDATORIO
// ============================================

export const sendReminderRequestSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  daysUntilRenewal: z.number(),
  renewalDate: z.string(), // Fecha formateada
  planAmount: z.number(),
})

export type SendReminderRequest = z.infer<typeof sendReminderRequestSchema>

export const sendReminderResponseSchema = z.object({
  success: z.boolean(),
  emailId: z.string().optional(),
  error: z.string().optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
})

export type SendReminderResponse = z.infer<typeof sendReminderResponseSchema>

// ============================================
// CAMPAÑA DE RECORDATORIOS
// ============================================

export const runReminderCampaignRequestSchema = z.object({
  daysBeforeRenewal: z.number().int().min(1).max(30).default(7),
  dryRun: z.boolean().default(false), // Solo simular, no enviar
})

export type RunReminderCampaignRequest = z.infer<typeof runReminderCampaignRequestSchema>

export const reminderResultSchema = z.object({
  userId: z.string().uuid(),
  email: z.string(),
  success: z.boolean(),
  skipped: z.boolean(),
  skipReason: z.string().nullable(),
  emailId: z.string().nullable(),
  error: z.string().nullable(),
})

export type ReminderResult = z.infer<typeof reminderResultSchema>

export const runReminderCampaignResponseSchema = z.object({
  success: z.boolean(),
  total: z.number(),
  sent: z.number(),
  skipped: z.number(),
  failed: z.number(),
  results: z.array(reminderResultSchema).optional(),
  error: z.string().optional(),
})

export type RunReminderCampaignResponse = z.infer<typeof runReminderCampaignResponseSchema>

// ============================================
// VERIFICAR SI YA SE ENVIÓ RECORDATORIO
// ============================================

export const checkReminderSentRequestSchema = z.object({
  userId: z.string().uuid(),
  periodEnd: z.string(), // ISO date
})

export type CheckReminderSentRequest = z.infer<typeof checkReminderSentRequestSchema>

export const checkReminderSentResponseSchema = z.object({
  alreadySent: z.boolean(),
  sentAt: z.string().nullable(),
})

export type CheckReminderSentResponse = z.infer<typeof checkReminderSentResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateReminderConfig(data: unknown): ReminderConfig {
  return reminderConfigSchema.parse(data)
}

export function validateRunReminderCampaign(data: unknown): RunReminderCampaignRequest {
  return runReminderCampaignRequestSchema.parse(data)
}

export function safeParseReminderConfig(data: unknown) {
  return reminderConfigSchema.safeParse(data)
}

export function safeParseRunReminderCampaign(data: unknown) {
  return runReminderCampaignRequestSchema.safeParse(data)
}
