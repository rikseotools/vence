// lib/logClientError.ts — Helper centralizado para logar errores client-side
// Estrategia mixta: errores client-side → Sentry (no satura BD),
// errores server-side → validation_error_logs (panel admin).
// Cambio 23/04/2026: los inserts a validation_error_logs saturaban el pool
// de conexiones (max:1 en traceDb) con ~1000 errores/día client-side.
// Fire-and-forget: nunca lanza, nunca bloquea.

import * as Sentry from '@sentry/nextjs'
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

  // Send to Sentry (no DB insert, no pool saturation)
  try {
    Sentry.withScope(scope => {
      scope.setTag('endpoint', endpoint)
      scope.setTag('source', 'client')
      scope.setLevel(
        context?.severity === 'info' ? 'info'
          : context?.severity === 'warning' ? 'warning'
          : 'error'
      )
      if (context?.component) scope.setTag('component', context.component)
      if (context?.questionId) scope.setTag('questionId', context.questionId)
      if (context?.userId) scope.setTag('userId', context.userId)
      if (clientVersion) scope.setTag('deploy', clientVersion)
      if (context?.extra) {
        for (const [key, value] of Object.entries(context.extra)) {
          scope.setExtra(key, value)
        }
      }

      Sentry.captureException(new Error(message), { originalException: err })
    })
  } catch {
    // Sentry not available — silent fail
  }
}
