// lib/logClientError.ts — Helper centralizado para logar errores client-side.
// Va a observabilidad in-house (observable_events vía /api/observability/ingest),
// NO a validation_error_logs (los inserts directos saturaban el pool, cambio
// 23/04/2026). Antes iba a Sentry; retirado Sentry (05/07/2026) → emit propio.
// Fire-and-forget: nunca lanza, nunca bloquea.

import { emitClientEvent } from '@/lib/observability/client'
import { getClientVersion } from '@/hooks/useVersionCheck'

export type ClientErrorSeverity = 'critical' | 'warning' | 'info'

export function logClientError(
  endpoint: string,
  error: unknown,
  context?: {
    component?: string
    questionId?: string | null
    userId?: string | null
    severity?: ClientErrorSeverity
    extra?: Record<string, unknown>
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const prefix = context?.component ? `[${context.component} client] ` : ''
  const clientVersion = getClientVersion()
  const message = `${prefix}${err.message}${clientVersion ? ` [v:${clientVersion}]` : ''}`

  // Emit a observabilidad in-house (buffer + flush, sin insert directo a BD).
  try {
    emitClientEvent({
      severity:
        context?.severity === 'info'
          ? 'info'
          : context?.severity === 'warning'
            ? 'warn'
            : 'error',
      eventType: 'client_error',
      endpoint,
      errorMessage: message,
      metadata: {
        component: context?.component ?? null,
        questionId: context?.questionId ?? null,
        deploy: clientVersion ?? null,
        stack: err.stack,
        ...(context?.extra ?? {}),
      },
    })
  } catch {
    // observabilidad caída jamás rompe el flujo
  }
}
