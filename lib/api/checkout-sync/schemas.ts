// lib/api/checkout-sync/schemas.ts
//
// Schemas Zod para el flujo de activación SÍNCRONA post-checkout.
//
// Contexto: hasta 2026-05-27, /premium/success solo llamaba refreshUser() y
// dependía 100% del webhook de Stripe para que user_subscriptions + plan_type
// estuvieran actualizados antes de que el user clicara "Empezar a estudiar".
// Cuando el webhook fallaba (caso 27/05: STRIPE_WEBHOOK_SECRET desincronizado),
// usuarios pagaban y se bloqueaban a las 25 preguntas. Solución profesional:
// activación inmediata leyendo Stripe Checkout Session directo + webhook como
// defensa idempotente.

import { z } from 'zod/v3'

// ────────────────────────────────────────────────────────────────
// REQUEST
// ────────────────────────────────────────────────────────────────

export const syncCheckoutRequestSchema = z.object({
  // Session ID que Stripe pone en el query string del success_url
  // (success_url=...?session_id={CHECKOUT_SESSION_ID}).
  sessionId: z.string().min(8).max(200).regex(/^cs_(test_|live_)?[a-zA-Z0-9_]+$/, {
    message: 'sessionId debe ser un Stripe Checkout Session id (cs_...)',
  }),
})

export type SyncCheckoutRequest = z.infer<typeof syncCheckoutRequestSchema>

export function safeParseSyncCheckoutRequest(data: unknown) {
  return syncCheckoutRequestSchema.safeParse(data)
}

// ────────────────────────────────────────────────────────────────
// RESPONSE — máquina de estados explícita
// ────────────────────────────────────────────────────────────────

// Estados posibles del sync:
//   - 'activated'        → INSERT/UPDATE ejecutados, premium activo, ya puede usar la app
//   - 'already_active'   → Sub ya estaba en BD (webhook llegó primero — idempotencia OK)
//   - 'pending_payment'  → Stripe dice payment_status='unpaid' (caso 3DS pending)
//                          el frontend debe mostrar "Tu banco pide confirmación..."
//   - 'unpaid'           → checkout session OK pero sin payment_status='paid'
//                          (ej: subscription queue en setup_intent)
export const syncCheckoutStatusSchema = z.enum([
  'activated',
  'already_active',
  'pending_payment',
  'unpaid',
])

export type SyncCheckoutStatus = z.infer<typeof syncCheckoutStatusSchema>

export const syncCheckoutResponseSchema = z.object({
  success: z.boolean(),
  status: syncCheckoutStatusSchema.optional(),
  subscriptionId: z.string().nullable().optional(),
  planType: z.string().nullable().optional(),
  currentPeriodEnd: z.string().nullable().optional(),
  // Tipo de pago / estado del payment_intent para que el frontend pueda
  // mostrar UI específica (especialmente 3DS pending).
  paymentStatus: z.string().nullable().optional(),
  // Si está activado por el sync (no por webhook anterior), true.
  // Útil para telemetría de "qué porcentaje activamos nosotros vs webhook".
  activatedBySync: z.boolean().optional(),
  error: z.string().optional(),
})

export type SyncCheckoutResponse = z.infer<typeof syncCheckoutResponseSchema>

// ────────────────────────────────────────────────────────────────
// ERRORES tipados (no son response normales, son negocio)
// ────────────────────────────────────────────────────────────────

export const syncCheckoutErrorCodeSchema = z.enum([
  'session_not_found',
  'session_expired',
  'unauthorized', // session pertenece a otro user (anti-manipulación)
  'no_subscription', // checkout era one-time, no sub
  'stripe_error',
  'db_error',
])

export type SyncCheckoutErrorCode = z.infer<typeof syncCheckoutErrorCodeSchema>

export const syncCheckoutErrorSchema = z.object({
  success: z.literal(false),
  code: syncCheckoutErrorCodeSchema,
  error: z.string(),
})

export type SyncCheckoutError = z.infer<typeof syncCheckoutErrorSchema>
