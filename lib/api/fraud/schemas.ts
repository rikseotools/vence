// lib/api/fraud/schemas.ts - Schemas de validación para alertas de fraude
import { z } from 'zod'

// ============================================
// TIPOS DE ALERTA
// ============================================

export const alertTypeSchema = z.enum([
  'same_ip',           // Múltiples cuentas con misma IP
  'same_device',       // Múltiples cuentas con mismo dispositivo
  'multi_account',     // Usuario con múltiples cuentas (nombre + otros criterios)
  'suspicious_premium', // Premium con múltiples ubicaciones
  'location_anomaly',  // Cambios de ubicación sospechosos
])

export type AlertType = z.infer<typeof alertTypeSchema>

export const severitySchema = z.enum(['low', 'medium', 'high', 'critical'])
export type Severity = z.infer<typeof severitySchema>

export const statusSchema = z.enum(['new', 'reviewed', 'dismissed', 'action_taken'])
export type AlertStatus = z.infer<typeof statusSchema>

// ============================================
// CREAR ALERTA
// ============================================

export const createFraudAlertRequestSchema = z.object({
  alertType: alertTypeSchema,
  severity: severitySchema.default('medium'),
  userIds: z.array(z.string().uuid()).min(1, 'Se requiere al menos un usuario'),
  details: z.object({
    ips: z.array(z.string()).optional(),
    devices: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    names: z.array(z.string()).optional(),
    emails: z.array(z.string()).optional(),
    hasPremium: z.boolean().optional(),
    description: z.string().optional(),
  }).optional().default({}),
  matchCriteria: z.string().optional(),
})

export type CreateFraudAlertRequest = z.infer<typeof createFraudAlertRequestSchema>

export const createFraudAlertResponseSchema = z.object({
  success: z.boolean(),
  alertId: z.string().uuid().optional(),
  error: z.string().optional(),
})

export type CreateFraudAlertResponse = z.infer<typeof createFraudAlertResponseSchema>

// ============================================
// OBTENER ALERTAS
// ============================================

export const getFraudAlertsRequestSchema = z.object({
  status: statusSchema.optional(),
  alertType: alertTypeSchema.optional(),
  severity: severitySchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export type GetFraudAlertsRequest = z.infer<typeof getFraudAlertsRequestSchema>

export const fraudAlertSchema = z.object({
  id: z.string().uuid(),
  alertType: alertTypeSchema,
  severity: severitySchema,
  status: statusSchema,
  userIds: z.array(z.string().uuid()),
  details: z.record(z.string(), z.any()),
  matchCriteria: z.string().nullable(),
  detectedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type FraudAlert = z.infer<typeof fraudAlertSchema>

export const getFraudAlertsResponseSchema = z.object({
  success: z.boolean(),
  alerts: z.array(fraudAlertSchema).optional(),
  total: z.number().optional(),
  error: z.string().optional(),
})

export type GetFraudAlertsResponse = z.infer<typeof getFraudAlertsResponseSchema>

// ============================================
// ACTUALIZAR ESTADO DE ALERTA
// ============================================

export const updateAlertStatusRequestSchema = z.object({
  alertId: z.string().uuid('ID de alerta inválido'),
  status: statusSchema,
  notes: z.string().optional(),
  reviewedBy: z.string().uuid('ID de admin inválido'),
})

export type UpdateAlertStatusRequest = z.infer<typeof updateAlertStatusRequestSchema>

export const updateAlertStatusResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
})

export type UpdateAlertStatusResponse = z.infer<typeof updateAlertStatusResponseSchema>

// ============================================
// ESTADÍSTICAS DE FRAUDE
// ============================================

export const fraudStatsSchema = z.object({
  totalNew: z.number(),
  totalReviewed: z.number(),
  totalDismissed: z.number(),
  totalActionTaken: z.number(),
  byType: z.record(z.string(), z.number()),
  bySeverity: z.record(z.string(), z.number()),
  last24h: z.number(),
  last7d: z.number(),
})

export type FraudStats = z.infer<typeof fraudStatsSchema>

export const getFraudStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: fraudStatsSchema.optional(),
  error: z.string().optional(),
})

export type GetFraudStatsResponse = z.infer<typeof getFraudStatsResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

export function validateCreateFraudAlert(data: unknown): CreateFraudAlertRequest {
  return createFraudAlertRequestSchema.parse(data)
}

export function validateUpdateAlertStatus(data: unknown): UpdateAlertStatusRequest {
  return updateAlertStatusRequestSchema.parse(data)
}

export function validateGetFraudAlerts(data: unknown): GetFraudAlertsRequest {
  return getFraudAlertsRequestSchema.parse(data)
}

// Safe parse versions
export function safeParseCreateFraudAlert(data: unknown) {
  return createFraudAlertRequestSchema.safeParse(data)
}

export function safeParseUpdateAlertStatus(data: unknown) {
  return updateAlertStatusRequestSchema.safeParse(data)
}
