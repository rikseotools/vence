// lib/observability/schemas.ts
//
// Schemas Zod compartidos por el emit interno y por el endpoint
// /api/observability/ingest (HTTP gateway). Misma fuente de verdad
// para validación — el client-side, GHA workflows y Sentry webhook
// deben enviar el shape definido aquí.
//
// Shape diseñado compatible con OpenTelemetry semantic conventions
// (estándar industria, agnóstico a proveedor). Ver docs/runbooks/
// observability.md §4 «Diseño Sink intercambiable».

import { z } from 'zod'

export const eventSeveritySchema = z.enum([
  'debug',
  'info',
  'warn',
  'error',
  'critical',
])

export const eventSourceSchema = z.enum([
  'vercel',
  'fargate',
  'gha',
  'frontend',
])

export const observableEventSchema = z.object({
  // Timestamp ISO 8601. Si no se pasa, el endpoint usa NOW().
  ts: z.string().datetime().optional(),
  source: eventSourceSchema,
  severity: eventSeveritySchema,
  // Texto libre por ahora — convención en docs/runbooks/observability.md §6
  eventType: z.string().min(1).max(64),
  endpoint: z.string().max(500).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  deployVersion: z.string().max(64).optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  httpStatus: z.number().int().min(100).max(599).optional().nullable(),
  errorMessage: z.string().max(2000).optional().nullable(),
  // Objeto libre — campos específicos del eventType.
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type ObservableEvent = z.infer<typeof observableEventSchema>

// Payload del endpoint ingest: batch de eventos (1-50 por llamada).
// Límite alto para no romper la lambda; en client-side el cliente debe
// hacer rotación si tiene más de 50 en buffer.
export const ingestRequestSchema = z.object({
  events: z.array(observableEventSchema).min(1).max(50),
})

export type IngestRequest = z.infer<typeof ingestRequestSchema>

export function safeParseIngestRequest(body: unknown) {
  return ingestRequestSchema.safeParse(body)
}
